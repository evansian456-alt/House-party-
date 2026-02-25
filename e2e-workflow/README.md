# E2E Automated Testing Workflow

Complete automated workflow for the SyncSpeaker/House Party app that runs E2E tests, detects failures, suggests fixes, and provides detailed reports.

## 🎯 Features

### 1. Comprehensive Test Runner
- **Auto-discovers** all Playwright and Jest E2E test files
- **Categorizes** tests by feature area (auth, pricing, party, music, reactions, etc.)
- **Executes** tests sequentially or in parallel
- **Captures** screenshots, videos, and logs for all failures

### 2. Intelligent Failure Detection
Automatically detects and categorizes failures:
- ✅ **Frontend UI issues** - Missing elements, incorrect selectors, visibility problems
- ✅ **Backend/API issues** - Failed endpoints, 4xx/5xx errors, API response problems
- ✅ **Network issues** - WebSocket disconnects, connection failures
- ✅ **Role-based issues** - Host vs guest access problems
- ✅ **Music sync issues** - Playback drift, queue problems, sync failures
- ✅ **Reactions issues** - Crowd energy, emoji pop-ups, leaderboard
- ✅ **Messaging issues** - Chat delivery, notifications
- ✅ **Animation issues** - Missing effects, broken transitions
- ✅ **Authentication issues** - Login, tokens, sessions
- ✅ **Navigation issues** - Routing, view transitions

### 3. Smart Fix Suggestions
For each failure, the workflow provides:
- **Detailed diagnosis** - Root cause analysis
- **Safety level** - Safe, Moderate, or Complex
- **Code suggestions** - Specific fixes with examples
- **Context** - Relevant logs, network requests, DOM state

### 4. Optional Auto-Fix
- **Safe fixes** can be auto-applied (CSS, selectors, minor issues)
- **Complex fixes** generate patch suggestions for manual review
- **Tracks all fixes** with timestamps and file references

### 5. Comprehensive Reporting
Generates detailed reports in multiple formats:
- **HTML Summary** (`summary.html`) - Beautiful visual report
- **JSON Report** (`failure-report.json`) - Machine-readable data
- **Detailed Failures** (`detailed-failures.json`) - Full failure context

## 📦 Installation

The workflow is built into the project. No additional installation needed!

```bash
# Dependencies are already installed
npm install
```

## 🚀 Quick Start

### Run the Complete Workflow

```bash
# Basic usage - run all tests with default settings
npm run test:e2e:auto
```

### Advanced Options

```bash
# Run in parallel (faster)
npm run test:e2e:auto -- --parallel

# Enable auto-fix for safe issues
npm run test:e2e:auto -- --auto-fix

# Custom workers
npm run test:e2e:auto -- --workers 4

# Custom output directory
npm run test:e2e:auto -- --output=./my-reports

# Show help
npm run test:e2e:auto -- --help
```

## 📊 What Gets Tested

The workflow automatically discovers and runs ALL E2E tests covering:

### Core Features
- ✅ **Authentication** - Sign up, login, logout, session persistence
- ✅ **User Profiles** - Profile creation, DJ names, user data
- ✅ **Pricing & Purchases** - Party Pass (£2.99), PRO Monthly (£9.99)
- ✅ **Add-ons** - DJ Mode, Room Boost, Playlist Save, Multi-Room, Early Access
- ✅ **Party Management** - Create, join, leave, end parties
- ✅ **Music Player** - Queue, playback, skip, sync
- ✅ **Reactions** - Emojis, crowd energy, leaderboard
- ✅ **Messaging** - DJ messages, chat modes, notifications
- ✅ **Animations** - Visual effects, transitions, pop-ups
- ✅ **Navigation** - Page routing, view transitions

### User Flows
- ✅ **Host/DJ flows** - Full party hosting experience
- ✅ **Guest flows** - Joining, participating, interactions
- ✅ **Multi-device** - Host + multiple guests synchronization
- ✅ **Edge cases** - Network issues, errors, invalid inputs

## 📁 Architecture

### Project Structure

```
e2e-workflow/
├── cli.js                  # Main CLI entry point
├── test-runner.js          # Test execution orchestrator
├── test-discovery.js       # Test file discovery & categorization
├── failure-analyzer.js     # Failure detection & analysis
├── fix-suggester.js        # Intelligent fix suggestions
└── report-generator.js     # HTML & JSON report generation
```

### Workflow Steps

```
1. 📁 Test Discovery
   └─> Finds all test files
   └─> Categorizes by feature
   └─> Determines execution order

2. ▶️  Test Execution
   └─> Runs Playwright tests
   └─> Captures screenshots/videos
   └─> Collects logs & network data

3. 🔍 Failure Analysis
   └─> Categorizes failure types
   └─> Extracts error context
   └─> Identifies affected components

4. 💡 Fix Suggestions
   └─> Analyzes root causes
   └─> Generates code suggestions
   └─> Assigns safety levels

5. 🔧 Auto-Fix (Optional)
   └─> Applies safe fixes
   └─> Tracks changes
   └─> Skips complex issues

6. 📊 Report Generation
   └─> Creates HTML summary
   └─> Generates JSON data
   └─> Links to artifacts
```

## 📋 Report Examples

### HTML Summary Report

The HTML report (`test-reports/e2e/summary.html`) includes:
- **Summary Statistics** - Total, passed, failed, pass rate
- **Test Coverage** - Host flows, guest flows, features tested
- **Failed Tests** - Detailed list with screenshots/videos
- **Fix Suggestions** - Actionable recommendations
- **Applied Fixes** - Auto-applied changes (if enabled)
- **Failure Categories** - Breakdown by type

### JSON Reports

#### Failure Report (`failure-report.json`)
```json
{
  "reportId": "e2e-report-1234567890",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "summary": {
    "totalTests": 50,
    "passed": 45,
    "failed": 5,
    "passRate": "90.00",
    "failuresByType": {
      "frontend_ui": 2,
      "backend_api": 1,
      "network": 1,
      "music_sync": 1
    }
  },
  "failures": [...],
  "suggestedFixes": [...]
}
```

#### Detailed Failures (`detailed-failures.json`)
Full context for each failure including:
- Test name and file
- Failure type and category
- Error message and stack trace
- Affected component
- Suggested fixes with code examples
- Screenshots and video links
- Console logs
- Network requests

## 🔍 Failure Detection Examples

### Frontend UI Issue
```
❌ Element not found: #btn-join-party

Type: frontend_ui
Component: Button: join-party
Safety: Moderate

Suggested Fix:
- Check if element exists in index.html
- Update selector to be more flexible
- Ensure element is visible when expected

Code Example:
<!-- Ensure button exists -->
<button id="btn-join-party">Join Party</button>

// Or update test selector
page.locator('button:has-text("Join Party")')
```

### Backend API Issue
```
❌ API Error: POST /api/party/join - Status 500

Type: backend_api
Component: Party Management
Safety: Complex

Suggested Fix:
- Check server logs for error details
- Verify endpoint handler exists
- Add proper error handling

Code Example:
app.post('/api/party/join', async (req, res) => {
  try {
    // Handle request
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Music Sync Issue
```
❌ Playback drift detected: 250ms

Type: music_sync
Component: Music Player
Safety: Complex

Suggested Fix:
- Check sync engine initialization
- Verify WebSocket message handling
- Review drift correction logic
```

## ⚙️ Configuration

### Default Configuration

```javascript
{
  testDir: './e2e-tests',       // Test directory
  parallel: false,              // Sequential execution
  workers: 1,                   // Single worker
  retries: 0,                   // No retries
  captureScreenshots: true,     // Capture on failure
  captureVideos: true,          // Capture on failure
  captureLogs: true,            // Collect console logs
  autoApplySafeFixes: false,    // Manual review
  outputDir: 'test-reports/e2e' // Report location
}
```

### CLI Options

```bash
--help, -h              # Show help message
--parallel, -p          # Run tests in parallel
--auto-fix, -f          # Auto-apply safe fixes
--no-screenshots        # Disable screenshots
--no-videos            # Disable videos
--workers <n>           # Set worker count
--output=<dir>          # Set output directory
--testdir=<dir>         # Set test directory
```

## 🎯 Use Cases

### Development
```bash
# Quick check during development
npm run test:e2e:auto

# Detailed debugging
npm run test:e2e:auto -- --no-parallel
```

### CI/CD Pipeline
```bash
# Parallel execution for speed
npm run test:e2e:auto -- --parallel --workers 4

# Generate reports for artifacts
npm run test:e2e:auto -- --output=./ci-reports
```

### Pre-Release Testing
```bash
# Full workflow with auto-fix
npm run test:e2e:auto -- --auto-fix

# Then review applied fixes in report
```

## 🔧 Extending the Workflow

### Add Custom Failure Detection

Edit `e2e-workflow/failure-analyzer.js`:

```javascript
// Add new failure type
const FAILURE_TYPES = {
  // ... existing types
  MY_CUSTOM_TYPE: 'my_custom_type'
};

// Add detection logic
function detectFailureType(error, testFile, logs, networkRequests) {
  // ... existing detection
  
  // Custom detection
  if (errorMsg.includes('my-custom-error')) {
    return FAILURE_TYPES.MY_CUSTOM_TYPE;
  }
}
```

### Add Custom Fix Suggestions

Edit `e2e-workflow/fix-suggester.js`:

```javascript
function suggestFix(analyzedFailure) {
  // ... existing logic
  
  switch (failureType) {
    // ... existing cases
    case FAILURE_TYPES.MY_CUSTOM_TYPE:
      suggestion = suggestMyCustomFix(error, component, context);
      break;
  }
}
```

## 📚 Related Documentation

- [E2E Test Suite README](../e2e-tests/README.md) - Individual test descriptions
- [Playwright Configuration](../playwright.config.js) - Test runner config
- [E2E Quick Start](../E2E_README.md) - Getting started guide

## 🐛 Troubleshooting

### Tests Not Found
```bash
# Verify test directory
npm run test:e2e:auto -- --testdir=./e2e-tests

# Check test files exist
ls -la e2e-tests/*.spec.js
```

### Playwright Not Installed
```bash
# Install Playwright browsers
npx playwright install chromium
```

### Report Generation Failed
```bash
# Ensure output directory is writable
mkdir -p test-reports/e2e
chmod 755 test-reports/e2e
```

### No Failures Detected
This is good! It means all tests passed. The report will still be generated with summary statistics.

## 🤝 Contributing

When adding new tests:
1. Place them in `e2e-tests/` directory
2. Use `.spec.js` for Playwright tests
3. Use descriptive test names
4. Follow existing patterns
5. The workflow will automatically discover them!

## 📝 License

Part of the SyncSpeaker project.

---

**Questions?** Check the [main README](../README.md) or [E2E documentation](../e2e-tests/README.md).
