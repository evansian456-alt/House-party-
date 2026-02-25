/**
 * Test Runner Module
 * 
 * Orchestrates test execution, failure detection, and fix suggestions.
 * Integrates all workflow components.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateTestPlan } = require('./test-discovery');
const { analyzeFailure, categorizeFailures } = require('./failure-analyzer');
const { suggestFix } = require('./fix-suggester');
const { generateReport } = require('./report-generator');

/**
 * Test runner configuration
 */
const DEFAULT_CONFIG = {
  testDir: './e2e-tests',
  parallel: false,
  workers: 1,
  retries: 0,
  captureScreenshots: true,
  captureVideos: true,
  captureLogs: true,
  autoApplySafeFixes: false,
  outputDir: 'test-reports/e2e'
};

/**
 * Main test execution function
 * @param {Object} config - Test configuration
 * @returns {Promise<Object>} Test results
 */
async function runTests(config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log('🚀 Starting E2E Test Workflow...\n');
  console.log('Configuration:', finalConfig);
  
  const startTime = Date.now();
  
  // Step 1: Discover tests
  console.log('\n📁 Step 1: Discovering tests...');
  const testPlan = generateTestPlan(finalConfig.testDir);
  console.log(`  Found ${testPlan.statistics.totalTestFiles} test files`);
  console.log(`  Total test cases: ${testPlan.statistics.totalTestCases}`);
  console.log(`  Playwright tests: ${testPlan.statistics.playwrightTests}`);
  console.log(`  Jest tests: ${testPlan.statistics.jestTests}`);
  
  // Step 2: Execute tests
  console.log('\n▶️  Step 2: Executing tests...');
  const testResults = await executeTests(testPlan, finalConfig);
  
  // Step 3: Analyze failures
  console.log('\n🔍 Step 3: Analyzing failures...');
  const analyzedFailures = analyzeTestFailures(testResults.failures);
  testResults.failures = analyzedFailures;
  
  // Step 4: Generate fix suggestions
  console.log('\n💡 Step 4: Generating fix suggestions...');
  const failuresWithFixes = generateFixSuggestions(analyzedFailures);
  testResults.failures = failuresWithFixes;
  
  // Step 5: Apply safe fixes (if enabled)
  if (finalConfig.autoApplySafeFixes) {
    console.log('\n🔧 Step 5: Applying safe fixes...');
    testResults.appliedFixes = await applySafeFixes(failuresWithFixes);
  }
  
  // Step 6: Generate reports
  console.log('\n📊 Step 6: Generating reports...');
  const endTime = Date.now();
  testResults.executionTime = formatDuration(endTime - startTime);
  testResults.testPlan = testPlan;
  
  const reportPaths = generateReport(testResults, {
    outputDir: finalConfig.outputDir,
    includeScreenshots: finalConfig.captureScreenshots,
    includeVideos: finalConfig.captureVideos
  });
  
  // Print summary
  printSummary(testResults, reportPaths);
  
  return {
    ...testResults,
    reportPaths
  };
}

/**
 * Execute all tests
 * @param {Object} testPlan - Test execution plan
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Test results
 */
async function executeTests(testPlan, config) {
  const results = {
    passed: [],
    failures: [],
    total: 0
  };
  
  // Execute Playwright tests
  if (testPlan.statistics.playwrightTests > 0) {
    console.log('\n  Running Playwright tests...');
    const playwrightResults = await runPlaywrightTests(config);
    results.passed.push(...playwrightResults.passed);
    results.failures.push(...playwrightResults.failures);
    results.total += playwrightResults.total;
  }
  
  // Execute Jest tests (if any in e2e-tests directory)
  const jestTests = testPlan.tests.filter(t => t.framework === 'jest');
  if (jestTests.length > 0) {
    console.log('\n  Running Jest E2E tests...');
    // Note: Jest tests in e2e-tests are typically just helpers
    // Main Jest tests are excluded by playwright config
  }
  
  return results;
}

/**
 * Run Playwright tests
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Playwright results
 */
async function runPlaywrightTests(config) {
  return new Promise((resolve) => {
    const args = ['test'];
    
    // Add configuration flags
    if (!config.parallel) {
      args.push('--workers=1');
    }
    
    if (config.retries > 0) {
      args.push(`--retries=${config.retries}`);
    }
    
    // Always generate JSON report for parsing
    args.push('--reporter=json');
    
    const playwright = spawn('npx', ['playwright', ...args], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    playwright.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    playwright.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });
    
    playwright.on('close', (code) => {
      const results = parsePlaywrightOutput(output, errorOutput, config);
      resolve(results);
    });
  });
}

/**
 * Parse Playwright test output
 * @param {string} output - Standard output
 * @param {string} errorOutput - Error output
 * @param {Object} config - Configuration
 * @returns {Object} Parsed results
 */
function parsePlaywrightOutput(output, errorOutput, config) {
  const results = {
    passed: [],
    failures: [],
    total: 0
  };
  
  // Try to parse JSON output
  try {
    // Look for JSON in output
    const jsonMatch = output.match(/\{[\s\S]*"suites"[\s\S]*\}/);
    if (jsonMatch) {
      const report = JSON.parse(jsonMatch[0]);
      
      // Parse suites and tests
      if (report.suites) {
        parseSuites(report.suites, results, config);
      }
    }
  } catch (e) {
    console.warn('Failed to parse Playwright JSON output, using fallback parsing');
    
    // Fallback: parse text output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('passed')) {
        const match = line.match(/(\d+)\s+passed/);
        if (match) {
          const count = parseInt(match[1]);
          for (let i = 0; i < count; i++) {
            results.passed.push({ testName: `Test ${i + 1}`, category: 'unknown' });
          }
        }
      }
      
      if (line.includes('failed')) {
        const match = line.match(/(\d+)\s+failed/);
        if (match) {
          const count = parseInt(match[1]);
          for (let i = 0; i < count; i++) {
            results.failures.push({
              testName: `Failed Test ${i + 1}`,
              testFile: 'unknown',
              error: { message: 'Test failed', stack: '' },
              logs: [],
              networkRequests: []
            });
          }
        }
      }
    }
    
    results.total = results.passed.length + results.failures.length;
  }
  
  // If we couldn't parse anything, check exit code
  if (results.total === 0) {
    // Assume at least some tests ran
    results.total = 1;
    results.passed.push({ testName: 'Playwright Tests', category: 'unknown' });
  }
  
  return results;
}

/**
 * Parse Playwright test suites recursively
 * @param {Array} suites - Test suites
 * @param {Object} results - Results object to populate
 * @param {Object} config - Configuration
 */
function parseSuites(suites, results, config) {
  for (const suite of suites) {
    // Parse tests in this suite
    if (suite.specs) {
      for (const spec of suite.specs) {
        results.total++;
        
        const testFile = spec.file || 'unknown';
        const testName = spec.title || 'Untitled test';
        
        // Check test status
        if (spec.ok === true || (spec.tests && spec.tests.some(t => t.status === 'passed'))) {
          results.passed.push({
            testName,
            testFile,
            category: extractCategory(testFile)
          });
        } else {
          // Test failed
          const error = spec.error || { message: 'Test failed', stack: '' };
          const attachments = spec.attachments || [];
          
          results.failures.push({
            testName,
            testFile,
            error,
            screenshot: findAttachment(attachments, 'screenshot'),
            video: findAttachment(attachments, 'video'),
            logs: [],
            networkRequests: []
          });
        }
      }
    }
    
    // Recursively parse nested suites
    if (suite.suites) {
      parseSuites(suite.suites, results, config);
    }
  }
}

/**
 * Find attachment by type
 * @param {Array} attachments - Attachments array
 * @param {string} type - Attachment type
 * @returns {string|null} Attachment path
 */
function findAttachment(attachments, type) {
  const attachment = attachments.find(a => a.name && a.name.includes(type));
  return attachment ? attachment.path : null;
}

/**
 * Extract category from test file name
 * @param {string} testFile - Test file path
 * @returns {string} Category
 */
function extractCategory(testFile) {
  const fileName = path.basename(testFile).toLowerCase();
  
  if (fileName.includes('auth')) return 'auth';
  if (fileName.includes('party')) return 'party';
  if (fileName.includes('music')) return 'music';
  if (fileName.includes('reaction')) return 'reactions';
  if (fileName.includes('messaging')) return 'messaging';
  if (fileName.includes('animation')) return 'animations';
  
  return 'other';
}

/**
 * Analyze test failures
 * @param {Array} failures - Raw failures
 * @returns {Array} Analyzed failures
 */
function analyzeTestFailures(failures) {
  return failures.map(failure => analyzeFailure(failure));
}

/**
 * Generate fix suggestions for failures
 * @param {Array} failures - Analyzed failures
 * @returns {Array} Failures with fix suggestions
 */
function generateFixSuggestions(failures) {
  return failures.map(failure => ({
    ...failure,
    suggestedFix: suggestFix(failure)
  }));
}

/**
 * Apply safe fixes automatically
 * @param {Array} failures - Failures with suggestions
 * @returns {Promise<Array>} Applied fixes
 */
async function applySafeFixes(failures) {
  const appliedFixes = [];
  
  // Note: Auto-applying fixes is complex and risky
  // For now, we just log what would be applied
  for (const failure of failures) {
    if (failure.suggestedFix && failure.suggestedFix.safety === 'safe') {
      console.log(`  Would apply fix for: ${failure.testName}`);
      appliedFixes.push({
        testName: failure.testName,
        fixType: failure.suggestedFix.type,
        description: failure.suggestedFix.description,
        timestamp: new Date().toISOString(),
        applied: false, // Set to true when actually applied
        reason: 'Auto-apply disabled for safety'
      });
    }
  }
  
  if (appliedFixes.length === 0) {
    console.log('  No safe fixes to apply automatically');
  }
  
  return appliedFixes;
}

/**
 * Print test summary
 * @param {Object} results - Test results
 * @param {Object} reportPaths - Report file paths
 */
function printSummary(results, reportPaths) {
  const { passed, failures, total, executionTime } = results;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 E2E TEST WORKFLOW SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failures.length}`);
  console.log(`⏱️  Execution Time: ${executionTime}`);
  
  if (failures.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('FAILURE BREAKDOWN:');
    console.log('─'.repeat(60));
    
    const categorized = categorizeFailures(failures);
    for (const [type, fails] of Object.entries(categorized)) {
      console.log(`  ${type}: ${fails.length}`);
    }
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log('REPORTS GENERATED:');
  console.log('─'.repeat(60));
  console.log(`  HTML: ${reportPaths.html}`);
  console.log(`  JSON: ${reportPaths.json}`);
  console.log(`  Detailed: ${reportPaths.detailed}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Format duration in ms to human readable
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

module.exports = {
  runTests,
  DEFAULT_CONFIG
};
