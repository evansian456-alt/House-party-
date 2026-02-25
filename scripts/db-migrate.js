#!/usr/bin/env node
'use strict';

/**
 * Database migration runner.
 *
 * Applies db/schema.sql followed by all SQL files in db/migrations/ (sorted).
 * Requires DATABASE_URL to be set in the environment.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/db-migrate.js
 *   npm run db:migrate
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('[db:migrate] ⚠️  DATABASE_URL is not set. Skipping migrations.');
  process.exit(0); // exit 0 so `--if-present` logic doesn't block CI unexpectedly
}

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`[db:migrate] Applying ${path.relative(process.cwd(), filePath)}…`);
  await client.query(sql);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
  } catch (err) {
    console.error('[db:migrate] ❌ Could not connect to database:', err.message);
    process.exit(1);
  }
  console.log('[db:migrate] Connected to PostgreSQL.');

  try {
    // 1) Base schema
    const schemaPath = path.resolve(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      await runSqlFile(client, schemaPath);
    } else {
      console.warn('[db:migrate] No db/schema.sql found — skipping.');
    }

    // 2) Migrations in sorted order
    const migrationsDir = path.resolve(__dirname, '..', 'db', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const file of files) {
        await runSqlFile(client, path.join(migrationsDir, file));
      }
    } else {
      console.warn('[db:migrate] No db/migrations/ directory found — skipping.');
    }

    console.log('[db:migrate] ✅ All migrations applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:migrate] ❌ Migration failed:', err.message);
  process.exit(1);
});
