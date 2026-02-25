/**
 * Test Discovery Module
 * 
 * Discovers and categorizes all E2E test files in the project.
 * Supports both Playwright (.spec.js) and Jest (.test.js) test files.
 */

const fs = require('fs');
const path = require('path');

/**
 * Test categories based on feature areas
 */
const TEST_CATEGORIES = {
  AUTH: 'auth',
  PRICING: 'pricing',
  PARTY: 'party',
  MUSIC: 'music',
  REACTIONS: 'reactions',
  MESSAGING: 'messaging',
  ANIMATIONS: 'animations',
  NAVIGATION: 'navigation',
  ERROR_HANDLING: 'error_handling',
  INTEGRATION: 'integration'
};

/**
 * Discover all E2E test files in a directory
 * @param {string} testDir - Directory to search for tests
 * @returns {Array} Array of test file objects with metadata
 */
function discoverTests(testDir) {
  const tests = [];
  
  if (!fs.existsSync(testDir)) {
    console.warn(`Test directory not found: ${testDir}`);
    return tests;
  }
  
  const files = fs.readdirSync(testDir);
  
  for (const file of files) {
    const filePath = path.join(testDir, file);
    const stat = fs.statSync(filePath);
    
    // Skip directories
    if (stat.isDirectory()) {
      continue;
    }
    
    // Check if it's a test file
    if (file.endsWith('.spec.js') || file.endsWith('.test.js')) {
      const testInfo = analyzeTestFile(filePath, file);
      tests.push(testInfo);
    }
  }
  
  return tests;
}

/**
 * Analyze a test file to extract metadata
 * @param {string} filePath - Full path to test file
 * @param {string} fileName - Name of the file
 * @returns {Object} Test file metadata
 */
function analyzeTestFile(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Determine category from filename
  const category = categorizeTest(fileName, content);
  
  // Count test cases
  const testCount = countTests(content);
  
  // Determine framework
  const framework = fileName.endsWith('.spec.js') ? 'playwright' : 'jest';
  
  // Extract test descriptions
  const testDescriptions = extractTestDescriptions(content);
  
  return {
    fileName,
    filePath,
    category,
    framework,
    testCount,
    testDescriptions,
    priority: determinePriority(fileName, category)
  };
}

/**
 * Categorize test based on filename and content
 * @param {string} fileName - Test file name
 * @param {string} content - Test file content
 * @returns {string} Test category
 */
function categorizeTest(fileName, content) {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('auth') || lowerName.includes('account') || lowerName.includes('login')) {
    return TEST_CATEGORIES.AUTH;
  }
  if (lowerName.includes('pricing') || lowerName.includes('purchase') || lowerName.includes('tier')) {
    return TEST_CATEGORIES.PRICING;
  }
  if (lowerName.includes('party') && !lowerName.includes('full')) {
    return TEST_CATEGORIES.PARTY;
  }
  if (lowerName.includes('music') || lowerName.includes('queue') || lowerName.includes('playback')) {
    return TEST_CATEGORIES.MUSIC;
  }
  if (lowerName.includes('reaction') || lowerName.includes('emoji') || lowerName.includes('crowd')) {
    return TEST_CATEGORIES.REACTIONS;
  }
  if (lowerName.includes('messag') || lowerName.includes('chat') || lowerName.includes('notification')) {
    return TEST_CATEGORIES.MESSAGING;
  }
  if (lowerName.includes('animation') || lowerName.includes('visual')) {
    return TEST_CATEGORIES.ANIMATIONS;
  }
  if (lowerName.includes('navigation') || lowerName.includes('route')) {
    return TEST_CATEGORIES.NAVIGATION;
  }
  if (lowerName.includes('error') || lowerName.includes('edge')) {
    return TEST_CATEGORIES.ERROR_HANDLING;
  }
  if (lowerName.includes('full') || lowerName.includes('e2e') || lowerName.includes('integration') || lowerName.includes('smoke')) {
    return TEST_CATEGORIES.INTEGRATION;
  }
  
  return 'other';
}

/**
 * Count test cases in content
 * @param {string} content - Test file content
 * @returns {number} Number of test cases
 */
function countTests(content) {
  // Match test() or it() function calls
  const testMatches = content.match(/\b(test|it)\s*\(/g);
  return testMatches ? testMatches.length : 0;
}

/**
 * Extract test descriptions from content
 * @param {string} content - Test file content
 * @returns {Array} Array of test descriptions
 */
function extractTestDescriptions(content) {
  const descriptions = [];
  
  // Match test descriptions: test('description', ...) or it('description', ...)
  const regex = /\b(test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    descriptions.push(match[2]);
  }
  
  return descriptions;
}

/**
 * Determine test priority based on filename and category
 * @param {string} fileName - Test file name
 * @param {string} category - Test category
 * @returns {number} Priority (lower number = higher priority)
 */
function determinePriority(fileName, category) {
  // Prechecks should run first
  if (fileName.includes('00-') || fileName.includes('precheck')) {
    return 0;
  }
  
  // Authentication tests should run early
  if (category === TEST_CATEGORIES.AUTH) {
    return 1;
  }
  
  // Pricing/purchases
  if (category === TEST_CATEGORIES.PRICING) {
    return 2;
  }
  
  // Party management
  if (category === TEST_CATEGORIES.PARTY) {
    return 3;
  }
  
  // Feature tests
  if ([TEST_CATEGORIES.MUSIC, TEST_CATEGORIES.REACTIONS, TEST_CATEGORIES.MESSAGING].includes(category)) {
    return 4;
  }
  
  // UI tests
  if ([TEST_CATEGORIES.ANIMATIONS, TEST_CATEGORIES.NAVIGATION].includes(category)) {
    return 5;
  }
  
  // Error handling
  if (category === TEST_CATEGORIES.ERROR_HANDLING) {
    return 6;
  }
  
  // Integration tests should run last
  if (category === TEST_CATEGORIES.INTEGRATION) {
    return 7;
  }
  
  return 8;
}

/**
 * Sort tests by priority
 * @param {Array} tests - Array of test objects
 * @returns {Array} Sorted tests
 */
function sortTestsByPriority(tests) {
  return tests.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.fileName.localeCompare(b.fileName);
  });
}

/**
 * Generate test execution plan
 * @param {string} testDir - Test directory
 * @returns {Object} Execution plan with metadata
 */
function generateTestPlan(testDir) {
  const tests = discoverTests(testDir);
  const sortedTests = sortTestsByPriority(tests);
  
  // Group by category
  const byCategory = {};
  for (const test of sortedTests) {
    if (!byCategory[test.category]) {
      byCategory[test.category] = [];
    }
    byCategory[test.category].push(test);
  }
  
  // Generate statistics
  const totalTests = sortedTests.length;
  const totalTestCases = sortedTests.reduce((sum, test) => sum + test.testCount, 0);
  const playwrightTests = sortedTests.filter(t => t.framework === 'playwright').length;
  const jestTests = sortedTests.filter(t => t.framework === 'jest').length;
  
  return {
    tests: sortedTests,
    byCategory,
    statistics: {
      totalTestFiles: totalTests,
      totalTestCases,
      playwrightTests,
      jestTests,
      categories: Object.keys(byCategory)
    }
  };
}

module.exports = {
  discoverTests,
  generateTestPlan,
  sortTestsByPriority,
  TEST_CATEGORIES
};
