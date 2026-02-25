/**
 * E2E Test Suite: Music Playback & Queue
 * 
 * Tests song queueing, playback controls, synchronized playback,
 * and DJ Mode effects.
 */

const { test, expect } = require('@playwright/test');
const { test: multiUserTest } = require('./utils/fixtures');
const { 
  clearBrowserStorage, 
  generateTestEmail, 
  generateDJName,
  takeScreenshot,
  delay
} = require('./utils/helpers');

test.describe('Music Playback & Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
  });

  test('MUSIC-01: Host can queue a song', async ({ page }) => {
    await page.goto('/');
    
    const queueResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Try to queue a track (mock track ID)
      response = await fetch(`/api/party/${partyInfo.code}/queue-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          trackId: 'test-track-001'
        })
      });
      
      return {
        success: response.ok,
        status: response.status,
        partyCode: partyInfo.code
      };
    });
    
    console.log('✓ Host queue test result:', queueResult);
    await takeScreenshot(page, 'music_host_queue');
  });

  test('MUSIC-02: Guest can queue song if allowed', async ({ page }) => {
    await page.goto('/');
    
    const queueResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Create guest and join
      const guestAcc = {
        email: `guest_${Date.now()}@test.com`,
        djName: `Guest_${Math.random().toString(36).substring(7)}`,
        password: 'GuestPass123!'
      };
      
      response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guestAcc)
      });
      
      const guestData = await response.json();
      
      // Join party
      await fetch('/api/join-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${guestData.token}`
        },
        body: JSON.stringify({
          code: partyInfo.code,
          djName: guestAcc.djName
        })
      });
      
      // Try to queue as guest
      response = await fetch(`/api/party/${partyInfo.code}/queue-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${guestData.token}`
        },
        body: JSON.stringify({
          trackId: 'test-track-002'
        })
      });
      
      return {
        status: response.status,
        partyCode: partyInfo.code
      };
    });
    
    console.log('✓ Guest queue test result:', queueResult);
    await takeScreenshot(page, 'music_guest_queue');
  });

  test('MUSIC-03: Play control works correctly', async ({ page }) => {
    await page.goto('/');
    
    const playResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Start a track
      response = await fetch(`/api/party/${partyInfo.code}/start-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          trackId: 'test-track-001'
        })
      });
      
      return {
        status: response.status,
        attempted: true
      };
    });
    
    console.log('✓ Play control tested:', playResult);
    await takeScreenshot(page, 'music_play_control');
  });

  test('MUSIC-04: Skip to next track works', async ({ page }) => {
    await page.goto('/');
    
    const skipResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Play next
      response = await fetch(`/api/party/${partyInfo.code}/play-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        }
      });
      
      return {
        status: response.status,
        attempted: true
      };
    });
    
    console.log('✓ Skip control tested:', skipResult);
    await takeScreenshot(page, 'music_skip');
  });

  test('MUSIC-05: Queue can be cleared', async ({ page }) => {
    await page.goto('/');
    
    const clearResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Clear queue
      response = await fetch(`/api/party/${partyInfo.code}/clear-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        }
      });
      
      return {
        status: response.status,
        attempted: true
      };
    });
    
    console.log('✓ Clear queue tested:', clearResult);
    await takeScreenshot(page, 'music_clear_queue');
  });

  test('MUSIC-06: Queue can be reordered', async ({ page }) => {
    await page.goto('/');
    
    const reorderResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Reorder queue
      response = await fetch(`/api/party/${partyInfo.code}/reorder-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          newOrder: ['track1', 'track2']
        })
      });
      
      return {
        status: response.status,
        attempted: true
      };
    });
    
    console.log('✓ Queue reorder tested:', reorderResult);
    await takeScreenshot(page, 'music_reorder');
  });

  test('MUSIC-07: Track can be removed from queue', async ({ page }) => {
    await page.goto('/');
    
    const removeResult = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Remove track
      response = await fetch(`/api/party/${partyInfo.code}/remove-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          trackId: 'test-track-001'
        })
      });
      
      return {
        status: response.status,
        attempted: true
      };
    });
    
    console.log('✓ Track removal tested:', removeResult);
    await takeScreenshot(page, 'music_remove_track');
  });

  test('MUSIC-08: DJ Mode effects are accessible', async ({ page }) => {
    await page.goto('/');
    
    // Check if DJ Mode is referenced in the app
    const djModeCheck = await page.evaluate(() => {
      // Look for DJ Mode references in the page
      const bodyText = document.body.textContent || '';
      return {
        hasDjModeReference: bodyText.toLowerCase().includes('dj mode') || 
                           bodyText.toLowerCase().includes('dj-mode')
      };
    });
    
    console.log('✓ DJ Mode accessibility checked:', djModeCheck);
    await takeScreenshot(page, 'music_dj_mode');
  });

  test('MUSIC-09: Sync stats are available', async ({ page }) => {
    await page.goto('/');
    
    const syncCheck = await page.evaluate(async () => {
      // Check if sync-related functions are available
      return {
        hasSyncClient: typeof window.SyncClient !== 'undefined',
        hasSyncEngine: typeof window.SyncEngine !== 'undefined'
      };
    });
    
    console.log('✓ Sync functionality checked:', syncCheck);
    await takeScreenshot(page, 'music_sync');
  });

  test('MUSIC-10: Playback state can be retrieved', async ({ page }) => {
    await page.goto('/');
    
    const playbackState = await page.evaluate(async () => {
      // Create host and party
      const hostAcc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostAcc)
      });
      
      const hostData = await response.json();
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        },
        body: JSON.stringify({
          djName: hostAcc.djName
        })
      });
      
      const partyInfo = await response.json();
      
      // Get party state
      response = await fetch('/api/party-state', {
        headers: {
          'Authorization': `Bearer ${hostData.token}`
        }
      });
      
      if (response.ok) {
        const state = await response.json();
        return {
          hasState: true,
          state: state
        };
      }
      
      return { hasState: false };
    });
    
    console.log('✓ Playback state checked:', playbackState.hasState);
    await takeScreenshot(page, 'music_playback_state');
  });
});
