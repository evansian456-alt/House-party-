# E2E Test Suite Documentation

## Overview

This directory contains a comprehensive end-to-end test suite for the SyncSpeaker/Phone Party application. The tests are organized by feature area to ensure maintainability and CI/CD readiness.

## 🎯 New: Comprehensive User Journey Testing

**Complete end-to-end testing suite** that simulates a real user going through the entire app:
- **File:** `16-comprehensive-user-journey.spec.js`
- **Coverage:** All tiers, all purchases, all features, multi-device (up to 10 guests)
- **Duration:** ~20 minutes full run
- **Quick Start:** See [docs/E2E_QUICK_START.md](../docs/E2E_QUICK_START.md)
- **Full Report:** See [docs/COMPREHENSIVE_E2E_TEST_REPORT.md](../docs/COMPREHENSIVE_E2E_TEST_REPORT.md)

### Quick Run
```bash
# Run comprehensive test suite (Journey 1 - Free Mode)
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --project=chromium --grep "Journey 1"

# Run all journeys
npm run test:e2e -- e2e-tests/16-comprehensive-user-journey.spec.js --project=chromium
```

---

## Test Files

### 1. **auth.test.js** - Authentication & Profile Management
Tests user sign-up, login, profile creation, and authentication flows.

**Coverage:**
- User registration with valid credentials
- Login with existing credentials
- Profile data storage and retrieval
- Invalid credential handling
- Logout functionality
- Duplicate email prevention
- Session persistence
- Authentication requirements

**Run:** `npx playwright test auth.test.js`

### 2. **pricing.test.js** - Payment & Subscription Flows
Tests purchasing Party Pass, Monthly Subscription, and all add-ons.

**Coverage:**
- Store catalog accessibility
- Party Pass (£3.99) purchase
- Pro Monthly (£9.99) subscription
- DJ Mode (£2.99) add-on
- Room Boost (£1.49) add-on
- Playlist Save (£0.99) add-on
- Multi-Room Linking (£3.49) add-on
- Early Access (£4.99) add-on
- User entitlements retrieval
- Failed purchase handling

**Run:** `npx playwright test pricing.test.js`

### 3. **navigation.test.js** - App Navigation
Tests navigation through all app pages and role-based views.

**Coverage:**
- Home page loading
- Profile page accessibility
- Store/Shop page access
- Party creation flow
- DJ Panel navigation (host)
- Party Room view (guest)
- Back navigation
- Navigation buttons functionality
- Role-based navigation
- Protected routes authentication

**Run:** `npx playwright test navigation.test.js`

### 4. **party.test.js** - Party Management
Tests party creation, joining, leaving, and management.

**Coverage:**
- Host party creation
- Party room settings
- Guest joining with valid code
- Invalid party code rejection
- Guest leaving party
- Host ending party
- Party member count display
- Party info display

**Run:** `npx playwright test party.test.js`

### 5. **music.test.js** - Music Playback & Queue
Tests song queueing, playback controls, and synchronization.

**Coverage:**
- Host song queueing
- Guest song queueing (if allowed)
- Play control functionality
- Skip to next track
- Queue clearing
- Queue reordering
- Track removal
- DJ Mode effects
- Sync functionality
- Playback state retrieval

**Run:** `npx playwright test music.test.js`

### 6. **reactions.test.js** - Reactions & Crowd Energy
Tests emoji reactions, crowd energy, and leaderboard.

**Coverage:**
- Guest reactions incrementing crowd energy
- DJ reactions (no crowd energy)
- Reaction box display
- Leaderboard updates for guests
- Emoji pop-ups for guests only
- Reaction animations
- Live reaction feed
- Crowd energy milestones
- Guest leaderboard
- DJ leaderboard

**Run:** `npx playwright test reactions.test.js`

### 7. **messaging.test.js** - Chat & Notifications
Tests messaging and real-time notifications.

**Coverage:**
- Chat system existence
- DJ messaging capabilities
- Guest messaging (if enabled)
- Song change notifications
- User join notifications
- User leave notifications
- Crowd energy milestone notifications
- Toast notifications
- Message delivery reliability
- Chat history preservation

**Run:** `npx playwright test messaging.test.js`

### 8. **animations.test.js** - UI Animations & Effects
Tests all visual animations and effects.

**Coverage:**
- CSS animations presence
- Add-on activation animations
- DJ Mode visual effects
- Crowd energy bar animation
- Emoji pop-up animations
- Reaction box animations
- Button hover effects
- Loading state animations
- View transition effects
- Visual feedback for actions

**Run:** `npx playwright test animations.test.js`

### 9. **error_handling.test.js** - Error Scenarios & Edge Cases
Tests error handling and edge cases.

**Coverage:**
- Invalid login credentials
- Duplicate email registration
- Unauthorized access blocking
- Invalid party code rejection
- Failed purchase handling
- Missing field validation
- Rate limiting
- 404 errors
- Malformed JSON requests
- Role-based access restrictions

**Run:** `npx playwright test error_handling.test.js`

### 10. **full_party_flow.test.js** - Integration Tests
Comprehensive end-to-end tests simulating complete party flows.

**Coverage:**
- Complete party lifecycle (host + multiple guests)
- Party creation and joining
- Music queue testing
- Scoreboard validation
- Guest leaving
- Party ending
- Party flow with purchases
- Multi-user synchronization

**Run:** `npx playwright test full_party_flow.test.js`

### 11. **test_reporting.js** - Test Utilities
Utilities for test reporting, screenshots, and logging.

**Features:**
- Screenshot capture with metadata
- Error logging
- Test summary generation
- Video recording metadata
- Test step logging
- HTML report generation
- Auto-fix attempts

## Test Utilities

### Helper Functions (`utils/helpers.js`)

- `generateTestEmail()` - Generate unique test email
- `generateDJName()` - Generate unique DJ name
- `clearBrowserStorage()` - Clear all browser storage
- `takeScreenshot()` - Capture screenshot
- `waitForToast()` - Wait for toast notification
- `delay()` - Wait for specified time

### Fixtures (`utils/fixtures.js`)

Multi-session testing fixtures:
- `hostPage` - Host/DJ browser context
- `guest1Page` - Guest 1 browser context
- `guest2Page` - Guest 2 browser context

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npx playwright test auth.test.js
```

### Run with UI Mode
```bash
npm run test:e2e:ui
```

### Run in Headed Mode (see browser)
```bash
npm run test:e2e:headed
```

### View Test Report
```bash
npm run test:e2e:report
```

### Generate Custom Report
```bash
npm run test:e2e:generate-report
```

## Test Configuration

Tests are configured in `playwright.config.js`:

- **Test Directory:** `./e2e-tests`
- **Workers:** 1 (sequential for multi-user tests)
- **Base URL:** `http://localhost:8080`
- **Retries:** 2 on CI, 0 locally
- **Screenshots:** On failure
- **Video:** On failure
- **Trace:** On failure

## CI/CD Integration

The test suite is designed for CI/CD pipelines:

1. **Automatic Server Startup:** Tests start the dev server automatically
2. **Sequential Execution:** Multi-user tests run sequentially to avoid conflicts
3. **Retry Logic:** Automatic retries on CI for flaky tests
4. **Artifact Collection:** Screenshots, videos, and traces on failure
5. **Report Generation:** HTML and JSON reports

### GitHub Actions Example

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Writing New Tests

### Basic Test Structure

```javascript
const { test, expect } = require('@playwright/test');
const { 
  clearBrowserStorage, 
  generateTestEmail, 
  generateDJName,
  takeScreenshot,
  delay
} = require('./utils/helpers');

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearBrowserStorage(page);
  });

  test('TEST-01: Description of test', async ({ page }) => {
    // Test implementation
    await takeScreenshot(page, 'test_name_step');
  });
});
```

### Multi-User Test Structure

```javascript
const { test: multiUserTest } = require('./utils/fixtures');

multiUserTest('Multi-user test', async ({ hostPage, guest1Page, guest2Page }) => {
  // Use separate page contexts for each user
});
```

## Best Practices

1. **Unique Test Data:** Use `generateTestEmail()` and `generateDJName()` for unique data
2. **Clean State:** Clear browser storage before each test
3. **Screenshots:** Capture screenshots at key steps
4. **Assertions:** Use explicit assertions with `expect()`
5. **Error Messages:** Include descriptive console.log messages
6. **Delays:** Use `delay()` for human-like interactions
7. **Cleanup:** Ensure tests clean up after themselves

## Troubleshooting

### Tests Timing Out
- Increase `timeout` in playwright.config.js
- Add more `delay()` calls between actions
- Check if server is running properly

### Authentication Issues
- Verify `clearBrowserStorage()` is called in beforeEach
- Check token storage in localStorage
- Ensure API endpoints are accessible

### WebSocket Issues
- Verify WebSocket connection in browser console
- Check for network errors
- Ensure server WebSocket support is enabled

### Screenshot Failures
- Ensure screenshots directory exists
- Check file permissions
- Verify disk space available

## Directory Structure

```
e2e-tests/
├── auth.test.js              # Authentication tests
├── pricing.test.js           # Payment/purchase tests
├── navigation.test.js        # Navigation tests
├── party.test.js             # Party management tests
├── music.test.js             # Music/queue tests
├── reactions.test.js         # Reactions/energy tests
├── messaging.test.js         # Chat/notifications tests
├── animations.test.js        # Animation tests
├── error_handling.test.js    # Error handling tests
├── full_party_flow.test.js   # Integration tests
├── test_reporting.js         # Reporting utilities
├── utils/
│   ├── helpers.js            # Test helper functions
│   └── fixtures.js           # Multi-session fixtures
├── screenshots/              # Test screenshots (gitignored)
├── videos/                   # Test videos (gitignored)
├── logs/                     # Test logs (gitignored)
└── reports/                  # Test reports (gitignored)
```

## Test Coverage Summary

| Feature Area | Test File | Test Count |
|--------------|-----------|------------|
| Authentication | auth.test.js | 7 |
| Pricing | pricing.test.js | 10 |
| Navigation | navigation.test.js | 10 |
| Party Management | party.test.js | 8 |
| Music & Queue | music.test.js | 10 |
| Reactions | reactions.test.js | 10 |
| Messaging | messaging.test.js | 10 |
| Animations | animations.test.js | 10 |
| Error Handling | error_handling.test.js | 10 |
| Integration | full_party_flow.test.js | 3 |
| **TOTAL** | | **88** |

## Contributing

When adding new tests:

1. Follow the existing naming convention (FEATURE-##)
2. Add appropriate screenshots
3. Include descriptive console.log messages
4. Update this README with new test descriptions
5. Ensure tests clean up after themselves
6. Test locally before committing

## Support

For issues or questions:
- Check existing test patterns
- Review Playwright documentation: https://playwright.dev
- Check test logs in `e2e-tests/logs/`
- Review screenshots in `e2e-tests/screenshots/`
