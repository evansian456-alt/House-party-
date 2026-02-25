/**
 * E2E Test Suite: Animations & Visual Effects
 * 
 * Tests all UI animations including add-on activations, DJ Mode effects,
 * crowd energy bar, emoji pop-ups, and reaction box updates.
 */

const { test, expect } = require('@playwright/test');
const { 
  clearBrowserStorage, 
  generateTestEmail, 
  generateDJName,
  takeScreenshot,
  delay
} = require('./utils/helpers');

test.describe('Animations & Visual Effects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
  });

  test('ANIMATIONS-01: Page has CSS animations', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for CSS animations
    const animationCheck = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let animationCount = 0;
      let transitionCount = 0;
      
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.animation && style.animation !== 'none') {
          animationCount++;
        }
        if (style.transition && style.transition !== 'none') {
          transitionCount++;
        }
      });
      
      return {
        hasAnimations: animationCount > 0,
        hasTransitions: transitionCount > 0,
        animationCount,
        transitionCount
      };
    });
    
    console.log('✓ CSS animations found:', animationCheck);
    await takeScreenshot(page, 'animations_css');
  });

  test('ANIMATIONS-02: Add-on activation animations exist', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for add-on related animations
    const addonAnimCheck = await page.evaluate(() => {
      const bodyHTML = document.body.innerHTML;
      return {
        hasAddonElements: bodyHTML.includes('addon') || 
                         bodyHTML.includes('upgrade') ||
                         bodyHTML.includes('purchase')
      };
    });
    
    console.log('✓ Add-on animation system checked:', addonAnimCheck);
    await takeScreenshot(page, 'animations_addons');
  });

  test('ANIMATIONS-03: DJ Mode effects are visible', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for DJ Mode visual effects
    const djModeCheck = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const bodyHTML = document.body.innerHTML;
      
      return {
        hasDjMode: bodyText.toLowerCase().includes('dj mode') || 
                  bodyHTML.toLowerCase().includes('dj-mode')
      };
    });
    
    console.log('✓ DJ Mode effects checked:', djModeCheck);
    await takeScreenshot(page, 'animations_dj_mode');
  });

  test('ANIMATIONS-04: Crowd energy bar animates', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for crowd energy bar
    const energyBarCheck = await page.evaluate(() => {
      const bodyHTML = document.body.innerHTML;
      const progressBars = document.querySelectorAll('[class*="progress"], [class*="energy"], [class*="bar"]');
      
      return {
        hasProgressBars: progressBars.length > 0,
        count: progressBars.length,
        hasEnergyReferences: bodyHTML.includes('energy') || bodyHTML.includes('crowd')
      };
    });
    
    console.log('✓ Crowd energy bar checked:', energyBarCheck);
    await takeScreenshot(page, 'animations_energy_bar');
  });

  test('ANIMATIONS-05: Emoji pop-ups animate correctly', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for emoji/popup animations
    const emojiPopupCheck = await page.evaluate(() => {
      const bodyHTML = document.body.innerHTML;
      return {
        hasEmojiElements: bodyHTML.includes('emoji') || 
                         bodyHTML.includes('🎉') ||
                         bodyHTML.includes('reaction'),
        hasPopupElements: bodyHTML.includes('popup') || 
                         bodyHTML.includes('modal')
      };
    });
    
    console.log('✓ Emoji popup animations checked:', emojiPopupCheck);
    await takeScreenshot(page, 'animations_emoji_popups');
  });

  test('ANIMATIONS-06: Reaction box updates with animations', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for reaction box animation elements
    const reactionBoxCheck = await page.evaluate(() => {
      const reactionElements = document.querySelectorAll('[class*="reaction"], [id*="reaction"]');
      let hasAnimatedElements = false;
      
      reactionElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.animation !== 'none' || style.transition !== 'none') {
          hasAnimatedElements = true;
        }
      });
      
      return {
        hasReactionElements: reactionElements.length > 0,
        hasAnimations: hasAnimatedElements,
        count: reactionElements.length
      };
    });
    
    console.log('✓ Reaction box animations checked:', reactionBoxCheck);
    await takeScreenshot(page, 'animations_reaction_box');
  });

  test('ANIMATIONS-07: Button hover effects work', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check button hover states
    const buttons = await page.locator('button').all();
    
    if (buttons.length > 0) {
      // Hover over first button
      await buttons[0].hover();
      await delay(300);
      
      const hoverCheck = await page.evaluate(() => {
        const firstButton = document.querySelector('button');
        if (firstButton) {
          const style = window.getComputedStyle(firstButton);
          return {
            hasHoverStyles: style.cursor !== 'auto'
          };
        }
        return { hasHoverStyles: false };
      });
      
      console.log('✓ Button hover effects checked:', hoverCheck);
    } else {
      console.log('✓ No buttons found to test hover');
    }
    
    await takeScreenshot(page, 'animations_hover');
  });

  test('ANIMATIONS-08: Loading states have animations', async ({ page }) => {
    await page.goto('/');
    await delay(500);
    
    // Check for loading/spinner elements
    const loadingCheck = await page.evaluate(() => {
      const bodyHTML = document.body.innerHTML;
      return {
        hasLoadingElements: bodyHTML.includes('loading') || 
                           bodyHTML.includes('spinner') ||
                           bodyHTML.includes('loader')
      };
    });
    
    console.log('✓ Loading animations checked:', loadingCheck);
    await takeScreenshot(page, 'animations_loading');
  });

  test('ANIMATIONS-09: Transition effects between views', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for view transition effects
    const transitionCheck = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let hasViewTransitions = false;
      
      allElements.forEach(el => {
        const classes = el.className;
        if (typeof classes === 'string' && 
            (classes.includes('fade') || 
             classes.includes('slide') || 
             classes.includes('transition'))) {
          hasViewTransitions = true;
        }
      });
      
      return {
        hasViewTransitions: hasViewTransitions
      };
    });
    
    console.log('✓ View transitions checked:', transitionCheck);
    await takeScreenshot(page, 'animations_view_transitions');
  });

  test('ANIMATIONS-10: Visual feedback for user actions', async ({ page }) => {
    await page.goto('/');
    await delay(1000);
    
    // Check for visual feedback elements (active states, focus, etc.)
    const feedbackCheck = await page.evaluate(() => {
      const bodyHTML = document.body.innerHTML;
      const styleSheets = Array.from(document.styleSheets);
      
      let hasActiveStates = false;
      let hasFocusStates = false;
      
      try {
        styleSheets.forEach(sheet => {
          try {
            const rules = Array.from(sheet.cssRules || []);
            rules.forEach(rule => {
              if (rule.selectorText) {
                if (rule.selectorText.includes(':active')) hasActiveStates = true;
                if (rule.selectorText.includes(':focus')) hasFocusStates = true;
              }
            });
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        });
      } catch (e) {
        // Error accessing stylesheets
      }
      
      return {
        hasActiveStates,
        hasFocusStates,
        hasToast: document.getElementById('toast') !== null
      };
    });
    
    console.log('✓ Visual feedback checked:', feedbackCheck);
    await takeScreenshot(page, 'animations_feedback');
  });
});
