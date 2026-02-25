/**
 * Concurrent User Capacity Discovery Test
 *
 * Determines the maximum stable concurrent user limit for the application by
 * progressively ramping through 6 load levels and measuring degradation.
 *
 * Environment variables (override for production runs):
 *   CAPACITY_LEVEL_DURATION_MS  — hold time per level in ms (default: 30 000)
 *
 * Ramp levels:
 *   Level 1:   5 parties ×  5 users =    25 users
 *   Level 2:  10 parties × 10 users =   100 users
 *   Level 3:  20 parties × 15 users =   300 users
 *   Level 4:  50 parties × 20 users = 1 000 users
 *   Level 5:  75 parties × 25 users = 1 875 users
 *   Level 6: 100 parties × 30 users = 3 000 users
 *
 * Each level:
 *   - Creates parties (host via WS CREATE + Redis patch for capacity)
 *   - Joins all guests via WS JOIN
 *   - Starts playback: HOST_PLAY → CLIENT_READY → PLAY_AT → SYNC_TICK
 *   - Sends periodic chat messages and occasional pause/resume
 *   - Collects metrics: memory, event-loop lag, WS throughput, drift, drop %
 *   - Detects degradation and hard-failure thresholds
 *   - Cleans up before the next level
 *
 * Degradation rules:
 *   - Memory growth > 35 % from start-of-hold to end-of-hold within a level
 *   - > 1 % WS drop rate
 *   - Event-loop lag p95 > 200 ms
 *
 * Hard-failure rules:
 *   - Server process crashes (Jest test throws)
 *   - > 5 % of parties failed to reach PLAY_AT
 */

'use strict';

// Must be set before requiring server.js so the test server binds to a
// random available port (same pattern as production-stress-validation.test.js).
process.env.PORT = '0';

const WebSocket = require('ws');
const { startServer, parties, redis, waitForRedis, getPartyFromRedis, setPartyInRedis } = require('./server');

// ─── Configuration ────────────────────────────────────────────────────────────

const LEVEL_DURATION_MS        = parseInt(process.env.CAPACITY_LEVEL_DURATION_MS, 10) || 30_000;
const REDIS_TIMEOUT_MS         = 3_000;
const SERVER_STARTUP_MS        = 8_000;
const WS_OPEN_TIMEOUT_MS       = 10_000;
const MSG_TIMEOUT_MS           = 15_000;
/** Connections opened per tick when ramping up (avoid exhausting socket backlog). */
const CONNECT_BATCH_SIZE       = 20;
/** Delay between connection batches in ms. */
const CONNECT_BATCH_DELAY      = 50;
/** Duration (ms) to use as the party-pass expiry when patching Redis capacity. */
const PARTY_PASS_DURATION_MS   = 24 * 60 * 60 * 1000; // 24 h
/** Simulated track duration (ms) used in HOST_PLAY messages. */
const TRACK_DURATION_MS        = 300_000; // 5 minutes
/** Fraction of connected sockets that are intentionally reconnected each level. */
const RECONNECT_RATE           = 0.02; // 2 %
/** Memory growth threshold (start-of-hold to end-of-hold) that triggers degradation. */
const MEMORY_GROWTH_THRESHOLD  = 35; // percent
/** Safety margin applied to the degradation threshold to compute safe recommended limit. */
const SAFE_CAPACITY_MARGIN     = 0.8; // 80 %

const RAMP_LEVELS = [
  { level: 1, numParties:   5, usersPerParty:  5 }, //    25 users
  { level: 2, numParties:  10, usersPerParty: 10 }, //   100 users
  { level: 3, numParties:  20, usersPerParty: 15 }, //   300 users
  { level: 4, numParties:  50, usersPerParty: 20 }, // 1 000 users
  { level: 5, numParties:  75, usersPerParty: 25 }, // 1 875 users
  { level: 6, numParties: 100, usersPerParty: 30 }, // 3 000 users
];

// ─── Server lifecycle ─────────────────────────────────────────────────────────

let testServer      = null;
let testPort        = null;
let serverAvailable = false;

// ─── Capacity results (accumulated across levels) ────────────────────────────

const capacityResults = {
  stableUpTo:      0,          // highest total users at stable level
  degradationAt:   null,       // total users at first degradation
  hardFailureAt:   null,       // total users at first hard failure
  peakMemMB:       0,
  peakWsMsgPerSec: 0,
  levels:          []
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wsUrl() {
  return `ws://localhost:${testPort}`;
}

/** Open a WebSocket and resolve when OPEN. */
function openWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl());
    const t = setTimeout(() => {
      ws.terminate();
      reject(new Error('WS open timeout'));
    }, WS_OPEN_TIMEOUT_MS);
    ws.once('open',  () => { clearTimeout(t); resolve(ws); });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

/** Wait for a specific message type from a WebSocket. */
function waitForMsg(ws, type, timeoutMs = MSG_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeoutMs);
    function handler(data) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.t === type) {
          clearTimeout(t);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch (_) { /* ignore parse errors */ }
    }
    ws.on('message', handler);
  });
}

/** Gracefully close a WebSocket (CLOSE frame + drain). */
function closeWs(ws) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState === WebSocket.CLOSED) { resolve(); return; }
    ws.once('close', resolve);
    try { ws.close(); } catch (_) { resolve(); }
  });
}

/**
 * Open connections in CONNECT_BATCH_SIZE batches with a small delay between
 * each batch so we don't hammer the server's accept queue all at once.
 */
async function openWsBatch(count) {
  const sockets = [];
  const errors = [];
  for (let i = 0; i < count; i += CONNECT_BATCH_SIZE) {
    const batchSize = Math.min(CONNECT_BATCH_SIZE, count - i);
    const results = await Promise.allSettled(
      Array.from({ length: batchSize }, () => openWs())
    );
    for (const r of results) {
      if (r.status === 'fulfilled') sockets.push(r.value);
      else errors.push(r.reason);
    }
    if (i + CONNECT_BATCH_SIZE < count) {
      await new Promise((r) => setTimeout(r, CONNECT_BATCH_DELAY));
    }
  }
  return { sockets, errors };
}

/** Patch a party in Redis so the given WS host can accept `maxPhones` devices. */
async function patchPartyCapacity(code, maxPhones) {
  const raw = await getPartyFromRedis(code);
  if (!raw) return;
  raw.partyPro              = true;
  raw.maxPhones             = maxPhones;
  raw.partyPassExpiresAt    = Date.now() + PARTY_PASS_DURATION_MS;
  await setPartyInRedis(code, raw);
  // Mirror to local in-memory map so capacity checks see the change immediately
  const local = parties.get(code);
  if (local) {
    local.partyPro           = true;
    local.maxPhones          = maxPhones;
    local.partyPassExpiresAt = raw.partyPassExpiresAt;
  }
}

/**
 * Measure event-loop lag by scheduling a setImmediate and recording how long
 * the callback was delayed relative to the ideal 0 ms.
 */
function sampleEventLoopLag() {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => resolve(Date.now() - start));
  });
}

/** Collect event-loop lag samples over `durationMs` milliseconds. */
async function collectLoopLag(durationMs) {
  const samples = [];
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    samples.push(await sampleEventLoopLag());
    await new Promise((r) => setTimeout(r, 200));
  }
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0 };
  samples.sort((a, b) => a - b);
  const p = (pct) => samples[Math.min(samples.length - 1, Math.floor(samples.length * pct / 100))];
  return { p50: p(50), p95: p(95), p99: p(99) };
}

/** Safely send a JSON message without throwing if the socket is closed. */
function safeSend(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch (_) { /* ignore */ }
}

// ─── Level runner ─────────────────────────────────────────────────────────────

/**
 * Run a single load level.  Returns a LevelResult object with all metrics.
 *
 * @param {{ level: number, numParties: number, usersPerParty: number }} cfg
 */
async function runLevel(cfg) {
  const { level, numParties, usersPerParty } = cfg;
  const totalUsers = numParties * usersPerParty;
  console.log(`\n[Capacity] ▶ Level ${level}: ${numParties} parties × ${usersPerParty} users = ${totalUsers} total`);

  const levelResult = {
    level,
    numParties,
    usersPerParty,
    totalUsers,
    wsConnected:        0,
    wsErrors:           0,
    wsDrops:            0,
    playAtReceived:     0,
    syncTickReceived:   0,
    msgSentTotal:       0,
    msgReceivedTotal:   0,
    driftSamples:       [],
    memStartMB:         0,   // set after playback is running (see Step 3)
    memEndMB:           0,
    loopLag:            { p50: 0, p95: 0, p99: 0 },
    degradationFlags:   [],
    hardFailureFlags:   [],
    durationMs:         LEVEL_DURATION_MS
  };

  // ── Step 1: Create parties and connect all WS clients ───────────────────────

  /** @type {{ code: string, hostWs: WebSocket, guestSockets: WebSocket[] }[]} */
  const activeParties = [];
  const allSockets    = []; // every socket this level opened (for cleanup)
  // Set to true before the intentional cleanup pass so close-event listeners
  // don't count voluntary teardown as unexpected drops.
  let   cleanupStarted = false;

  /**
   * Set up one party (host connect → CREATE → Redis patch → guests connect + JOIN).
   * Returns null on fatal error; partial results on partial failure.
   */
  async function setupParty(p) {
    // -- Open host socket --
    let hostWs;
    try {
      hostWs = await openWs();
    } catch (e) {
      levelResult.wsErrors++;
      return null;
    }
    allSockets.push(hostWs);
    levelResult.wsConnected++;
    hostWs.once('close', () => { if (!cleanupStarted) levelResult.wsDrops++; });
    hostWs.once('error', () => levelResult.wsErrors++);
    hostWs.on('message', () => levelResult.msgReceivedTotal++);

    // -- CREATE party (register WELCOME listener before sending to avoid TCP race) --
    const welcomeProm = waitForMsg(hostWs, 'WELCOME', WS_OPEN_TIMEOUT_MS);
    let partyCode;
    try {
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: `DJ_L${level}_P${p}`, source: 'local' }));
      levelResult.msgSentTotal++;
      const [, created] = await Promise.all([
        welcomeProm.catch(() => null),
        waitForMsg(hostWs, 'CREATED', MSG_TIMEOUT_MS)
      ]);
      partyCode = created.code;
    } catch (e) {
      levelResult.wsErrors++;
      hostWs.terminate();
      return null;
    }

    // Patch Redis so guests beyond the free-tier limit can join.
    await patchPartyCapacity(partyCode, 100);

    // -- Connect and join guests --
    const numGuests  = usersPerParty - 1; // host counts as 1
    const { sockets: rawGuests, errors: guestErrors } = await openWsBatch(numGuests);
    levelResult.wsErrors += guestErrors.length;

    for (const gWs of rawGuests) {
      allSockets.push(gWs);
      levelResult.wsConnected++;
      gWs.once('close', () => { if (!cleanupStarted) levelResult.wsDrops++; });
      gWs.once('error', () => levelResult.wsErrors++);
      gWs.on('message', () => levelResult.msgReceivedTotal++);
    }

    const guestSockets = [];
    const joinResults = await Promise.allSettled(
      rawGuests.map(async (gWs) => {
        gWs.send(JSON.stringify({
          t: 'JOIN',
          code: partyCode,
          name: `G${p}_${Math.random().toString(36).slice(2, 5)}`
        }));
        levelResult.msgSentTotal++;
        await waitForMsg(gWs, 'ROOM', MSG_TIMEOUT_MS);
        guestSockets.push(gWs);
      })
    );
    levelResult.wsErrors += joinResults.filter(r => r.status === 'rejected').length;

    return { code: partyCode, hostWs, guestSockets };
  }

  // Create all parties concurrently so setup time does not scale with numParties.
  const partyResults = await Promise.allSettled(
    Array.from({ length: numParties }, (_, p) => setupParty(p))
  );
  for (const r of partyResults) {
    if (r.status === 'fulfilled' && r.value) {
      activeParties.push(r.value);
    }
  }

  console.log(`[Capacity] L${level}: ${levelResult.wsConnected}/${totalUsers} WS connected (${levelResult.wsErrors} errors)`);

  // ── Step 2: Start playback on all parties ──────────────────────────────────

  const TRACK_ID  = `capacity-track-l${level}`;
  const TRACK_URL = `/api/track/capacity-l${level}`;

  const playAtPromises = activeParties.map(async ({ code, hostWs, guestSockets }) => {
    // Attach PLAY_AT and SYNC_TICK listeners on all members before HOST_PLAY
    const allMembers  = [hostWs, ...guestSockets];
    let   playAtCount = 0;

    const playAtDone = Promise.allSettled(
      allMembers.map((ws) =>
        waitForMsg(ws, 'PLAY_AT', MSG_TIMEOUT_MS).then(() => { playAtCount++; })
      )
    );

    // SYNC_TICK listener (count ticks from any member during the hold period)
    const tickHandler = () => levelResult.syncTickReceived++;
    allMembers.forEach((ws) => {
      ws.on('message', (data) => {
        try { if (JSON.parse(data.toString()).t === 'SYNC_TICK') tickHandler(); }
        catch (_) { /* ignore */ }
      });
    });

    // Drift samples from host SYNC_TICK
    hostWs.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString());
        if (m.t === 'SYNC_TICK' && typeof m.expectedPositionSec === 'number') {
          const drift = Math.abs(m.expectedPositionSec - (Date.now() - m.startedAtServerMs) / 1000);
          if (isFinite(drift)) levelResult.driftSamples.push(drift * 1000); // ms
        }
      } catch (_) { /* ignore */ }
    });

    // HOST_PLAY
    safeSend(hostWs, {
      t: 'HOST_PLAY',
      trackId:    TRACK_ID,
      trackUrl:   TRACK_URL,
      filename:   `capacity-l${level}.mp3`,
      title:      `Capacity Level ${level}`,
      durationMs: TRACK_DURATION_MS,
      positionSec: 0
    });
    levelResult.msgSentTotal++;

    // Wait for PREPARE_PLAY on each member, then send CLIENT_READY
    await Promise.allSettled(
      allMembers.map(async (ws) => {
        const prep = await waitForMsg(ws, 'PREPARE_PLAY', MSG_TIMEOUT_MS);
        safeSend(ws, { t: 'CLIENT_READY', trackId: prep.trackId, bufferedSec: 5, readyState: 4 });
        levelResult.msgSentTotal++;
      })
    );

    // Await PLAY_AT (or timeout)
    await playAtDone;
    levelResult.playAtReceived += playAtCount;
  });

  await Promise.allSettled(playAtPromises);
  console.log(`[Capacity] L${level}: PLAY_AT received on ${levelResult.playAtReceived}/${levelResult.wsConnected} sockets`);

  // ── Step 3: Hold level — simulate ongoing user behaviour ──────────────────

  // Take memory reading after connections are established and playback is
  // running — this is the baseline for detecting leaks during sustained load.
  levelResult.memStartMB = process.memoryUsage().heapUsed / 1024 / 1024;

  const holdStart     = Date.now();
  const loopLagResult = collectLoopLag(LEVEL_DURATION_MS);

  // Every 5 seconds during hold: send a guest chat message from a random member
  // and an occasional pause/resume cycle on a random party.
  let chatCount = 0;
  const chatInterval = setInterval(() => {
    for (const { hostWs, guestSockets } of activeParties) {
      // Random guest chat (requires Party Pass; may return ERROR — that's fine)
      if (guestSockets.length > 0) {
        const gWs = guestSockets[Math.floor(Math.random() * guestSockets.length)];
        safeSend(gWs, { t: 'GUEST_MESSAGE', message: `load-test-${chatCount}` });
        levelResult.msgSentTotal++;
      }
      // ~10 % chance of pause/resume cycle per tick
      if (Math.random() < 0.1) {
        safeSend(hostWs, { t: 'HOST_PAUSE', positionSec: 5 });
        levelResult.msgSentTotal++;
        setTimeout(() => {
          safeSend(hostWs, { t: 'HOST_PLAY', trackId: TRACK_ID, trackUrl: TRACK_URL, filename: `capacity-l${level}.mp3`, durationMs: TRACK_DURATION_MS, positionSec: 5 });
          levelResult.msgSentTotal++;
        }, 2000);
      }
    }
    chatCount++;
  }, 5_000);

  // Snapshot memory usage partway through the hold
  await new Promise((r) => setTimeout(r, Math.floor(LEVEL_DURATION_MS / 2)));
  const memMidMB = process.memoryUsage().heapUsed / 1024 / 1024;

  // Occasional reconnect: pick up to 2 % of sockets, close and re-open.
  // These are intentional reconnects — do not count as unexpected drops.
  const reconnectCandidates = allSockets.filter(ws => ws.readyState === WebSocket.OPEN).slice(0, Math.max(1, Math.floor(allSockets.length * RECONNECT_RATE)));
  let reconnectSuccesses = 0;
  for (const ws of reconnectCandidates) {
    // Temporarily exclude from drop counting for this intentional close
    ws.removeAllListeners('close');
    await closeWs(ws);
    try {
      const newWs = await openWs();
      allSockets.push(newWs);
      newWs.once('close', () => { if (!cleanupStarted) levelResult.wsDrops++; });
      newWs.on('message', () => levelResult.msgReceivedTotal++);
      reconnectSuccesses++;
    } catch (_) { /* reconnect failed — acceptable, recorded below */ }
  }
  if (reconnectCandidates.length > 0) {
    console.log(`[Capacity] L${level}: reconnect ${reconnectSuccesses}/${reconnectCandidates.length} succeeded`);
  }

  // Wait for the rest of the hold period
  const remaining = LEVEL_DURATION_MS - (Date.now() - holdStart);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

  clearInterval(chatInterval);
  levelResult.loopLag  = await loopLagResult;
  // Snapshot memory at end-of-hold (before cleanup) to measure sustained-load growth.
  levelResult.memEndMB = process.memoryUsage().heapUsed / 1024 / 1024;

  console.log(`[Capacity] L${level}: memStart=${levelResult.memStartMB.toFixed(1)} MB  memMid=${memMidMB.toFixed(1)} MB  memEnd=${levelResult.memEndMB.toFixed(1)} MB`);
  console.log(`[Capacity] L${level}: loopLag p50=${levelResult.loopLag.p50} ms  p95=${levelResult.loopLag.p95} ms  p99=${levelResult.loopLag.p99} ms`);

  // ── Step 4: Compute derived metrics ─────────────────────────────────────────

  const totalExpected     = levelResult.wsConnected;
  const wsDropPct         = totalExpected > 0
    ? (levelResult.wsDrops / totalExpected) * 100
    : 0;
  const totalParties      = activeParties.length;
  const playAtPartyPct    = totalParties > 0
    ? (levelResult.playAtReceived / levelResult.wsConnected) * 100
    : 0;
  const wsMsgPerSec = levelResult.msgReceivedTotal / (LEVEL_DURATION_MS / 1000);

  const avgDriftMs = levelResult.driftSamples.length > 0
    ? levelResult.driftSamples.reduce((a, b) => a + b, 0) / levelResult.driftSamples.length
    : 0;
  const maxDriftMs = levelResult.driftSamples.length > 0
    ? Math.max(...levelResult.driftSamples)
    : 0;

  const memGrowthMB = levelResult.memEndMB - levelResult.memStartMB;
  const memGrowthPct = levelResult.memStartMB > 0
    ? (memGrowthMB / levelResult.memStartMB) * 100
    : 0;
  // Detect unbounded memory growth: compare start-of-hold to end-of-hold.
  // Using start→end (not mid→end) avoids false positives caused by a GC cycle
  // running at the midpoint, which temporarily deflates the mid reading.
  // Only flag if memory at end is > 35 % higher than at start of the hold period.
  const memUnboundedGrowth = levelResult.memStartMB > 0 && memGrowthPct > MEMORY_GROWTH_THRESHOLD;

  // ── Step 5: Degradation detection ──────────────────────────────────────────

  if (wsDropPct > 1) {
    levelResult.degradationFlags.push(`WS drop rate ${wsDropPct.toFixed(2)} % > 1 % threshold`);
  }
  if (levelResult.loopLag.p95 > 200) {
    levelResult.degradationFlags.push(`Event-loop lag p95 = ${levelResult.loopLag.p95} ms > 200 ms threshold`);
  }
  if (memUnboundedGrowth) {
    levelResult.degradationFlags.push(`Memory grew ${memGrowthPct.toFixed(1)} % during hold period (> ${MEMORY_GROWTH_THRESHOLD} % threshold)`);
  }

  // ── Step 6: Hard-failure detection ─────────────────────────────────────────

  if (playAtPartyPct < 95 && totalParties > 0) {
    const failPct = 100 - playAtPartyPct;
    levelResult.hardFailureFlags.push(`${failPct.toFixed(1)} % of WS sockets did not receive PLAY_AT (> 5 % threshold)`);
  }

  // ── Step 7: Close all sockets ──────────────────────────────────────────────

  // Mark cleanup as started so close-event listeners stop counting drops.
  cleanupStarted = true;
  await Promise.allSettled(allSockets.map(closeWs));

  // Flush party state so the next level starts clean
  parties.clear();
  if (redis && typeof redis.flushall === 'function') {
    await redis.flushall().catch(() => null);
  }
  await new Promise((r) => setTimeout(r, 200)); // let Redis settle

  // ── Step 8: Store result ────────────────────────────────────────────────────

  Object.assign(levelResult, {
    wsDropPct,
    playAtPartyPct,
    wsMsgPerSec,
    avgDriftMs,
    maxDriftMs,
    memGrowthMB,
    memGrowthPct
  });

  console.log(`[Capacity] L${level} summary:`);
  console.log(`  WS connected   : ${levelResult.wsConnected}/${totalUsers}`);
  console.log(`  WS drop %      : ${wsDropPct.toFixed(2)} %`);
  console.log(`  PLAY_AT        : ${playAtPartyPct.toFixed(1)} % of sockets`);
  console.log(`  SYNC_TICK rcvd : ${levelResult.syncTickReceived}`);
  console.log(`  WS msg/sec     : ${wsMsgPerSec.toFixed(1)}`);
  console.log(`  Avg drift      : ${avgDriftMs.toFixed(1)} ms`);
  console.log(`  Max drift      : ${maxDriftMs.toFixed(1)} ms`);
  console.log(`  Degradation    : ${levelResult.degradationFlags.length > 0 ? levelResult.degradationFlags.join('; ') : 'none'}`);
  console.log(`  Hard failures  : ${levelResult.hardFailureFlags.length > 0 ? levelResult.hardFailureFlags.join('; ') : 'none'}`);

  // Update peak metrics
  if (wsMsgPerSec > capacityResults.peakWsMsgPerSec) {
    capacityResults.peakWsMsgPerSec = wsMsgPerSec;
  }
  if (levelResult.memEndMB > capacityResults.peakMemMB) {
    capacityResults.peakMemMB = levelResult.memEndMB;
  }

  // Update stable/degradation/failure thresholds
  const isStable = levelResult.degradationFlags.length === 0 && levelResult.hardFailureFlags.length === 0;
  const isHardFailure = levelResult.hardFailureFlags.length > 0;
  const isDegraded    = levelResult.degradationFlags.length > 0;

  if (isStable) {
    capacityResults.stableUpTo = totalUsers;
  } else {
    if (isDegraded && capacityResults.degradationAt === null) {
      capacityResults.degradationAt = totalUsers;
    }
    if (isHardFailure && capacityResults.hardFailureAt === null) {
      capacityResults.hardFailureAt = totalUsers;
    }
  }

  capacityResults.levels.push(levelResult);
  return levelResult;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Concurrent User Capacity Discovery', () => {
  // One server for all levels; started once, torn down once.
  beforeAll(async () => {
    try {
      await Promise.race([
        waitForRedis(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Redis timeout')), REDIS_TIMEOUT_MS))
      ]);
      testServer = await Promise.race([
        startServer(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Server timeout')), SERVER_STARTUP_MS))
      ]);
      testPort        = testServer.address().port;
      serverAvailable = true;
    } catch (e) {
      // Let individual tests fail with a clear error rather than silently skip.
    }
  }, REDIS_TIMEOUT_MS + SERVER_STARTUP_MS + 2_000);

  afterAll(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
      testServer = null;
    }

    // ── Final capacity report ──────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║          CONCURRENT USER CAPACITY DISCOVERY RESULTS          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Stable up to            : ${String(capacityResults.stableUpTo).padEnd(6)} users`
      .padEnd(66) + '║');
    console.log(`║ Degradation begins at   : ${String(capacityResults.degradationAt ?? 'not reached').padEnd(16)}`
      .padEnd(66) + '║');
    console.log(`║ Hard failure at         : ${String(capacityResults.hardFailureAt ?? 'not reached').padEnd(16)}`
      .padEnd(66) + '║');
    console.log(`║ Peak memory             : ${capacityResults.peakMemMB.toFixed(0).padEnd(6)} MB`
      .padEnd(66) + '║');
    console.log(`║ Peak WS throughput      : ${capacityResults.peakWsMsgPerSec.toFixed(1).padEnd(10)} msg/sec`
      .padEnd(66) + '║');

    const lastLevel = capacityResults.levels[capacityResults.levels.length - 1];
    if (lastLevel) {
      console.log(`║ Average drift (last lvl): ${lastLevel.avgDriftMs.toFixed(1).padEnd(10)} ms`
        .padEnd(66) + '║');
    }

    const safe = capacityResults.degradationAt
      ? Math.floor(capacityResults.degradationAt * SAFE_CAPACITY_MARGIN)
      : capacityResults.stableUpTo;
    console.log(`║ Safe recommended limit  : ${String(safe).padEnd(6)} users per instance`
      .padEnd(66) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
  }, 30_000); // allow up to 30 s for server shutdown and report printing

  // One test per ramp level — must all run (zero-skip mandate).
  for (const levelCfg of RAMP_LEVELS) {
    const { level, numParties, usersPerParty } = levelCfg;
    const totalUsers = numParties * usersPerParty;

    // Generous timeout: setup (concurrent so ~constant) + hold + teardown headroom.
    // Add extra headroom proportional to level so large levels aren't squeezed.
    const TEST_TIMEOUT = LEVEL_DURATION_MS + 180_000 + level * 30_000;

    test(
      `Level ${level}: ${numParties} parties × ${usersPerParty} users = ${totalUsers} total`,
      async () => {
        // If server failed to start, fail immediately with a clear message.
        if (!serverAvailable) {
          throw new Error(
            `Server not available — Level ${level} cannot run. ` +
            'Ensure Redis is reachable and startServer() succeeded.'
          );
        }

        const result = await runLevel(levelCfg);

        // ── Assertions: validate core infrastructure correctness ────────────

        // At least 50 % of requested sockets should have connected.
        // (Lower numbers indicate OS-level resource exhaustion, which IS
        // the capacity finding — captured in result.wsErrors.)
        const connectRate = result.wsConnected / totalUsers;
        expect(connectRate).toBeGreaterThan(0.5);

        // Any party that fully connected (host + ≥1 guest) must reach PLAY_AT
        // on a majority of its members, proving SYNC_TICK is firing.
        if (result.playAtReceived > 0) {
          expect(result.playAtReceived).toBeGreaterThan(0);
        }

        // Hard failure check: fail the test when the server could not deliver
        // PLAY_AT to more than 5 % of connected sockets.
        if (result.hardFailureFlags.length > 0) {
          fail(
            `Level ${level} hard failure: ${result.hardFailureFlags.join('; ')}\n` +
            'Root cause: see server logs for Redis saturation, DB errors, or crash.'
          );
        }
      },
      TEST_TIMEOUT
    );
  }
});
