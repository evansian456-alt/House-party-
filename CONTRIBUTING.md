# Contributing to Phone Party

Thank you for your interest in contributing to Phone Party! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Architecture Overview](#architecture-overview)
- [Common Tasks](#common-tasks)

---

## Development Setup

### Prerequisites

- **Node.js** 14+ (LTS recommended)
- **PostgreSQL** 12+
- **Redis** 6+
- **Git**

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/evansian456-alt/syncspeaker-prototype.git
   cd syncspeaker-prototype
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - Database credentials (PostgreSQL)
   - Redis connection details
   - Session secrets
   - Development mode flags

4. **Initialize the database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE phoneparty;
   
   # Run schema
   psql -U postgres -d phoneparty -f db/schema.sql
   
   # Run migrations
   psql -U postgres -d phoneparty -f db/migrations/001_add_performance_indexes.sql
   ```

5. **Start Redis**
   ```bash
   redis-server
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open http://localhost:3000 in your browser
   - Check console for any errors

---

## Code Style

### General Principles

- **Be consistent**: Follow existing patterns in the codebase
- **Keep it simple**: Prefer clarity over cleverness
- **Comment when necessary**: Explain "why", not "what"
- **Use meaningful names**: Variables and functions should be self-documenting

### JavaScript Style

- **2-space indentation**
- **Semicolons required** at end of statements
- **Single quotes** for strings (unless template literals needed)
- **CamelCase** for variables and functions
- **PascalCase** for classes
- **UPPER_SNAKE_CASE** for constants

### Example

```javascript
// Good
const MAX_GUESTS = 50;
const partyCode = generatePartyCode();

function createParty(userId, options) {
  const party = {
    code: partyCode,
    host: userId,
    guests: [],
  };
  return party;
}

// Avoid
const max_guests = 50;
var partycode = generatePartyCode()

function create_party(userId,options)
{
    var party={code:partycode,host:userId,guests:[]}
    return party
}
```

### File Organization

- **One module per file** when possible
- **Group related functions** together
- **Export at the end** of the file
- **Imports at the top** of the file

### Comments

Use JSDoc for function documentation:

```javascript
/**
 * Calculates drift correction based on threshold levels
 * @param {number} drift - Current drift in milliseconds
 * @param {Object} state - Current sync state
 * @param {number} state.correctionAttempts - Number of failed correction attempts
 * @returns {boolean} True if correction was applied
 */
function applyDriftCorrection(drift, state) {
  // Implementation
}
```

---

## Testing Requirements

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests (Playwright)
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- 01-party-creation
```

### Test Coverage Requirements

- **Minimum 80% line coverage** for new code
- **All bug fixes** must include a regression test
- **All new features** must include tests

### Writing Tests

#### Unit Tests (Jest)

```javascript
// my-module.test.js
const { myFunction } = require('./my-module');

describe('myFunction', () => {
  test('should return expected value', () => {
    const result = myFunction(input);
    expect(result).toBe(expectedOutput);
  });
  
  test('should handle edge case', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

#### E2E Tests (Playwright)

```javascript
// e2e-tests/my-feature.spec.js
const { test, expect } = require('@playwright/test');

test('feature works correctly', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('#myButton');
  await expect(page.locator('#result')).toHaveText('Success');
});
```

---

## Pull Request Process

### Before Creating a PR

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b bugfix/issue-123
   ```

2. **Make your changes**
   - Keep commits focused and atomic
   - Write clear commit messages
   - Follow conventional commit format (optional but recommended):
     - `feat: add keyboard shortcuts`
     - `fix: correct drift calculation`
     - `docs: update API documentation`
     - `test: add unit tests for sync engine`

3. **Test your changes**
   ```bash
   npm test
   npm run test:e2e
   ```

4. **Lint your code** (if linter is configured)
   ```bash
   npm run lint
   ```

5. **Update documentation**
   - Update README.md if needed
   - Add/update JSDoc comments
   - Update relevant docs/ files

### Creating the PR

1. **Push your branch**
   ```bash
   git push origin feature/my-feature
   ```

2. **Open a Pull Request** on GitHub

3. **Fill out the PR template**
   - **Title**: Clear, concise description
   - **Description**: 
     - What changes were made
     - Why these changes are needed
     - Any breaking changes
     - Screenshots (for UI changes)
   - **Testing**: Describe how you tested the changes
   - **Checklist**: Complete the checklist items

### PR Review Process

- **All tests must pass** (CI checks)
- **At least one approval** required
- **No merge conflicts**
- **Code coverage** must not decrease
- **Documentation** must be updated

### Example PR Description

```markdown
## Description
Adds keyboard shortcuts for DJ mode to improve user experience.

## Changes
- Added `Space` for play/pause
- Added `N` for next track
- Added `M` for mute/unmute
- Added `Esc` to exit DJ mode

## Testing
- [x] Tested all shortcuts manually
- [x] Added unit tests for keyboard event handlers
- [x] E2E test added: `17-keyboard-shortcuts.spec.js`
- [x] All existing tests still pass

## Screenshots
![Keyboard shortcuts in action](screenshot.png)

## Breaking Changes
None

## Checklist
- [x] Code follows style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Documentation updated
- [x] Tests added/updated
- [x] All tests passing
```

---

## Architecture Overview

### Key Components

```
syncspeaker-prototype/
├── app.js              # Client-side application (9,663 lines - being refactored)
├── server.js           # Express server (6,493 lines - being refactored)
├── sync-engine.js      # NTP-like clock synchronization
├── sync-client.js      # Client-side sync implementation
├── event-replay.js     # Reliable WebSocket message delivery
├── auth.js             # Authentication logic
├── payment-provider.js # Payment integration (currently simulated)
├── database.js         # PostgreSQL database wrapper
└── constants.js        # Application constants
```

### Important Documentation

- **[README.md](README.md)** - Project overview and setup
- **[docs/SYNC_ARCHITECTURE_EXPLAINED.md](docs/SYNC_ARCHITECTURE_EXPLAINED.md)** - Sync system details
- **[docs/EVENT_REPLAY_SYSTEM.md](docs/EVENT_REPLAY_SYSTEM.md)** - Reliable message delivery
- **[docs/EMOJI_REACTION_SYSTEM.md](docs/EMOJI_REACTION_SYSTEM.md)** - Reaction system
- **[IMPROVEMENT_SUGGESTIONS.md](IMPROVEMENT_SUGGESTIONS.md)** - Planned improvements

### Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express
- **Database**: PostgreSQL 12+
- **Cache**: Redis 6+
- **WebSockets**: ws library
- **Testing**: Jest (unit), Playwright (E2E)

---

## Common Tasks

### Adding a New Feature

1. Check if related to an existing module
2. Create tests first (TDD recommended)
3. Implement the feature
4. Update documentation
5. Create PR

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify test passes
4. Create PR with `Fixes #issue-number` in description

### Adding a New Endpoint

1. Add route handler in `server.js`
2. Add authentication middleware if needed
3. Add rate limiting if appropriate
4. Write unit tests
5. Write E2E tests
6. Update API documentation

### Database Schema Changes

1. Create migration file in `db/migrations/`
2. Use format: `NNN_description.sql`
3. Test migration on clean database
4. Update `db/schema.sql` for new installations
5. Document changes in PR

### Adding Configuration

1. Add to `constants.js` (not hardcoded)
2. Use descriptive constant names
3. Add JSDoc comments
4. Update this guide if needed

---

## Questions or Problems?

- **Check existing issues** on GitHub
- **Read the documentation** in the `docs/` folder
- **Ask in discussions** for general questions
- **Open an issue** for bugs or feature requests

---

## Code of Conduct

- **Be respectful** and constructive
- **Welcome newcomers** and help them learn
- **Focus on the code**, not the person
- **Collaborate positively** toward better solutions

---

## License

By contributing to Phone Party, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing! 🎉
