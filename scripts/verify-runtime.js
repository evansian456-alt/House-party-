#!/usr/bin/env node
/**
 * verify-runtime.js
 *
 * CI guard: starts the Express app (without binding a port) and verifies that
 * /ready returns 200 and /version returns the expected JSON shape.
 *
 * Usage: npm run verify-runtime
 * Exit code: 0 on success, 1 on any failure.
 */
'use strict';

const request = require('supertest');
const { app } = require('../server');

async function main() {
  const [ready, version] = await Promise.all([
    request(app).get('/ready'),
    request(app).get('/version'),
  ]);

  if (ready.status !== 200) {
    throw new Error(`/ready returned HTTP ${ready.status}, expected 200`);
  }

  if (version.status !== 200) {
    throw new Error(`/version returned HTTP ${version.status}, expected 200`);
  }

  if (typeof version.body.commit !== 'string') {
    throw new Error('/version response missing or invalid "commit" field');
  }

  if (typeof version.body.nodeVersion !== 'string') {
    throw new Error('/version response missing or invalid "nodeVersion" field');
  }

  console.log(
    '[verify-runtime] OK' +
      ' ready=' + ready.status +
      ' version=' + version.status +
      ' commit=' + version.body.commit +
      ' node=' + version.body.nodeVersion
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[verify-runtime] FAIL', err.message);
    process.exit(1);
  });
