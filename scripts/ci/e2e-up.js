#!/usr/bin/env node
'use strict';

/**
 * scripts/ci/e2e-up.js
 *
 * Deterministic E2E boot script for CI.
 *
 * Executes in order:
 *   1. Validate required env vars (DATABASE_URL, REDIS_URL, JWT_SECRET)
 *   2. Check port is free — fail immediately if already bound
 *   3. Wait for PostgreSQL (SELECT 1, 60 s timeout)
 *   4. Wait for Redis (PING, 60 s timeout)
 *   5. Run database migrations (npm run db:migrate)
 *   6. Start app server on SERVER_PORT (default 34155) in background, write PID file
 *   7. Poll /health until HTTP 200 (60 s timeout)
 *   8. GET / and verify stable root marker exists in the response
 *   9. Perform WebSocket handshake
 *  10. Print "E2E STACK READY" and exit 0 (server stays running)
 *
 * On any failure:
 *   - Dumps last 200 lines of server.log with elapsed time
 *   - Exits with code 1 (< 90 s total startup budget)
 *
 * Usage in CI:
 *   node scripts/ci/e2e-up.js
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '34155', 10);
const BASE_URL = `http://localhost:${SERVER_PORT}`;

const DATABASE_URL = process.env.DATABASE_URL || null;
const REDIS_URL = process.env.REDIS_URL || null;
const JWT_SECRET = process.env.JWT_SECRET || null;

const PG_TIMEOUT_MS = 60_000;
const REDIS_TIMEOUT_MS = 60_000;
const SERVER_TIMEOUT_MS = 60_000;
const WS_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

const SERVER_LOG_FILE = path.resolve(ROOT, 'server.log');
const PID_FILE = path.resolve(ROOT, 'e2e-server.pid');
const DIAGNOSTIC_TAIL_LINES = 200;

const BOOT_START_MS = Date.now();

// ─── Utilities ────────────────────────────────────────────────────────────────

/** ISO timestamp prefix for all log lines. */
function ts() {
  return new Date().toISOString();
}

/** Elapsed seconds since boot start. */
function elapsed() {
  return ((Date.now() - BOOT_START_MS) / 1000).toFixed(1);
}

/** Step header printer. */
function step(n, total, label) {
  console.log(`\n[e2e-up] ${ts()} (+${elapsed()}s) ── Step ${n}/${total}: ${label}`);
}

/** Dump last N lines of server.log to stderr. */
function dumpServerLog() {
  console.error('\n[e2e-up] ─── server.log (last 200 lines) ─────────────────────────');
  if (fs.existsSync(SERVER_LOG_FILE)) {
    const lines = fs.readFileSync(SERVER_LOG_FILE, 'utf8').split('\n');
    console.error(lines.slice(-DIAGNOSTIC_TAIL_LINES).join('\n'));
  } else {
    console.error('[e2e-up] server.log not found.');
  }
  console.error('[e2e-up] ─────────────────────────────────────────────────────────\n');
}

/** Fail with message + elapsed time + log dump. */
function fail(msg) {
  console.error(`\n[e2e-up] ${ts()} (+${elapsed()}s) ❌ FATAL: ${msg}`);
  dumpServerLog();
  process.exit(1);
}

/** Poll fn() until it resolves truthy or timeout expires. */
async function pollUntil(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  process.stdout.write(`[e2e-up] Waiting for ${label}`);
  while (Date.now() < deadline) {
    try {
      if (await fn()) {
        process.stdout.write(` ✓ (+${elapsed()}s)\n`);
        return;
      }
    } catch (e) {
      lastErr = e;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  process.stdout.write('\n');
  throw new Error(
    `Timed out after ${(timeoutMs / 1000).toFixed(0)}s waiting for ${label}` +
    (lastErr ? `: ${lastErr.message}` : '')
  );
}

// ─── Readiness checks ─────────────────────────────────────────────────────────

/**
 * Verify the port is not already in use.
 * Resolves true if free, rejects with a descriptive error if bound.
 */
function checkPortFree(port) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true));
    });
    srv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already bound`));
      } else {
        reject(e);
      }
    });
  });
}

/** Verify PostgreSQL by connecting and running SELECT 1. */
function checkPostgres() {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const { Client } = require('pg');
    const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
    client.connect()
      .then(() => client.query('SELECT 1'))
      .then(() => client.end())
      .then(() => resolve(true))
      .catch((e) => { client.end().catch(() => {}); reject(e); });
  });
}

/** Verify Redis by sending a raw PING command over TCP. */
function checkRedis() {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(REDIS_URL); } catch { u = { hostname: 'localhost', port: '6379' }; }
    const host = u.hostname || 'localhost';
    const port = parseInt(u.port || '6379', 10);
    const socket = net.createConnection({ host, port }, () => {
      socket.write('*1\r\n$4\r\nPING\r\n');
    });
    socket.setTimeout(2000);
    let data = '';
    socket.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('+PONG') || data.includes('PONG')) {
        socket.destroy();
        resolve(true);
      }
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Redis TCP timeout')); });
    socket.on('error', (e) => reject(e));
  });
}

/** HTTP GET /health; resolves true on HTTP 200. */
function checkHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/health`, { timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('/health timeout')); });
    req.on('error', reject);
  });
}

/**
 * HTTP GET /; resolves true when the response contains a known stable root
 * marker (the #viewLanding container or the page <title>).
 */
function checkRootPage() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/`, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GET / returned HTTP ${res.statusCode}`));
          return;
        }
        const hasMarker = body.includes('id="viewLanding"') || body.includes('<title>');
        if (!hasMarker) {
          reject(new Error('GET / returned 200 but stable root marker not found in response body'));
          return;
        }
        resolve(true);
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('GET / timeout')); });
    req.on('error', reject);
  });
}

/** Perform a minimal WebSocket handshake; resolves true on successful open. */
function checkWebSocket() {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://localhost:${SERVER_PORT}`);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('WS handshake timeout')); }, 3000);
    ws.on('open', () => { clearTimeout(timer); ws.close(); resolve(true); });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n[e2e-up] ══════════════════════════════════════════════════════════');
  console.log('[e2e-up]  SyncSpeaker E2E Boot — CI deterministic stack startup');
  console.log(`[e2e-up]  ${ts()}`);
  console.log('[e2e-up] ══════════════════════════════════════════════════════════');

  // ── Step 1: Validate required env vars ────────────────────────────────────
  step(1, 9, 'Validate required environment variables');
  const missing = [];
  if (!DATABASE_URL) missing.push('DATABASE_URL');
  if (!REDIS_URL)    missing.push('REDIS_URL');
  if (!JWT_SECRET)   missing.push('JWT_SECRET');
  if (missing.length > 0) {
    console.error(`[e2e-up] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`[e2e-up] ${ts()} ✅ All required env vars present.`);
  console.log(`[e2e-up]    DATABASE_URL = ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`[e2e-up]    REDIS_URL    = ${REDIS_URL}`);
  console.log('[e2e-up]    JWT_SECRET   = [set]');

  // ── Step 2: Check port is free ────────────────────────────────────────────
  step(2, 9, `Check port ${SERVER_PORT} is free`);
  try {
    await checkPortFree(SERVER_PORT);
    console.log(`[e2e-up] ${ts()} ✅ Port ${SERVER_PORT} is free.`);
  } catch (e) {
    // Attempt to identify the owning process for diagnostics
    let portInfo = '';
    try {
      portInfo = execSync(`lsof -ti:${SERVER_PORT} 2>/dev/null || ss -tlnp 2>/dev/null | grep :${SERVER_PORT} || true`, {
        shell: true, encoding: 'utf8', timeout: 5000,
      }).trim();
    } catch (_) { /* best-effort */ }
    const pidHint = portInfo ? ` (owning PID(s): ${portInfo})` : '';
    fail(`${e.message}${pidHint} — stop the existing process before booting the E2E stack.`);
  }

  // ── Step 3: Wait for PostgreSQL ───────────────────────────────────────────
  step(3, 9, `Wait for PostgreSQL (${DATABASE_URL.replace(/:[^:@]+@/, ':***@')})`);
  try {
    await pollUntil(() => checkPostgres(), PG_TIMEOUT_MS, 'PostgreSQL SELECT 1');
    console.log(`[e2e-up] ${ts()} ✅ PostgreSQL is ready.`);
  } catch (e) {
    fail(`PostgreSQL not ready: ${e.message}`);
  }

  // ── Step 4: Wait for Redis ────────────────────────────────────────────────
  step(4, 9, `Wait for Redis (${REDIS_URL})`);
  try {
    await pollUntil(() => checkRedis(), REDIS_TIMEOUT_MS, 'Redis PING');
    console.log(`[e2e-up] ${ts()} ✅ Redis is ready.`);
  } catch (e) {
    fail(`Redis not ready: ${e.message}`);
  }

  // ── Step 5: Run database migrations ──────────────────────────────────────
  step(5, 9, 'Run database migrations (npm run db:migrate)');
  try {
    console.log(`[e2e-up] ${ts()} Running: npm run db:migrate`);
    execSync('npm run db:migrate', {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL },
      timeout: 60_000,
    });
    console.log(`[e2e-up] ${ts()} ✅ Migrations complete.`);
  } catch (e) {
    fail(`Migration failed: ${e.message}`);
  }

  // ── Step 6: Start app server ──────────────────────────────────────────────
  step(6, 9, `Start app server on port ${SERVER_PORT}`);

  // Load .env.test for local defaults (if present)
  const envTestPath = path.resolve(ROOT, '.env.test');
  const dotenvVars = {};
  if (fs.existsSync(envTestPath)) {
    fs.readFileSync(envTestPath, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) {
        let val = m[2];
        // Strip one layer of matching surrounding quotes (single or double)
        if (val.length >= 2 && val[0] === val[val.length - 1] && (val[0] === '"' || val[0] === "'")) {
          val = val.slice(1, -1);
        }
        dotenvVars[m[1]] = val;
      }
    });
  }

  const serverLogStream = fs.createWriteStream(SERVER_LOG_FILE, { flags: 'w' });
  const serverEnv = {
    ...dotenvVars,
    ...process.env,
    NODE_ENV: 'test',
    TEST_MODE: 'true',
    PORT: String(SERVER_PORT),
    REDIS_URL,
    DATABASE_URL,
    JWT_SECRET,
  };

  const serverProc = spawn('node', [path.resolve(ROOT, 'server.js')], {
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  serverProc.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    serverLogStream.write(chunk);
  });
  serverProc.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    serverLogStream.write(chunk);
  });

  serverProc.on('error', (e) => {
    fail(`Server process error: ${e.message}`);
  });

  let serverExited = false;
  serverProc.on('exit', (code, signal) => {
    if (!serverExited) {
      serverExited = true;
      if (code !== 0 && code !== null) {
        fail(`Server exited unexpectedly (code=${code}, signal=${signal})`);
      }
    }
  });

  // Detach so the server survives after this script exits
  serverProc.unref();

  console.log(`[e2e-up] ${ts()} Server PID: ${serverProc.pid}`);
  console.log(`[e2e-up] ${ts()} Server logs → ${SERVER_LOG_FILE}`);

  // ── Step 7: Poll /health ──────────────────────────────────────────────────
  step(7, 9, `Poll ${BASE_URL}/health (200 expected)`);
  try {
    await pollUntil(
      async () => {
        if (serverExited) throw new Error('Server process exited prematurely');
        return checkHealth();
      },
      SERVER_TIMEOUT_MS,
      'server /health → 200'
    );
    console.log(`[e2e-up] ${ts()} ✅ Server /health returned 200.`);
  } catch (e) {
    fail(`Server health check failed: ${e.message}`);
  }

  // Write PID file only after confirming the server is healthy (avoids stale PIDs)
  fs.writeFileSync(PID_FILE, String(serverProc.pid), 'utf8');
  console.log(`[e2e-up] ${ts()} PID file written: ${PID_FILE} (PID=${serverProc.pid})`);

  // ── Step 8: Verify root page stable marker ────────────────────────────────
  step(8, 9, `Verify ${BASE_URL}/ returns stable root marker`);
  try {
    await checkRootPage();
    console.log(`[e2e-up] ${ts()} ✅ Root page (/) contains stable marker.`);
  } catch (e) {
    fail(`Root page stability check failed: ${e.message}`);
  }

  // ── Step 9: WebSocket handshake ───────────────────────────────────────────
  step(9, 9, `WebSocket handshake ws://localhost:${SERVER_PORT}`);
  try {
    await pollUntil(() => checkWebSocket(), WS_TIMEOUT_MS, 'WebSocket handshake');
    console.log(`[e2e-up] ${ts()} ✅ WebSocket handshake succeeded.`);
  } catch (e) {
    fail(`WebSocket handshake failed: ${e.message}`);
  }

  // ── All systems go ────────────────────────────────────────────────────────
  console.log('\n[e2e-up] ══════════════════════════════════════════════════════════');
  console.log(`[e2e-up] ${ts()} (+${elapsed()}s)`);
  console.log('[e2e-up]  E2E STACK READY');
  console.log(`[e2e-up]  BASE_URL   = ${BASE_URL}`);
  console.log(`[e2e-up]  WS_URL     = ws://localhost:${SERVER_PORT}`);
  console.log(`[e2e-up]  Server PID = ${serverProc.pid}`);
  console.log('[e2e-up] ══════════════════════════════════════════════════════════\n');

  // Give the log stream a moment to flush before we exit
  setTimeout(() => {
    serverLogStream.end();
    process.exit(0);
  }, 200);
}

main().catch((err) => {
  console.error(`[e2e-up] ${ts()} (+${elapsed()}s) Fatal:`, err);
  dumpServerLog();
  process.exit(1);
});
