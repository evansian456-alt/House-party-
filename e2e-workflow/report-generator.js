/**
 * Report Generator Module
 * 
 * Generates comprehensive test reports in JSON and HTML formats.
 * Includes failure analysis, fix suggestions, and test coverage.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate comprehensive test report
 * @param {Object} testResults - Test execution results
 * @param {Object} options - Report options
 * @returns {Object} Generated report paths
 */
function generateReport(testResults, options = {}) {
  const {
    outputDir = 'test-reports/e2e',
    includeScreenshots = true,
    includeVideos = true
  } = options;
  
  // Ensure output directory exists
  ensureDirectory(outputDir);
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  const reportId = `e2e-report-${Date.now()}`;
  
  // Prepare report data
  const reportData = {
    reportId,
    timestamp,
    summary: generateSummary(testResults),
    failures: testResults.failures || [],
    passed: testResults.passed || [],
    coverage: generateCoverage(testResults),
    appliedFixes: testResults.appliedFixes || [],
    suggestedFixes: extractSuggestedFixes(testResults.failures || [])
  };
  
  // Generate JSON report
  const jsonPath = path.join(outputDir, 'failure-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
  
  // Generate HTML summary
  const htmlPath = path.join(outputDir, 'summary.html');
  const htmlContent = generateHTMLReport(reportData, includeScreenshots, includeVideos);
  fs.writeFileSync(htmlPath, htmlContent);
  
  // Generate detailed failure report
  const detailedPath = path.join(outputDir, 'detailed-failures.json');
  fs.writeFileSync(detailedPath, JSON.stringify(reportData.failures, null, 2));
  
  console.log(`\n✅ Reports generated:`);
  console.log(`  - JSON Report: ${jsonPath}`);
  console.log(`  - HTML Summary: ${htmlPath}`);
  console.log(`  - Detailed Failures: ${detailedPath}`);
  
  return {
    json: jsonPath,
    html: htmlPath,
    detailed: detailedPath
  };
}

/**
 * Generate summary statistics
 * @param {Object} testResults - Test results
 * @returns {Object} Summary object
 */
function generateSummary(testResults) {
  const { passed = [], failures = [], total = 0 } = testResults;
  
  return {
    totalTests: total,
    passed: passed.length,
    failed: failures.length,
    passRate: total > 0 ? ((passed.length / total) * 100).toFixed(2) : 0,
    failuresByType: categorizeFailuresByType(failures),
    executionTime: testResults.executionTime || 'N/A'
  };
}

/**
 * Categorize failures by type
 * @param {Array} failures - Array of failures
 * @returns {Object} Categorized counts
 */
function categorizeFailuresByType(failures) {
  const categories = {};
  
  for (const failure of failures) {
    const type = failure.failureType || 'unknown';
    categories[type] = (categories[type] || 0) + 1;
  }
  
  return categories;
}

/**
 * Generate coverage information
 * @param {Object} testResults - Test results
 * @returns {Object} Coverage object
 */
function generateCoverage(testResults) {
  const { testPlan } = testResults;
  
  if (!testPlan) {
    return {
      hostFlows: 'N/A',
      guestFlows: 'N/A',
      features: []
    };
  }
  
  // Determine which flows were tested
  const testedCategories = new Set();
  if (testResults.passed) {
    testResults.passed.forEach(test => {
      if (test.category) testedCategories.add(test.category);
    });
  }
  
  return {
    hostFlows: testedCategories.has('party') ? 'Covered' : 'Partial',
    guestFlows: testedCategories.has('party') ? 'Covered' : 'Partial',
    features: Array.from(testedCategories)
  };
}

/**
 * Extract suggested fixes from failures
 * @param {Array} failures - Array of failures
 * @returns {Array} Suggested fixes
 */
function extractSuggestedFixes(failures) {
  return failures
    .filter(f => f.suggestedFix)
    .map(f => ({
      testName: f.testName,
      failureType: f.failureType,
      fix: f.suggestedFix
    }));
}

/**
 * Generate HTML report
 * @param {Object} reportData - Report data
 * @param {boolean} includeScreenshots - Include screenshot links
 * @param {boolean} includeVideos - Include video links
 * @returns {string} HTML content
 */
function generateHTMLReport(reportData, includeScreenshots, includeVideos) {
  const { summary, failures, passed, coverage, suggestedFixes, appliedFixes, timestamp } = reportData;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report - SyncSpeaker</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    
    .timestamp {
      opacity: 0.9;
      font-size: 0.9rem;
    }
    
    .content {
      padding: 30px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      border: 2px solid #e9ecef;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    
    .stat-label {
      color: #6c757d;
      font-size: 0.9rem;
    }
    
    .stat-card.passed .stat-value {
      color: #28a745;
    }
    
    .stat-card.failed .stat-value {
      color: #dc3545;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    h2 {
      color: #667eea;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e9ecef;
    }
    
    .failure-item {
      background: #fff5f5;
      border-left: 4px solid #dc3545;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
    }
    
    .failure-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .failure-title {
      font-weight: bold;
      color: #dc3545;
    }
    
    .failure-type {
      background: #dc3545;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
    }
    
    .failure-details {
      color: #6c757d;
      font-size: 0.9rem;
      margin-bottom: 10px;
    }
    
    .fix-suggestion {
      background: white;
      border-radius: 6px;
      padding: 15px;
      margin-top: 10px;
      border: 1px solid #e9ecef;
    }
    
    .fix-title {
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    
    .fix-code {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 10px;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      white-space: pre;
    }
    
    .coverage-list {
      list-style: none;
      padding: 0;
    }
    
    .coverage-item {
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }
    
    .coverage-item::before {
      content: '✓';
      color: #28a745;
      font-weight: bold;
      margin-right: 10px;
    }
    
    .artifacts {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    
    .artifact-link {
      display: inline-block;
      padding: 6px 12px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    
    .artifact-link:hover {
      background: #764ba2;
    }
    
    .no-failures {
      text-align: center;
      padding: 40px;
      color: #28a745;
      font-size: 1.2rem;
    }
    
    .pass-rate {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      margin-top: 10px;
    }
    
    .pass-rate.high {
      background: #d4edda;
      color: #155724;
    }
    
    .pass-rate.medium {
      background: #fff3cd;
      color: #856404;
    }
    
    .pass-rate.low {
      background: #f8d7da;
      color: #721c24;
    }
    
    footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #6c757d;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎵 E2E Test Report</h1>
      <p class="timestamp">Generated: ${timestamp}</p>
      <div class="pass-rate ${getPassRateClass(summary.passRate)}">
        Pass Rate: ${summary.passRate}%
      </div>
    </header>
    
    <div class="content">
      <div class="summary-grid">
        <div class="stat-card">
          <div class="stat-value">${summary.totalTests}</div>
          <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat-card passed">
          <div class="stat-value">${summary.passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card failed">
          <div class="stat-value">${summary.failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.executionTime}</div>
          <div class="stat-label">Execution Time</div>
        </div>
      </div>
      
      <div class="section">
        <h2>📊 Test Coverage</h2>
        <ul class="coverage-list">
          <li class="coverage-item">Host flows: ${coverage.hostFlows}</li>
          <li class="coverage-item">Guest flows: ${coverage.guestFlows}</li>
          <li class="coverage-item">Features tested: ${coverage.features.join(', ') || 'N/A'}</li>
        </ul>
      </div>
      
      ${failures.length > 0 ? `
      <div class="section">
        <h2>❌ Failed Tests (${failures.length})</h2>
        ${failures.map(failure => generateFailureHTML(failure, includeScreenshots, includeVideos)).join('')}
      </div>
      ` : '<div class="no-failures">🎉 All tests passed!</div>'}
      
      ${suggestedFixes.length > 0 ? `
      <div class="section">
        <h2>💡 Suggested Fixes (${suggestedFixes.length})</h2>
        ${suggestedFixes.map(fix => generateFixHTML(fix)).join('')}
      </div>
      ` : ''}
      
      ${appliedFixes.length > 0 ? `
      <div class="section">
        <h2>✅ Applied Fixes (${appliedFixes.length})</h2>
        <ul class="coverage-list">
          ${appliedFixes.map(fix => `<li class="coverage-item">${fix.description} (${fix.timestamp})</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${summary.failuresByType && Object.keys(summary.failuresByType).length > 0 ? `
      <div class="section">
        <h2>📈 Failure Categories</h2>
        <ul class="coverage-list">
          ${Object.entries(summary.failuresByType).map(([type, count]) => 
            `<li class="coverage-item">${type}: ${count}</li>`
          ).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    
    <footer>
      <p>SyncSpeaker E2E Automated Testing Workflow</p>
      <p>For detailed JSON reports, see failure-report.json and detailed-failures.json</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for a single failure
 * @param {Object} failure - Failure object
 * @param {boolean} includeScreenshots - Include screenshot links
 * @param {boolean} includeVideos - Include video links
 * @returns {string} HTML content
 */
function generateFailureHTML(failure, includeScreenshots, includeVideos) {
  const { testName, failureType, error, affectedComponent, artifacts, suggestedFix } = failure;
  
  let html = `
    <div class="failure-item">
      <div class="failure-header">
        <div class="failure-title">${testName}</div>
        <div class="failure-type">${failureType}</div>
      </div>
      <div class="failure-details">
        <strong>Component:</strong> ${affectedComponent}<br>
        <strong>Error:</strong> ${error.message}
      </div>
  `;
  
  if (artifacts && (artifacts.screenshot || artifacts.video)) {
    html += '<div class="artifacts">';
    if (includeScreenshots && artifacts.screenshot) {
      html += `<a href="${artifacts.screenshot}" class="artifact-link" target="_blank">📸 Screenshot</a>`;
    }
    if (includeVideos && artifacts.video) {
      html += `<a href="${artifacts.video}" class="artifact-link" target="_blank">🎥 Video</a>`;
    }
    html += '</div>';
  }
  
  if (suggestedFix) {
    html += `
      <div class="fix-suggestion">
        <div class="fix-title">💡 Suggested Fix: ${suggestedFix.description}</div>
        <p>${suggestedFix.explanation}</p>
        ${suggestedFix.suggestedChanges && suggestedFix.suggestedChanges.length > 0 ? `
          ${suggestedFix.suggestedChanges.map(change => `
            <div style="margin-top: 10px;">
              <strong>File:</strong> ${change.file}<br>
              <strong>Action:</strong> ${change.action}
              ${change.code ? `<div class="fix-code">${escapeHtml(change.code)}</div>` : ''}
            </div>
          `).join('')}
        ` : ''}
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * Generate HTML for a suggested fix
 * @param {Object} fix - Fix object
 * @returns {string} HTML content
 */
function generateFixHTML(fix) {
  return `
    <div class="fix-suggestion">
      <div class="fix-title">${fix.testName}</div>
      <p><strong>Type:</strong> ${fix.failureType}</p>
      <p>${fix.fix.description}</p>
    </div>
  `;
}

/**
 * Get CSS class for pass rate
 * @param {number} passRate - Pass rate percentage
 * @returns {string} CSS class
 */
function getPassRateClass(passRate) {
  if (passRate >= 90) return 'high';
  if (passRate >= 70) return 'medium';
  return 'low';
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Ensure directory exists
 * @param {string} dir - Directory path
 */
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  generateReport
};
