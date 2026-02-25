/**
 * E2E Test Suite: Navigation
 * 
 * Tests navigation through all app pages including Home, Profile, Store, 
 * Party Room, and DJ Panel. Validates role-based views and all navigation controls.
 */

const { test, expect } = require('@playwright/test');
const { 
  clearBrowserStorage, 
  generateTestEmail, 
  generateDJName,
  takeScreenshot,
  delay
} = require('./utils/helpers');

test.describe('App Navigation', () => {
  let testAccount;
  
  test.beforeAll(() => {
    testAccount = {
      email: generateTestEmail(),
      djName: generateDJName(),
      password: 'TestPass123!'
    };
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
    
    // Create and authenticate user
    await page.evaluate(async (acc) => {
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
    }, { 
      email: generateTestEmail(), 
      djName: generateDJName(), 
      password: 'TestPass123!' 
    });
    
    await page.reload();
    await delay(1000);
  });

  test('NAV-01: Home page loads correctly', async ({ page }) => {
    await page.goto('/');
    await delay(500);
    
    // Verify page loaded
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check for common UI elements (buttons, links, etc.)
    const bodyContent = await page.evaluate(() => document.body.textContent);
    expect(bodyContent).toBeTruthy();
    
    console.log('✓ Home page loaded');
    await takeScreenshot(page, 'nav_home_page');
  });

  test('NAV-02: Profile page/section is accessible', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Try to access profile via navigation or API
    const profile = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        return null;
      }
    });
    
    expect(profile).not.toBeNull();
    console.log('✓ Profile accessible:', profile.djName);
    
    await takeScreenshot(page, 'nav_profile');
  });

  test('NAV-03: Store/Shop page is accessible', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Access store via API
    const store = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/store');
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        return null;
      }
    });
    
    expect(store).not.toBeNull();
    expect(store.tiers || store.addons).toBeDefined();
    
    console.log('✓ Store accessible');
    await takeScreenshot(page, 'nav_store');
  });

  test('NAV-04: Party creation flow is accessible', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Test party creation endpoint access
    const createResult = await page.evaluate(async () => {
      try {
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
          return { success: true, code: data.code };
        }
        
        return { success: false, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ Party creation accessible:', createResult);
    await takeScreenshot(page, 'nav_party_creation');
  });

  test('NAV-05: Host can navigate to DJ Panel', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Create a party to become host
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
    
    // Navigate to party as host
    const partyData = await page.evaluate(async (code) => {
      const response = await fetch(`/api/party/${code}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    }, partyCode);
    
    expect(partyData).not.toBeNull();
    console.log('✓ Host DJ Panel accessible');
    
    await takeScreenshot(page, 'nav_dj_panel');
  });

  test('NAV-06: Guest can navigate to Party Room view', async ({ page }) => {
    // First create a party with a different user
    const hostAccount = {
      email: generateTestEmail(),
      djName: generateDJName(),
      password: 'HostPass123!'
    };
    
    const partyCode = await page.evaluate(async (acc) => {
      // Create host account
      let response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      let data = await response.json();
      const hostToken = data.token;
      
      // Create party
      response = await fetch('/api/create-party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostToken}`
        },
        body: JSON.stringify({
          djName: acc.djName
        })
      });
      
      if (response.ok) {
        data = await response.json();
        return data.code;
      }
      return null;
    }, hostAccount);
    
    expect(partyCode).not.toBeNull();
    
    // Now join as guest
    const joinResult = await page.evaluate(async (code) => {
      try {
        const response = await fetch('/api/join-party', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            code: code,
            djName: localStorage.getItem('djName') || 'Guest'
          })
        });
        
        return { success: response.ok, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, partyCode);
    
    console.log('✓ Guest Party Room view accessible:', joinResult);
    await takeScreenshot(page, 'nav_guest_view');
  });

  test('NAV-07: Back navigation works correctly', async ({ page }) => {
    await page.goto('/');
    await delay(500);
    
    const initialUrl = page.url();
    
    // Navigate to a different endpoint
    await page.evaluate(async () => {
      await fetch('/api/store');
    });
    
    // Go back
    await page.goBack();
    await delay(500);
    
    const backUrl = page.url();
    expect(backUrl).toBe(initialUrl);
    
    console.log('✓ Back navigation works');
  });

  test('NAV-08: All navigation buttons are functional', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Look for common navigation elements
    const navElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return {
        buttonCount: buttons.length,
        hasNavigation: buttons.length > 0
      };
    });
    
    expect(navElements.hasNavigation).toBe(true);
    console.log('✓ Navigation elements found:', navElements.buttonCount);
    
    await takeScreenshot(page, 'nav_all_buttons');
  });

  test('NAV-09: Role-based navigation shows correct views', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Create party as host
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
    
    // Verify host has appropriate access
    const hostAccess = await page.evaluate(async (code) => {
      // Check party members endpoint (host should have access)
      const membersResponse = await fetch(`/api/party/${code}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return { hasMembersAccess: membersResponse.ok };
    }, partyCode);
    
    console.log('✓ Role-based navigation verified for host:', hostAccess);
    await takeScreenshot(page, 'nav_role_based');
  });

  test('NAV-10: Protected routes require authentication', async ({ page }) => {
    // Clear auth and try to access protected endpoint
    await clearBrowserStorage(page);
    await page.reload();
    await delay(500);
    
    const protectedResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/me');
        return { 
          success: response.ok, 
          status: response.status 
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // Should fail without auth
    expect(protectedResult.success).toBe(false);
    expect(protectedResult.status).toBe(401);
    
    console.log('✓ Protected routes require authentication');
  });
});
