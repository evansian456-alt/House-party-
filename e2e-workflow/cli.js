#!/usr/bin/env node
/**
 * E2E Workflow CLI
 * 
 * Main command-line interface for running the automated E2E testing workflow.
 * 
 * Usage:
 *   npm run test:e2e:auto                    # Run with default settings
 *   npm run test:e2e:auto -- --parallel      # Run tests in parallel
 *   npm run test:e2e:auto -- --auto-fix      # Auto-apply safe fixes
 *   npm run test:e2e:auto -- --help          # Show help
 */

const { runTests, DEFAULT_CONFIG } = require('./test-runner');

// Parse command line arguments
const args = process.argv.slice(2);

const config = { ...DEFAULT_CONFIG };
let showHelp = false;

for (const arg of args) {
  switch (arg) {
    case '--help':
    case '-h':
      showHelp = true;
      break;
    case '--parallel':
    case '-p':
      config.parallel = true;
      config.workers = 4;
      break;
    case '--auto-fix':
    case '-f':
      config.autoApplySafeFixes = true;
      break;
    case '--no-screenshots':
      config.captureScreenshots = false;
      break;
    case '--no-videos':
      config.captureVideos = false;
      break;
    case '--workers':
      // Next arg should be number
      const idx = args.indexOf('--workers');
      if (idx >= 0 && args[idx + 1]) {
        config.workers = parseInt(args[idx + 1]);
      }
      break;
    default:
      if (arg.startsWith('--output=')) {
        config.outputDir = arg.split('=')[1];
      } else if (arg.startsWith('--testdir=')) {
        config.testDir = arg.split('=')[1];
      }
  }
}

// Show help if requested
if (showHelp) {
  showHelpText();
  process.exit(0);
}

// Run the workflow
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎵  SYNCSPEAKER E2E AUTOMATED WORKFLOW                      ║
║                                                               ║
║   Complete automated testing with failure detection          ║
║   and intelligent fix suggestions                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

runTests(config)
  .then((results) => {
    const exitCode = results.failures.length > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${results.failures.length} test(s) failed. Check the reports for details.`);
    }
    
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('\n❌ Workflow error:', error);
    process.exit(1);
  });

/**
 * Show help text
 */
function showHelpText() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   SyncSpeaker E2E Automated Testing Workflow                 ║
╚═══════════════════════════════════════════════════════════════╝

USAGE:
  npm run test:e2e:auto [options]

OPTIONS:
  --help, -h              Show this help message
  --parallel, -p          Run tests in parallel (default: sequential)
  --auto-fix, -f          Automatically apply safe fixes
  --no-screenshots        Disable screenshot capture
  --no-videos            Disable video capture
  --workers <n>           Set number of parallel workers (default: 1)
  --output=<dir>          Set output directory (default: test-reports/e2e)
  --testdir=<dir>         Set test directory (default: ./e2e-tests)

EXAMPLES:
  # Run with default settings (sequential, no auto-fix)
  npm run test:e2e:auto

  # Run in parallel with 4 workers
  npm run test:e2e:auto -- --parallel --workers 4

  # Run with auto-fix enabled
  npm run test:e2e:auto -- --auto-fix

  # Custom output directory
  npm run test:e2e:auto -- --output=./my-reports

  # Run specific test directory
  npm run test:e2e:auto -- --testdir=./e2e-tests

WORKFLOW STEPS:
  1. 📁 Test Discovery     - Find all E2E test files
  2. ▶️  Test Execution     - Run Playwright/Jest tests
  3. 🔍 Failure Analysis   - Categorize and analyze failures
  4. 💡 Fix Suggestions    - Generate intelligent fix suggestions
  5. 🔧 Auto-Fix (opt)     - Apply safe fixes automatically
  6. 📊 Report Generation  - Create HTML and JSON reports

REPORTS:
  After execution, find detailed reports in:
  - test-reports/e2e/summary.html       (Visual HTML report)
  - test-reports/e2e/failure-report.json (Detailed JSON data)
  - test-reports/e2e/detailed-failures.json (Failure details)

TEST COVERAGE:
  ✅ Authentication & Profile Management
  ✅ Pricing & Purchases (Party Pass, PRO, Add-ons)
  ✅ Party Management (Host/Guest flows)
  ✅ Music Playback & Queue
  ✅ Reactions & Crowd Energy
  ✅ Messaging & Chat
  ✅ Animations & Visual Effects
  ✅ Error Handling & Edge Cases
  ✅ Navigation & Routing
  ✅ Full Integration Tests

FAILURE DETECTION:
  The workflow automatically detects and categorizes:
  • Frontend UI issues (selectors, visibility, timing)
  • Backend/API issues (endpoints, errors, responses)
  • Network/WebSocket issues (connections, sync)
  • Role-based issues (host vs guest access)
  • Music sync problems (drift, queue, playback)
  • Reaction issues (crowd energy, leaderboard)
  • Messaging issues (chat, notifications)
  • Animation issues (effects, transitions)

FIX SUGGESTIONS:
  For each failure, the workflow suggests:
  • Safe fixes (CSS, selectors) - can be auto-applied
  • Moderate fixes (logic changes) - need review
  • Complex fixes (API, sync) - require manual intervention

ENVIRONMENT:
  Set these environment variables if needed:
  • BASE_URL          - Test against deployed server
  • DATABASE_URL      - PostgreSQL connection string
  • REDIS_URL         - Redis connection string

MORE INFO:
  See E2E_README.md and e2e-tests/README.md for details.
`);
}
