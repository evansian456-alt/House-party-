/**
 * E2E Test Suite: Party Management
 * 
 * Tests party creation, joining, leaving, and management features.
 * Validates host and guest interactions with party rooms.
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

test.describe('Party Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
  });

  test('PARTY-01: Host can create a party', async ({ page }) => {
    await page.goto('/');
    
    // Create account
    await page.evaluate(async () => {
      const acc = {
        email: `test_${Date.now()}@test.com`,
        djName: `DJ_${Math.random().toString(36).substring(7)}`,
        password: 'TestPass123!'
      };
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('djName', acc.djName);
        }
      }
    });
    
    await page.reload();
    await delay(1000);
    
    // Create party
    const partyCode = await page.evaluate(async () => {
      const response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          djName: localStorage.getItem('djName') || 'Test DJ'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.code;
      }
      return null;
    });
    
    expect(partyCode).not.toBeNull();
    expect(partyCode).toMatch(/^[A-Z0-9]{4,6}$/); // Verify format
    
    console.log('✓ Party created with code:', partyCode);
    await takeScreenshot(page, 'party_created');
  });

  test('PARTY-02: Party room has correct initial settings', async ({ page }) => {
    await page.goto('/');
    
    // Create authenticated user and party
    const partyData = await page.evaluate(async () => {
      // Signup
      const acc = {
        email: `test_${Date.now()}@test.com`,
        djName: `DJ_${Math.random().toString(36).substring(7)}`,
        password: 'TestPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      const authData = await response.json();
      if (!authData.token) return null;
      
      localStorage.setItem('token', authData.token);
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify({
          djName: acc.djName
        })
      });
      
      const partyInfo = await response.json();
      if (!partyInfo.code) return null;
      
      // Get party details
      response = await fetch(`/api/party/${partyInfo.code}`, {
        headers: {
          'Authorization': `Bearer ${authData.token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    });
    
    expect(partyData).not.toBeNull();
    expect(partyData.code).toBeTruthy();
    expect(partyData.djName).toBeTruthy();
    
    console.log('✓ Party settings verified:', {
      code: partyData.code,
      djName: partyData.djName
    });
    
    await takeScreenshot(page, 'party_settings');
  });

  test('PARTY-03: Guest can join party with valid code', async ({ page }) => {
    // Create host and party
    const partyCode = await page.evaluate(async () => {
      // Create host
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
      return partyInfo.code;
    });
    
    expect(partyCode).not.toBeNull();
    
    // Now create guest and join
    await clearBrowserStorage(page);
    await page.reload();
    
    const joinResult = await page.evaluate(async (code) => {
      // Create guest account
      const guestAcc = {
        email: `guest_${Date.now()}@test.com`,
        djName: `Guest_${Math.random().toString(36).substring(7)}`,
        password: 'GuestPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guestAcc)
      });
      
      const guestData = await response.json();
      if (!guestData.token) return { success: false };
      
      localStorage.setItem('token', guestData.token);
      
      // Join party
      response = await fetch('/api/join-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${guestData.token}`
        },
        body: JSON.stringify({
          code: code,
          djName: guestAcc.djName
        })
      });
      
      return { 
        success: response.ok,
        status: response.status 
      };
    }, partyCode);
    
    expect(joinResult.success).toBe(true);
    console.log('✓ Guest joined party:', partyCode);
    
    await takeScreenshot(page, 'party_guest_joined');
  });

  test('PARTY-04: Invalid party code is rejected', async ({ page }) => {
    await page.goto('/');
    
    // Create guest account
    await page.evaluate(async () => {
      const acc = {
        email: `test_${Date.now()}@test.com`,
        djName: `Guest_${Math.random().toString(36).substring(7)}`,
        password: 'TestPass123!'
      };
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
      }
    });
    
    await page.reload();
    await delay(500);
    
    // Try to join with invalid code
    const joinResult = await page.evaluate(async () => {
      const response = await fetch('/api/join-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          code: 'INVALID',
          djName: 'Test Guest'
        })
      });
      
      return { 
        success: response.ok,
        status: response.status 
      };
    });
    
    expect(joinResult.success).toBe(false);
    expect(joinResult.status).toBeGreaterThanOrEqual(400);
    
    console.log('✓ Invalid party code rejected');
  });

  test('PARTY-05: Guest can leave party', async ({ page }) => {
    // Create party and join as guest
    const { partyCode, guestToken } = await page.evaluate(async () => {
      // Create host
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
      
      // Create guest
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
      
      return { 
        partyCode: partyInfo.code,
        guestToken: guestData.token 
      };
    });
    
    // Now leave party
    const leaveResult = await page.evaluate(async (token) => {
      localStorage.setItem('token', token);
      
      const response = await fetch('/api/leave-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      return { success: response.ok };
    }, guestToken);
    
    expect(leaveResult.success).toBe(true);
    console.log('✓ Guest left party successfully');
    
    await takeScreenshot(page, 'party_guest_left');
  });

  test('PARTY-06: Host can end party', async ({ page }) => {
    await page.goto('/');
    
    const endResult = await page.evaluate(async () => {
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
      localStorage.setItem('token', hostData.token);
      
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
      
      // End party
      response = await fetch('/api/end-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostData.token}`
        }
      });
      
      return { success: response.ok };
    });
    
    expect(endResult.success).toBe(true);
    console.log('✓ Host ended party successfully');
    
    await takeScreenshot(page, 'party_ended');
  });

  test('PARTY-07: Party displays correct member count', async ({ page }) => {
    await page.goto('/');
    
    const memberTest = await page.evaluate(async () => {
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
      
      // Get members
      response = await fetch(`/api/party/${partyInfo.code}/members`, {
        headers: {
          'Authorization': `Bearer ${hostData.token}`
        }
      });
      
      if (response.ok) {
        const members = await response.json();
        return {
          success: true,
          count: members.length,
          hasHost: members.some(m => m.isHost || m.djName === hostAcc.djName)
        };
      }
      
      return { success: false };
    });
    
    expect(memberTest.success).toBe(true);
    expect(memberTest.count).toBeGreaterThan(0);
    
    console.log('✓ Party member count verified:', memberTest.count);
  });

  test('PARTY-08: Party info displays correctly', async ({ page }) => {
    await page.goto('/');
    
    const partyInfo = await page.evaluate(async () => {
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
      
      const partyData = await response.json();
      
      // Get full party info
      response = await fetch(`/api/party/${partyData.code}`, {
        headers: {
          'Authorization': `Bearer ${hostData.token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    });
    
    expect(partyInfo).not.toBeNull();
    expect(partyInfo.code).toBeTruthy();
    expect(partyInfo.djName).toBeTruthy();
    
    console.log('✓ Party info validated:', {
      code: partyInfo.code,
      djName: partyInfo.djName
    });
    
    await takeScreenshot(page, 'party_info_display');
  });
});
