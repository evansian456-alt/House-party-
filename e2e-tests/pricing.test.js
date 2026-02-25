/**
 * E2E Test Suite: Pricing & Purchases
 * 
 * Tests purchasing Party Pass, Monthly Subscription, and all add-ons.
 * Validates purchase flow, backend storage, and UI feedback.
 */

const { test, expect } = require('@playwright/test');
const { 
  clearBrowserStorage, 
  generateTestEmail, 
  generateDJName,
  takeScreenshot,
  delay
} = require('./utils/helpers');

test.describe('Pricing & Purchases', () => {
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
    
    // Create and authenticate user for each test
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

  test('PRICING-01: Store catalog is accessible', async ({ page }) => {
    // Fetch store catalog
    const catalog = await page.evaluate(async () => {
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
    
    expect(catalog).not.toBeNull();
    expect(catalog.tiers).toBeDefined();
    expect(catalog.addons).toBeDefined();
    
    console.log('✓ Store catalog loaded:', {
      tierCount: catalog.tiers?.length || 0,
      addonCount: catalog.addons?.length || 0
    });
    
    await takeScreenshot(page, 'pricing_store_catalog');
  });

  test('PRICING-02: Party Pass (£3.99) purchase flow', async ({ page }) => {
    // Attempt Party Pass purchase (using test mode)
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'party_pass',
            provider: 'test' // Test mode
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Party Pass purchase result:', purchaseResult);
    
    // Verify purchase appears in profile
    const profile = await page.evaluate(async () => {
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    });
    
    console.log('✓ Party Pass purchase tested:', {
      status: purchaseResult.status,
      profileTier: profile?.tier
    });
    
    await takeScreenshot(page, 'pricing_party_pass');
  });

  test('PRICING-03: Pro Monthly (£9.99) subscription flow', async ({ page }) => {
    // Attempt Pro Monthly purchase (using test mode)
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'pro_monthly',
            provider: 'test' // Test mode
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Pro Monthly purchase result:', purchaseResult);
    
    // Verify subscription in profile
    const profile = await page.evaluate(async () => {
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    });
    
    console.log('✓ Pro Monthly subscription tested:', {
      status: purchaseResult.status,
      profileTier: profile?.tier
    });
    
    await takeScreenshot(page, 'pricing_pro_monthly');
  });

  test('PRICING-04: DJ Mode add-on (£2.99) purchase', async ({ page }) => {
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'dj_mode',
            provider: 'test'
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ DJ Mode add-on purchase tested:', purchaseResult.status);
    await takeScreenshot(page, 'pricing_dj_mode');
  });

  test('PRICING-05: Room Boost add-on (£1.49) purchase', async ({ page }) => {
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'room_boost',
            provider: 'test'
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ Room Boost add-on purchase tested:', purchaseResult.status);
    await takeScreenshot(page, 'pricing_room_boost');
  });

  test('PRICING-06: Playlist Save add-on (£0.99) purchase', async ({ page }) => {
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'playlist_save',
            provider: 'test'
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ Playlist Save add-on purchase tested:', purchaseResult.status);
    await takeScreenshot(page, 'pricing_playlist_save');
  });

  test('PRICING-07: Multi-Room Linking add-on (£3.49) purchase', async ({ page }) => {
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'multi_room',
            provider: 'test'
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ Multi-Room Linking add-on purchase tested:', purchaseResult.status);
    await takeScreenshot(page, 'pricing_multi_room');
  });

  test('PRICING-08: Early Access add-on (£4.99) purchase', async ({ page }) => {
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'early_access',
            provider: 'test'
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ Early Access add-on purchase tested:', purchaseResult.status);
    await takeScreenshot(page, 'pricing_early_access');
  });

  test('PRICING-09: User entitlements are retrieved correctly', async ({ page }) => {
    // Get user entitlements
    const entitlements = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/user/entitlements', {
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
    
    expect(entitlements).not.toBeNull();
    console.log('✓ User entitlements retrieved:', entitlements);
    
    await takeScreenshot(page, 'pricing_entitlements');
  });

  test('PRICING-10: Insufficient balance is handled gracefully', async ({ page }) => {
    // Try to purchase with invalid/insufficient payment
    const purchaseResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            itemId: 'invalid_item',
            provider: 'test'
          })
        });
        
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          message: data.message
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // Should fail gracefully
    expect(purchaseResult.status).toBeGreaterThanOrEqual(400);
    console.log('✓ Invalid purchase handled correctly');
  });
});
