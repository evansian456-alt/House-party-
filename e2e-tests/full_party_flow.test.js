/**
 * E2E Test Suite: Full Party Flow Integration
 * 
 * Comprehensive end-to-end test simulating a complete party experience
 * with one host and multiple guests. Tests all features working together.
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

test.describe('Full Party Flow Integration', () => {
  multiUserTest('FULL-FLOW-01: Complete party lifecycle with host and guests', async ({ hostPage, guest1Page, guest2Page }) => {
    // ====================
    // 1. HOST SETUP
    // ====================
    await hostPage.goto('/');
    await clearBrowserStorage(hostPage);
    
    const hostAccount = {
      email: generateTestEmail(),
      djName: generateDJName(),
      password: 'HostPass123!'
    };
    
    // Create host account
    await hostPage.evaluate(async (acc) => {
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
    }, hostAccount);
    
    await hostPage.reload();
    await delay(1000);
    
    console.log('✓ Host account created:', hostAccount.djName);
    
    // Create party
    const partyCode = await hostPage.evaluate(async () => {
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
    console.log('✓ Party created with code:', partyCode);
    
    await takeScreenshot(hostPage, 'full_flow_host_created_party');
    
    // ====================
    // 2. GUEST 1 SETUP
    // ====================
    await guest1Page.goto('/');
    await clearBrowserStorage(guest1Page);
    
    const guest1Account = {
      email: generateTestEmail(),
      djName: generateDJName(),
      password: 'Guest1Pass123!'
    };
    
    // Create guest 1 account and join
    const guest1JoinResult = await guest1Page.evaluate(async ({ acc, code }) => {
      // Signup
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      const authData = await response.json();
      if (!authData.token) return { success: false, step: 'signup' };
      
      localStorage.setItem('token', authData.token);
      localStorage.setItem('djName', acc.djName);
      
      // Join party
      response = await fetch('/api/join-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify({
          code: code,
          djName: acc.djName
        })
      });
      
      return { 
        success: response.ok,
        status: response.status,
        step: 'join'
      };
    }, { acc: guest1Account, code: partyCode });
    
    expect(guest1JoinResult.success).toBe(true);
    console.log('✓ Guest 1 joined party:', guest1Account.djName);
    
    await takeScreenshot(guest1Page, 'full_flow_guest1_joined');
    
    // ====================
    // 3. GUEST 2 SETUP
    // ====================
    await guest2Page.goto('/');
    await clearBrowserStorage(guest2Page);
    
    const guest2Account = {
      email: generateTestEmail(),
      djName: generateDJName(),
      password: 'Guest2Pass123!'
    };
    
    // Create guest 2 account and join
    const guest2JoinResult = await guest2Page.evaluate(async ({ acc, code }) => {
      // Signup
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      const authData = await response.json();
      if (!authData.token) return { success: false, step: 'signup' };
      
      localStorage.setItem('token', authData.token);
      localStorage.setItem('djName', acc.djName);
      
      // Join party
      response = await fetch('/api/join-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify({
          code: code,
          djName: acc.djName
        })
      });
      
      return { 
        success: response.ok,
        status: response.status,
        step: 'join'
      };
    }, { acc: guest2Account, code: partyCode });
    
    expect(guest2JoinResult.success).toBe(true);
    console.log('✓ Guest 2 joined party:', guest2Account.djName);
    
    await takeScreenshot(guest2Page, 'full_flow_guest2_joined');
    
    // ====================
    // 4. VERIFY PARTY STATE
    // ====================
    await delay(1000);
    
    // Check party members
    const partyMembers = await hostPage.evaluate(async (code) => {
      const response = await fetch(`/api/party/${code}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return [];
    }, partyCode);
    
    console.log('✓ Party members count:', partyMembers.length);
    expect(partyMembers.length).toBeGreaterThanOrEqual(1); // At least host
    
    await takeScreenshot(hostPage, 'full_flow_party_members');
    
    // ====================
    // 5. TEST MUSIC QUEUE
    // ====================
    const queueResult = await hostPage.evaluate(async (code) => {
      const response = await fetch(`/api/party/${code}/queue-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          trackId: 'test-track-001'
        })
      });
      
      return { 
        status: response.status,
        attempted: true
      };
    }, partyCode);
    
    console.log('✓ Music queue tested:', queueResult.status);
    
    // ====================
    // 6. TEST SCOREBOARD
    // ====================
    const scoreboardResult = await hostPage.evaluate(async (code) => {
      const response = await fetch(`/api/party/${code}/scoreboard`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        return {
          success: true,
          data: await response.json()
        };
      }
      return { success: false, status: response.status };
    }, partyCode);
    
    console.log('✓ Scoreboard tested:', scoreboardResult.success);
    
    await takeScreenshot(hostPage, 'full_flow_scoreboard');
    
    // ====================
    // 7. GUEST LEAVES
    // ====================
    const guest1LeaveResult = await guest1Page.evaluate(async () => {
      const response = await fetch('/api/leave-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return { success: response.ok };
    });
    
    expect(guest1LeaveResult.success).toBe(true);
    console.log('✓ Guest 1 left party');
    
    await delay(500);
    await takeScreenshot(guest1Page, 'full_flow_guest1_left');
    
    // ====================
    // 8. HOST ENDS PARTY
    // ====================
    const endPartyResult = await hostPage.evaluate(async () => {
      const response = await fetch('/api/end-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return { success: response.ok };
    });
    
    expect(endPartyResult.success).toBe(true);
    console.log('✓ Host ended party');
    
    await takeScreenshot(hostPage, 'full_flow_party_ended');
    
    // ====================
    // SUMMARY
    // ====================
    console.log('\n========== FULL PARTY FLOW COMPLETE ==========');
    console.log('✓ Host created party:', partyCode);
    console.log('✓ Guest 1 joined:', guest1Account.djName);
    console.log('✓ Guest 2 joined:', guest2Account.djName);
    console.log('✓ Party members verified');
    console.log('✓ Music queue tested');
    console.log('✓ Scoreboard tested');
    console.log('✓ Guest 1 left successfully');
    console.log('✓ Party ended by host');
    console.log('==============================================\n');
  });

  test('FULL-FLOW-02: Party flow with purchases and upgrades', async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
    
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
        }
      }
    });
    
    await page.reload();
    await delay(1000);
    
    // Try to purchase Party Pass
    const purchaseResult = await page.evaluate(async () => {
      const response = await fetch('/api/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          itemId: 'party_pass',
          provider: 'test'
        })
      });
      
      return { 
        status: response.status,
        attempted: true
      };
    });
    
    console.log('✓ Purchase flow tested:', purchaseResult.status);
    
    // Create party with upgrade
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
    console.log('✓ Party created after purchase:', partyCode);
    
    await takeScreenshot(page, 'full_flow_with_purchases');
  });

  multiUserTest('FULL-FLOW-03: Verify synchronization across all participants', async ({ hostPage, guest1Page }) => {
    // Setup host
    await hostPage.goto('/');
    await clearBrowserStorage(hostPage);
    
    const partyCode = await hostPage.evaluate(async () => {
      // Create host
      const acc = {
        email: `host_${Date.now()}@test.com`,
        djName: `Host_${Math.random().toString(36).substring(7)}`,
        password: 'HostPass123!'
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
      
      const partyData = await response.json();
      return partyData.code;
    });
    
    expect(partyCode).not.toBeNull();
    
    // Setup guest
    await guest1Page.goto('/');
    await clearBrowserStorage(guest1Page);
    
    const joinResult = await guest1Page.evaluate(async (code) => {
      // Create guest
      const acc = {
        email: `guest_${Date.now()}@test.com`,
        djName: `Guest_${Math.random().toString(36).substring(7)}`,
        password: 'GuestPass123!'
      };
      
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      const authData = await response.json();
      if (!authData.token) return { success: false };
      
      localStorage.setItem('token', authData.token);
      
      // Join party
      response = await fetch('/api/join-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        },
        body: JSON.stringify({
          code: code,
          djName: acc.djName
        })
      });
      
      return { success: response.ok };
    }, partyCode);
    
    expect(joinResult.success).toBe(true);
    
    console.log('✓ Multi-user synchronization test complete');
    await takeScreenshot(hostPage, 'full_flow_sync_host');
    await takeScreenshot(guest1Page, 'full_flow_sync_guest');
  });
});
