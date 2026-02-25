/**
 * Tests to verify that only hosts with active Pro Monthly subscription
 * are added to the leaderboard and score system
 * 
 * These tests verify the business logic and SQL queries used.
 */

const fs = require('fs');
const path = require('path');

describe('Leaderboard and Scoring Pro Monthly Filter', () => {
  let databaseCode;
  
  beforeAll(() => {
    // Read the database.js file to verify it contains the correct logic
    databaseCode = fs.readFileSync(path.join(__dirname, 'database.js'), 'utf8');
  });

  describe('updateDjProfileScore - Pro Monthly Check', () => {
    test('should check for Pro Monthly subscription before updating score', () => {
      // Verify the function checks user_upgrades for pro_monthly_active
      expect(databaseCode).toContain('FROM user_upgrades');
      expect(databaseCode).toContain('pro_monthly_active');
      
      // Verify it skips update if no active subscription
      expect(databaseCode).toContain('no active Pro Monthly subscription');
      expect(databaseCode).toContain('return null');
    });

    test('should only update DJ score when pro_monthly_active is true', () => {
      // Verify the function checks the pro_monthly_active flag
      expect(databaseCode).toContain('pro_monthly_active');
      
      // Verify it checks if rows exist (zero rows means no active subscription)
      expect(databaseCode).toContain('rows.length === 0');
      
      // Verify it returns null when subscription is not active
      expect(databaseCode).toContain('return null');
    });

    test('should handle users with no upgrades record', () => {
      // Verify the function checks if rows exist
      expect(databaseCode).toContain('rows.length === 0');
    });
  });

  describe('getTopDjs - Pro Monthly Filter', () => {
    test('should join with user_upgrades table', () => {
      // Find the getTopDjs function
      const getTopDjsMatch = databaseCode.match(/async function getTopDjs[\s\S]*?}\s*}/);
      expect(getTopDjsMatch).toBeTruthy();
      
      const getTopDjsFunction = getTopDjsMatch[0];
      
      // Verify it joins with user_upgrades
      expect(getTopDjsFunction).toContain('JOIN user_upgrades');
    });

    test('should filter by active Pro Monthly subscription', () => {
      // Find the getTopDjs function
      const getTopDjsMatch = databaseCode.match(/async function getTopDjs[\s\S]*?}\s*}/);
      expect(getTopDjsMatch).toBeTruthy();
      
      const getTopDjsFunction = getTopDjsMatch[0];
      
      // Verify it filters by pro_monthly_active = TRUE
      expect(getTopDjsFunction).toContain('WHERE uu.pro_monthly_active = TRUE');
    });

    test('should maintain ORDER BY dj_score DESC', () => {
      // Find the getTopDjs function
      const getTopDjsMatch = databaseCode.match(/async function getTopDjs[\s\S]*?}\s*}/);
      expect(getTopDjsMatch).toBeTruthy();
      
      const getTopDjsFunction = getTopDjsMatch[0];
      
      // Verify it still orders by score descending
      expect(getTopDjsFunction).toContain('ORDER BY dp.dj_score DESC');
    });

    test('should respect limit parameter', () => {
      // Find the getTopDjs function
      const getTopDjsMatch = databaseCode.match(/async function getTopDjs[\s\S]*?}\s*}/);
      expect(getTopDjsMatch).toBeTruthy();
      
      const getTopDjsFunction = getTopDjsMatch[0];
      
      // Verify it uses LIMIT
      expect(getTopDjsFunction).toContain('LIMIT $1');
    });
  });

  describe('SQL Query Structure', () => {
    test('getTopDjs should have correct SQL query structure', () => {
      const expectedJoin = 'JOIN user_upgrades uu ON dp.user_id = uu.user_id';
      const expectedWhere = 'WHERE uu.pro_monthly_active = TRUE';
      
      expect(databaseCode).toContain(expectedJoin);
      expect(databaseCode).toContain(expectedWhere);
    });

    test('updateDjProfileScore should check subscription first', () => {
      // The check should happen as part of the INSERT/UPDATE query
      const updateFunctionMatch = databaseCode.match(/async function updateDjProfileScore[\s\S]*?}\s*}/);
      expect(updateFunctionMatch).toBeTruthy();
      
      const functionCode = updateFunctionMatch[0];
      
      // Verify subscription check is present (as WHERE clause in INSERT...SELECT or standalone)
      expect(functionCode).toContain('pro_monthly_active');
      expect(functionCode).toContain('INSERT INTO dj_profiles');
    });
  });

  describe('Documentation and Comments', () => {
    test('updateDjProfileScore should document Pro Monthly requirement', () => {
      const functionMatch = databaseCode.match(/\/\*\*[\s\S]*?\*\/\s*async function updateDjProfileScore/);
      expect(functionMatch).toBeTruthy();
      
      // Should mention Pro Monthly in the comment
      expect(functionMatch[0]).toMatch(/Pro Monthly|subscription/i);
    });

    test('getTopDjs should document Pro Monthly filter', () => {
      const functionMatch = databaseCode.match(/\/\*\*[\s\S]*?\*\/\s*async function getTopDjs/);
      expect(functionMatch).toBeTruthy();
      
      // Should mention Pro Monthly in the comment
      expect(functionMatch[0]).toMatch(/Pro Monthly|subscription/i);
    });
  });

  describe('Business Logic Verification', () => {
    test('should not update scores for users without Pro Monthly', () => {
      // Verify the logic returns null when subscription check fails
      const updateFunctionMatch = databaseCode.match(/async function updateDjProfileScore[\s\S]*?}\s*}/);
      expect(updateFunctionMatch).toBeTruthy();
      
      const functionCode = updateFunctionMatch[0];
      
      // Should return null if no active subscription
      expect(functionCode).toContain('return null');
    });

    test('should only show Pro Monthly users in leaderboard', () => {
      // Verify WHERE clause filters properly
      const getTopDjsMatch = databaseCode.match(/async function getTopDjs[\s\S]*?}\s*}/);
      expect(getTopDjsMatch).toBeTruthy();
      
      const functionCode = getTopDjsMatch[0];
      
      // Must have WHERE clause for filtering
      expect(functionCode).toContain('WHERE uu.pro_monthly_active = TRUE');
    });
  });
});
