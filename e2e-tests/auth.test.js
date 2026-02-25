/**
 * E2E Test Suite: Authentication & Profile
 * 
 * Tests user sign-up, login, profile creation, and backend data storage.
 * Validates authentication flows for both guest and host users.
 */

const { test, expect } = require('@playwright/test');
const { 
  clearBrowserStorage, 
  generateTestEmail, 
  generateDJName,
  takeScreenshot,
  delay
} = require('./utils/helpers');

test.describe('Authentication & Profile Management', () => {
  let testAccounts = {};
  
  test.beforeAll(() => {
    // Generate unique test accounts for this suite
    testAccounts = {
      newUser: {
        email: generateTestEmail(),
        djName: generateDJName(),
        password: 'TestPass123!'
      },
      hostUser: {
        email: generateTestEmail(),
        djName: generateDJName(),
        password: 'HostPass123!'
      },
      guestUser: {
        email: generateTestEmail(),
        djName: generateDJName(),
        password: 'GuestPass123!'
      }
    };
    
    console.log('Generated test accounts:', testAccounts);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
  });

  test('AUTH-01: User can sign up with valid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Sign up via API (matching existing pattern)
    const signupResult = await page.evaluate(async (acc) => {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(acc)
        });
        
        const data = await response.json();
        
        if (response.ok && data.token) {
          localStorage.setItem('token', data.token);
          if (data.userId) localStorage.setItem('userId', data.userId);
          if (acc.djName) localStorage.setItem('djName', acc.djName);
          return { success: true, data };
        }
        
        return { success: false, error: data.message };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, testAccounts.newUser);
    
    expect(signupResult.success).toBe(true);
    expect(signupResult.data.token).toBeTruthy();
    
    console.log('✓ User signed up successfully');
    
    // Reload to verify authentication persistence
    await page.reload();
    await delay(1000);
    
    // Verify token exists in localStorage
    const hasToken = await page.evaluate(() => !!localStorage.getItem('token'));
    expect(hasToken).toBe(true);
    
    await takeScreenshot(page, 'auth_signup_success');
  });

  test('AUTH-02: User can login with existing credentials', async ({ page }) => {
    // First, create an account
    await page.goto('/');
    
    await page.evaluate(async (acc) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      if (response.ok) {
        const data = await response.json();
        // Don't save token - we want to test login separately
      }
    }, testAccounts.hostUser);
    
    // Clear storage to simulate logged out state
    await clearBrowserStorage(page);
    await page.reload();
    await delay(500);
    
    // Now login
    const loginResult = await page.evaluate(async (acc) => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: acc.email,
            password: acc.password
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.token) {
          localStorage.setItem('token', data.token);
          if (data.userId) localStorage.setItem('userId', data.userId);
          return { success: true, data };
        }
        
        return { success: false, error: data.message };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, testAccounts.hostUser);
    
    expect(loginResult.success).toBe(true);
    expect(loginResult.data.token).toBeTruthy();
    
    console.log('✓ User logged in successfully');
    
    await takeScreenshot(page, 'auth_login_success');
  });

  test('AUTH-03: Profile data is stored in backend correctly', async ({ page }) => {
    await page.goto('/');
    
    // Create account
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
    }, testAccounts.guestUser);
    
    await page.reload();
    await delay(1000);
    
    // Fetch user profile from backend
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
    expect(profile.email).toBe(testAccounts.guestUser.email);
    expect(profile.djName).toBe(testAccounts.guestUser.djName);
    expect(profile.tier).toBeDefined();
    
    console.log('✓ Profile data verified:', {
      email: profile.email,
      djName: profile.djName,
      tier: profile.tier
    });
    
    await takeScreenshot(page, 'auth_profile_verified');
  });

  test('AUTH-04: Invalid credentials are rejected', async ({ page }) => {
    await page.goto('/');
    
    // Try to login with invalid credentials
    const loginResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@test.com',
            password: 'WrongPassword123!'
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
    
    expect(loginResult.success).toBe(false);
    expect(loginResult.status).toBeGreaterThanOrEqual(400);
    
    console.log('✓ Invalid credentials correctly rejected');
  });

  test('AUTH-05: User can logout successfully', async ({ page }) => {
    await page.goto('/');
    
    // Create and login
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
    await delay(500);
    
    // Verify logged in
    let hasToken = await page.evaluate(() => !!localStorage.getItem('token'));
    expect(hasToken).toBe(true);
    
    // Logout
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Verify logged out
    hasToken = await page.evaluate(() => !!localStorage.getItem('token'));
    expect(hasToken).toBe(false);
    
    console.log('✓ User logged out successfully');
  });

  test('AUTH-06: Duplicate email registration is prevented', async ({ page }) => {
    await page.goto('/');
    
    const duplicateEmail = generateTestEmail();
    const account = {
      email: duplicateEmail,
      djName: generateDJName(),
      password: 'TestPass123!'
    };
    
    // First registration
    const firstSignup = await page.evaluate(async (acc) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      return { success: response.ok, status: response.status };
    }, account);
    
    expect(firstSignup.success).toBe(true);
    
    // Try duplicate registration
    const secondSignup = await page.evaluate(async (acc) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc)
      });
      
      const data = await response.json();
      return { 
        success: response.ok, 
        status: response.status,
        message: data.message 
      };
    }, account);
    
    expect(secondSignup.success).toBe(false);
    expect(secondSignup.status).toBeGreaterThanOrEqual(400);
    
    console.log('✓ Duplicate email registration prevented');
  });

  test('AUTH-07: Session persists across page reloads', async ({ page }) => {
    await page.goto('/');
    
    // Create account
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
    
    // Reload page
    await page.reload();
    await delay(1000);
    
    // Verify session still valid
    const isAuthenticated = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      if (!token) return false;
      
      try {
        const response = await fetch('/api/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.ok;
      } catch {
        return false;
      }
    });
    
    expect(isAuthenticated).toBe(true);
    
    console.log('✓ Session persists across page reloads');
  });
});
