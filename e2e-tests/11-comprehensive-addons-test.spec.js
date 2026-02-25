/**
 * Comprehensive Add-on System Test
 * 
 * This test validates all add-on categories and their purchase flows:
 * 1. Visual Packs
 * 2. DJ Titles
 * 3. Profile Upgrades
 * 4. Party Extensions
 * 5. Hype Effects
 */

const { test, expect } = require('@playwright/test');

test.describe('Comprehensive Add-on System Test', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('1. Landing Page - Add-ons button exists and navigates correctly', async ({ page }) => {
    // Verify button exists
    const addonsBtn = page.locator('#btnLandingAddons');
    await expect(addonsBtn).toBeVisible();
    
    // Verify button text
    const text = await addonsBtn.textContent();
    expect(text).toContain('ADD-ONS');
    expect(text).toContain('BOOST YOUR PARTY');
    
    // Click and verify navigation
    await addonsBtn.click();
    await page.waitForTimeout(500);
    
    const upgradeHub = page.locator('#viewUpgradeHub');
    await expect(upgradeHub).toBeVisible();
    
    console.log('✓ Landing page add-ons button works correctly');
  });

  test('2. Upgrade Hub - All category buttons exist', async ({ page }) => {
    // Navigate to upgrade hub
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    // Verify all category buttons exist
    await expect(page.locator('#btnOpenVisualPacks')).toBeVisible();
    await expect(page.locator('#btnOpenProfileUpgrades')).toBeVisible();
    await expect(page.locator('#btnOpenDjTitles')).toBeVisible();
    await expect(page.locator('#btnOpenPartyExtensions')).toBeVisible();
    await expect(page.locator('#btnOpenHypeEffects')).toBeVisible();
    
    console.log('✓ All add-on category buttons exist');
  });

  test('3. Visual Packs - View opens and displays items', async ({ page }) => {
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    // Open Visual Packs
    await page.click('#btnOpenVisualPacks');
    await page.waitForTimeout(500);
    
    // Verify view is visible
    const visualPacksView = page.locator('#viewVisualPackStore');
    await expect(visualPacksView).toBeVisible();
    
    // Verify items exist
    await expect(page.locator('text=Neon Pack')).toBeVisible();
    await expect(page.locator('text=Club Pack')).toBeVisible();
    await expect(page.locator('text=Pulse Pack')).toBeVisible();
    
    // Verify prices are displayed
    await expect(page.locator('text=£3.99')).toBeVisible();
    
    // Verify back button works
    await page.click('#btnCloseVisualPacks');
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ Visual Packs view works correctly');
  });

  test('4. DJ Titles - View opens and displays items', async ({ page }) => {
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    // Open DJ Titles
    await page.click('#btnOpenDjTitles');
    await page.waitForTimeout(500);
    
    // Verify view is visible
    const djTitlesView = page.locator('#viewDjTitleStore');
    await expect(djTitlesView).toBeVisible();
    
    // Verify items exist
    await expect(page.locator('text=Rising DJ')).toBeVisible();
    await expect(page.locator('text=Club DJ')).toBeVisible();
    await expect(page.locator('text=Superstar DJ')).toBeVisible();
    await expect(page.locator('text=Legend DJ')).toBeVisible();
    
    // Verify back button works
    await page.click('#btnCloseDjTitles');
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ DJ Titles view works correctly');
  });

  test('5. Profile Upgrades - View opens and displays items', async ({ page }) => {
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    // Open Profile Upgrades
    await page.click('#btnOpenProfileUpgrades');
    await page.waitForTimeout(500);
    
    // Verify view is visible
    const profileUpgradesView = page.locator('#viewProfileUpgrades');
    await expect(profileUpgradesView).toBeVisible();
    
    // Verify items exist
    await expect(page.locator('text=Verified DJ Badge')).toBeVisible();
    await expect(page.locator('text=Crown Effect')).toBeVisible();
    await expect(page.locator('text=Animated Name')).toBeVisible();
    await expect(page.locator('text=Reaction Trail')).toBeVisible();
    
    // Verify back button works
    await page.click('#btnCloseProfileUpgrades');
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ Profile Upgrades view works correctly');
  });

  test('6. Party Extensions - View opens and displays items', async ({ page }) => {
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    // Open Party Extensions
    await page.click('#btnOpenPartyExtensions');
    await page.waitForTimeout(500);
    
    // Verify view is visible
    const partyExtensionsView = page.locator('#viewPartyExtensions');
    await expect(partyExtensionsView).toBeVisible();
    
    // Verify items exist
    await expect(page.locator('text=Add 30 Minutes')).toBeVisible();
    await expect(page.locator('text=Add 5 More Phones')).toBeVisible();
    
    // Verify back button works
    await page.click('#btnClosePartyExtensions');
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ Party Extensions view works correctly');
  });

  test('7. Hype Effects - View opens and displays items', async ({ page }) => {
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    // Open Hype Effects
    await page.click('#btnOpenHypeEffects');
    await page.waitForTimeout(500);
    
    // Verify view is visible
    const hypeEffectsView = page.locator('#viewHypeEffects');
    await expect(hypeEffectsView).toBeVisible();
    
    // Verify items exist
    await expect(page.locator('text=Confetti Blast')).toBeVisible();
    await expect(page.locator('text=Laser Show')).toBeVisible();
    await expect(page.locator('text=Crowd Roar')).toBeVisible();
    await expect(page.locator('text=Fireworks')).toBeVisible();
    
    // Verify prices
    await expect(page.locator('text=£0.49')).toBeVisible();
    await expect(page.locator('text=£0.99')).toBeVisible();
    
    // Verify back button works
    await page.click('#btnCloseHypeEffects');
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ Hype Effects view works correctly');
  });

  test('8. DJ View - Add-ons button accessible', async ({ page }) => {
    // Navigate to party/DJ view
    await page.evaluate(() => {
      if (window.showView) {
        window.showView('viewParty');
      }
    });
    await page.waitForTimeout(500);
    
    // Verify add-ons button exists
    const djAddonsBtn = page.locator('#btnDjAddons');
    await expect(djAddonsBtn).toBeVisible();
    
    // Click and verify navigation
    await djAddonsBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ DJ view add-ons button works correctly');
  });

  test('9. Guest View - Add-ons button accessible', async ({ page }) => {
    // Navigate to guest view
    await page.evaluate(() => {
      if (window.showView) {
        window.showView('viewGuest');
      }
    });
    await page.waitForTimeout(500);
    
    // Verify add-ons button exists
    const guestAddonsBtn = page.locator('#btnGuestAddons');
    await expect(guestAddonsBtn).toBeVisible();
    
    // Click and verify navigation
    await guestAddonsBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#viewUpgradeHub')).toBeVisible();
    
    console.log('✓ Guest view add-ons button works correctly');
  });

  test('10. All add-on categories have correct structure', async ({ page }) => {
    await page.click('#btnLandingAddons');
    await page.waitForTimeout(500);
    
    const categories = [
      { button: '#btnOpenVisualPacks', view: '#viewVisualPackStore', close: '#btnCloseVisualPacks', name: 'Visual Packs' },
      { button: '#btnOpenDjTitles', view: '#viewDjTitleStore', close: '#btnCloseDjTitles', name: 'DJ Titles' },
      { button: '#btnOpenProfileUpgrades', view: '#viewProfileUpgrades', close: '#btnCloseProfileUpgrades', name: 'Profile Upgrades' },
      { button: '#btnOpenPartyExtensions', view: '#viewPartyExtensions', close: '#btnClosePartyExtensions', name: 'Party Extensions' },
      { button: '#btnOpenHypeEffects', view: '#viewHypeEffects', close: '#btnCloseHypeEffects', name: 'Hype Effects' }
    ];
    
    for (const category of categories) {
      // Open category
      await page.click(category.button);
      await page.waitForTimeout(500);
      
      // Verify view is visible
      await expect(page.locator(category.view)).toBeVisible();
      
      // Verify has store items
      const items = await page.locator('.store-item').count();
      expect(items).toBeGreaterThan(0);
      
      // Go back
      await page.click(category.close);
      await page.waitForTimeout(500);
      
      console.log(`✓ ${category.name} has correct structure`);
    }
  });
});
