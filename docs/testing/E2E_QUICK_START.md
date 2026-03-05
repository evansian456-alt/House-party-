# Quick Start Guide - Comprehensive E2E Tests

## What This Test Suite Does

Simulates a **real user** going through the entire Phone Party app:
1. Starting app for the first time
2. Trying all 3 tiers (Free, Party Pass, Pro Monthly)
3. Buying ALL add-ons and extras
4. Creating parties and inviting guests
5. Testing music sync across devices
6. Using messaging features
7. Earning scores and ranking up
8. Testing with up to 10 guests

## Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

## Running Tests

### Quick Test (Journey 1 only - ~2 minutes)
```bash
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --project=chromium --grep "Journey 1"
```

### Full Comprehensive Test (~15-20 minutes)
```bash
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --project=chromium
```

### Run Specific Journey
```bash
# Journey 2: Party Pass
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --grep "Journey 2"

# Journey 5: Music Sync
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --grep "Journey 5"

# Journey 9: Scale Test (10 guests)
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --grep "Journey 9"
```

### Watch Tests Run in Browser
```bash
npm run test:e2e:headed -- e2e-tests/16-comprehensive-user-journey.spec.js --project=chromium --grep "Journey 1"
```

### Debug a Specific Test
```bash
npm run test:e2e:ui -- e2e-tests/16-comprehensive-user-journey.spec.js
```

## What Gets Tested

### ✅ Journey 1: Free Mode
- Landing page
- Free tier selection
- Account creation
- Party creation
- DJ controls
- Free tier limits

### ✅ Journey 2: Party Pass (£3.99)
- Purchase flow
- 4 phones limit
- 2 hours duration
- Messaging features

### ✅ Journey 3: Pro Monthly (£9.99/month)
- Subscription flow
- 10 phones limit
- Unlimited time
- Premium features

### ✅ Journey 4: All Add-ons
**17 items tested:**
- 3 Visual Packs (Neon, Club, Pulse)
- 4 DJ Titles (Rising, Club, Superstar, Legend)
- 4 Profile Upgrades (Verified, Crown, Animated, Trail)
- 2 Party Extensions (30min, 5 phones)
- 4 Hype Effects (Confetti, Laser, Roar, Fireworks)

### ✅ Journey 5: Music Sync
- Host + 2 guests
- Music synchronization
- Playback controls
- Multi-device state

### ✅ Journey 6: Messaging
- Host messages
- Guest reactions
- Real-time sync
- Emoji system

### ✅ Journey 7: Scoring
- Earning points
- Leaderboard
- Profile saves
- Rank progression

### ✅ Journey 8: Guest Experience
- Join without account
- Limited controls
- Reactions
- See leaderboard

### ✅ Journey 9: Scale Test
- 1 host + 10 guests
- Simultaneous reactions
- Party stability
- State consistency

## Test Results Location

```
e2e-tests/
├── screenshots/          # Visual evidence of tests
├── test-results/         # Detailed test output
│   ├── traces/          # Playwright traces
│   ├── videos/          # Test recordings
│   └── screenshots/     # Failure screenshots
└── playwright-report/    # HTML report
```

## View Test Report

```bash
npm run test:e2e:report
```

## Common Issues

### "Executable doesn't exist" Error
```bash
npx playwright install chromium
```

### Tests Timeout
- Increase timeout in test
- Check if server is running
- Look for database connection errors (these are expected in test environment)

### Database Errors
Normal! Tests run without PostgreSQL/Redis. The app has fallback behavior.

## Understanding Test Output

✅ **✓** = Test Passed
⚠️ **⚠** = Test Flaky (passed on retry)  
❌ **✗** = Test Failed

### Example Output
```
✓  Journey 1.1 - New user sees landing page (1.8s)
✓  Journey 1.2 - User selects Free tier (2.1s)
✓  Journey 1.3 - User creates account (2.5s)
```

## Screenshots

Every test captures screenshots at key moments:
- `journey1-landing-page.png` - Initial view
- `journey2-party-pass-purchased.png` - After purchase
- `journey5-music-sync-host.png` - Host view
- `journey9-simultaneous-reactions.png` - 10 guests

## Performance

| Journey | Tests | Duration | Browsers |
|---------|-------|----------|----------|
| Journey 1 | 6 | ~2 min | 1 |
| Journey 2 | 4 | ~1 min | 1 |
| Journey 3 | 3 | ~1 min | 1 |
| Journey 4 | 7 | ~2 min | 1 |
| Journey 5 | 5 | ~3 min | 3 |
| Journey 6 | 3 | ~2 min | 2 |
| Journey 7 | 5 | ~3 min | 3 |
| Journey 8 | 4 | ~1 min | 1 |
| Journey 9 | 5 | ~4 min | 11 |
| **Total** | **42** | **~20 min** | **25** |

## CI/CD Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run Comprehensive E2E Tests
  run: npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --project=chromium
  
- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      test-results/
      playwright-report/
      e2e-tests/screenshots/
```

## Need Help?

1. Check `docs/COMPREHENSIVE_E2E_TEST_REPORT.md` for details
2. View traces: `npx playwright show-trace test-results/[trace-file].zip`
3. Run with UI mode: `npm run test:e2e:ui`
4. Enable debug mode: `DEBUG=pw:api npm run test:e2e`

## Summary

This test suite provides **complete coverage** of the Phone Party app as if a real user was testing every feature, button, and purchase flow from scratch.

**Total Coverage:**
- 9 User Journeys
- 42 Individual Tests  
- 3 Pricing Tiers
- 17 Purchasable Items
- Multi-device scenarios (up to 11 browsers)
- All major features

**Time Investment:** 20 minutes for full suite
**Value:** Complete confidence in app functionality
