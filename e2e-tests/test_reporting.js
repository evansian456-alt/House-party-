/**
 * E2E Test Reporting Utilities
 * 
 * Utilities for capturing screenshots, videos, logging errors,
 * and generating comprehensive test reports.
 */

const fs = require('fs');
const path = require('path');

/**
 * Test reporting configuration
 */
const REPORTING_CONFIG = {
  screenshotsDir: path.join(__dirname, 'screenshots'),
  videosDir: path.join(__dirname, 'videos'),
  logsDir: path.join(__dirname, 'logs'),
  reportsDir: path.join(__dirname, 'reports')
};

/**
 * Ensure all reporting directories exist
 */
function ensureReportingDirectories() {
  Object.values(REPORTING_CONFIG).forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Capture screenshot with metadata
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} testName - Name of the test
 * @param {string} step - Current step/action
 * @param {Object} metadata - Additional metadata
 */
async function captureScreenshotWithMetadata(page, testName, step, metadata = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedTestName = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const sanitizedStep = step.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  const filename = `${sanitizedTestName}_${sanitizedStep}_${timestamp}.png`;
  const filepath = path.join(REPORTING_CONFIG.screenshotsDir, filename);
  
  await page.screenshot({ 
    path: filepath,
    fullPage: true 
  });
  
  // Log metadata
  const metadataFile = filepath.replace('.png', '_meta.json');
  fs.writeFileSync(metadataFile, JSON.stringify({
    testName,
    step,
    timestamp: new Date().toISOString(),
    url: page.url(),
    ...metadata
  }, null, 2));
  
  return { filename, filepath };
}

/**
 * Log test error with details
 * @param {string} testName - Name of the test
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logTestError(testName, error, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    testName,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  };
  
  const logFile = path.join(
    REPORTING_CONFIG.logsDir, 
    `errors_${new Date().toISOString().split('T')[0]}.log`
  );
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(logFile, logLine);
  
  console.error(`[ERROR] ${testName}:`, error.message);
  
  return logEntry;
}

/**
 * Generate test summary report
 * @param {Array} testResults - Array of test result objects
 */
function generateTestSummary(testResults) {
  const summary = {
    timestamp: new Date().toISOString(),
    total: testResults.length,
    passed: testResults.filter(t => t.status === 'passed').length,
    failed: testResults.filter(t => t.status === 'failed').length,
    skipped: testResults.filter(t => t.status === 'skipped').length,
    duration: testResults.reduce((sum, t) => sum + (t.duration || 0), 0),
    tests: testResults
  };
  
  const reportFile = path.join(
    REPORTING_CONFIG.reportsDir,
    `test_summary_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  
  fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
  
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Total Tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
  console.log('==================================\n');
  
  return summary;
}

/**
 * Capture video recording metadata
 * @param {string} testName - Name of the test
 * @param {string} videoPath - Path to video file
 */
function logVideoCapture(testName, videoPath) {
  const metadata = {
    testName,
    videoPath,
    timestamp: new Date().toISOString()
  };
  
  const metadataFile = path.join(
    REPORTING_CONFIG.videosDir,
    `${path.basename(videoPath, path.extname(videoPath))}_meta.json`
  );
  
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  
  return metadata;
}

/**
 * Log test step with details
 * @param {string} testName - Name of the test
 * @param {string} step - Step description
 * @param {Object} data - Step data
 */
function logTestStep(testName, step, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    testName,
    step,
    data
  };
  
  const logFile = path.join(
    REPORTING_CONFIG.logsDir,
    `steps_${new Date().toISOString().split('T')[0]}.log`
  );
  
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  
  return logEntry;
}

/**
 * Generate HTML test report
 * @param {Object} summary - Test summary object
 */
function generateHTMLReport(summary) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report - ${summary.timestamp}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      padding: 15px;
      border-radius: 5px;
      text-align: center;
    }
    .summary-item.passed { background-color: #4CAF50; color: white; }
    .summary-item.failed { background-color: #f44336; color: white; }
    .summary-item.skipped { background-color: #ff9800; color: white; }
    .summary-item.total { background-color: #2196F3; color: white; }
    .test-list {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-item {
      padding: 10px;
      margin: 10px 0;
      border-left: 4px solid #ccc;
      background-color: #fafafa;
    }
    .test-item.passed { border-left-color: #4CAF50; }
    .test-item.failed { border-left-color: #f44336; }
    .test-item.skipped { border-left-color: #ff9800; }
    .timestamp {
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <h1>E2E Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p class="timestamp">Generated: ${new Date(summary.timestamp).toLocaleString()}</p>
    <div class="summary-grid">
      <div class="summary-item total">
        <h3>${summary.total}</h3>
        <p>Total Tests</p>
      </div>
      <div class="summary-item passed">
        <h3>${summary.passed}</h3>
        <p>Passed</p>
      </div>
      <div class="summary-item failed">
        <h3>${summary.failed}</h3>
        <p>Failed</p>
      </div>
      <div class="summary-item skipped">
        <h3>${summary.skipped}</h3>
        <p>Skipped</p>
      </div>
    </div>
    <p><strong>Duration:</strong> ${(summary.duration / 1000).toFixed(2)} seconds</p>
  </div>
  
  <div class="test-list">
    <h2>Test Results</h2>
    ${summary.tests.map(test => `
      <div class="test-item ${test.status}">
        <h3>${test.name}</h3>
        <p><strong>Status:</strong> ${test.status.toUpperCase()}</p>
        <p><strong>Duration:</strong> ${test.duration ? (test.duration / 1000).toFixed(2) + 's' : 'N/A'}</p>
        ${test.error ? `<p><strong>Error:</strong> ${test.error}</p>` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
  
  const reportFile = path.join(
    REPORTING_CONFIG.reportsDir,
    `test_report_${new Date().toISOString().replace(/[:.]/g, '-')}.html`
  );
  
  fs.writeFileSync(reportFile, html);
  
  console.log(`HTML report generated: ${reportFile}`);
  
  return reportFile;
}

/**
 * Attempt to auto-fix common issues
 * @param {string} errorType - Type of error encountered
 * @param {Object} context - Error context
 * @returns {Object} Fix result
 */
function attemptAutoFix(errorType, context = {}) {
  const fixes = {
    'AUTH_FAILURE': () => {
      console.log('Auto-fix: Clearing authentication and retrying...');
      return { fixed: false, message: 'Manual authentication required' };
    },
    'NETWORK_ERROR': () => {
      console.log('Auto-fix: Network error detected, retry recommended');
      return { fixed: false, message: 'Check network connection' };
    },
    'ELEMENT_NOT_FOUND': () => {
      console.log('Auto-fix: Element not found, check selectors');
      return { fixed: false, message: 'Update element selectors' };
    },
    'TIMEOUT': () => {
      console.log('Auto-fix: Timeout detected, increase wait time');
      return { fixed: false, message: 'Increase timeout duration' };
    }
  };
  
  const fixFunction = fixes[errorType];
  
  if (fixFunction) {
    return fixFunction();
  }
  
  return { 
    fixed: false, 
    message: `No auto-fix available for: ${errorType}` 
  };
}

// Initialize directories on module load
ensureReportingDirectories();

module.exports = {
  REPORTING_CONFIG,
  ensureReportingDirectories,
  captureScreenshotWithMetadata,
  logTestError,
  generateTestSummary,
  logVideoCapture,
  logTestStep,
  generateHTMLReport,
  attemptAutoFix
};
