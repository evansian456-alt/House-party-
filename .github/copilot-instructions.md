Copilot Repository Instructions — Phone Party Application

These instructions apply to all pull requests, code reviews, CI repairs, bug fixes, security fixes, deployment fixes, tests, infrastructure changes, and automated actions performed by GitHub Copilot.

Copilot must follow these rules strictly.

These rules are mandatory and non-negotiable.

---

1. System Role

This repository contains the core Phone Party application platform.

The system includes multiple critical subsystems:

• authentication
• account creation
• DJ profiles
• party creation
• party joining
• guest participation
• messaging and reactions
• music synchronization
• uploads
• subscription tiers
• billing systems
• API services
• deployment infrastructure

Copilot must preserve the correct functioning of all systems.

Copilot must fix root causes rather than applying superficial workarounds.

---

2. Absolute Pull Request Completion Rule

A pull request is NOT complete unless ALL of the following are true:

• All unit tests pass
• All integration tests pass
• All E2E tests pass
• All CI workflows succeed
• CodeQL security scans pass
• Deployment checks pass
• No required checks are pending
• No required checks are expected
• No required checks are blocked
• No failing tests remain
• The PR is actually mergeable
• The Merge button is available

If ANY condition above is false:

Copilot must continue investigating and fixing issues until it becomes true.

Copilot must not stop merely because:

• the code compiles
• most tests pass
• CI partially succeeds
• a likely fix was applied
• the issue seems solved

Copilot must confirm the actual PR merge status before claiming completion.

---

3. Mandatory Root Cause Investigation Procedure

When CI fails or tests fail Copilot must perform the following process:

1. Open the latest failing GitHub Actions run
2. Identify the exact failing step
3. Identify failing test names
4. Identify stack traces
5. Identify file paths
6. Identify line numbers
7. Identify the true root cause
8. Fix the root cause in code or configuration
9. Re-run CI
10. Repeat until green

Copilot must never guess when logs are available.

The latest run is the source of truth.

---

4. Test Integrity Protection

Copilot must never weaken tests to make CI pass.

Forbidden actions:

• removing tests
• skipping tests
• disabling tests
• removing assertions
• marking tests TODO
• suppressing legitimate failures
• disabling workflows

Required behavior:

• fix the real code
• fix broken test setup only if the setup is incorrect
• maintain test coverage
• add regression tests when fixing bugs

---

5. API Contract Stability

The Phone Party backend contains multiple API endpoints.

Copilot must maintain API contract stability.

When modifying API code Copilot must verify:

• request field names remain correct
• response shape remains correct
• HTTP status codes are correct
• authentication logic remains correct
• error handling remains consistent

Example endpoints include:

/api/create-party
/api/join-party
/api/leave-party
/api/end-party
/api/party
/api/party-state
/api/me
/api/streaming/providers

Tests must remain aligned with the real intended API behavior.

---

6. Database Safety Rules

The system uses databases such as:

• PostgreSQL
• Redis

Copilot must ensure:

• queries are valid
• migrations succeed
• transactions are handled safely
• connections close properly in tests
• connection pools are stable
• test teardown is clean

When fixing database issues Copilot must repair configuration rather than hiding failures.

---

7. Infrastructure Discipline

Infrastructure includes:

• Redis
• PostgreSQL
• environment variables
• background tasks
• caching
• rate limiting

Copilot must ensure:

• environment variables are respected
• services start correctly in CI
• services shut down cleanly
• infrastructure errors are diagnosed properly

---

8. Frontend Verification Rules

If frontend or browser client code exists Copilot must verify:

• party creation flow
• join flow
• host controls
• guest experience
• messaging/reactions
• profile setup

If frontend code changes Copilot must:

1. start the application locally
2. open the affected pages
3. interact with the UI
4. confirm layout correctness
5. confirm functionality
6. check browser console
7. test responsive behavior

Frontend work is not complete until visually verified.

---

9. Automated Browser Testing

If browser testing frameworks exist such as:

• Playwright
• Cypress
• Puppeteer

Copilot must:

• run tests
• update tests
• add tests for new flows when needed

Critical flows should have E2E coverage.

---

10. CI Self-Healing Behavior

Copilot must behave like a persistent repository maintainer.

After making changes Copilot must:

1. recheck PR status
2. recheck GitHub Actions
3. recheck required checks

If any check remains:

• failing
• pending
• expected
• blocked

Copilot must continue working until everything is green.

---

11. Deployment Rules

The application is deployed using systems such as:

• Docker
• Google Cloud Run
• CI/CD pipelines

Copilot must ensure:

• Docker builds succeed
• containers expose correct ports
• environment variables are respected
• build pipelines remain functional

Broken deployments must be fixed rather than bypassed.

---

12. Security Requirements

Copilot must enforce strong security practices.

Never commit:

• secrets
• API keys
• tokens
• passwords
• credentials

Copilot must fix:

• CodeQL alerts
• injection vulnerabilities
• XSS vulnerabilities
• unsafe input handling
• authentication bypasses

Security issues must be fixed, not hidden.

---

13. Performance Discipline

Copilot must avoid introducing:

• blocking operations
• unnecessary database queries
• memory leaks
• unbounded loops
• inefficient data structures

If performance problems are detected Copilot should suggest improvements.

---

14. Dependency Safety

When updating dependencies Copilot must:

• avoid breaking changes
• verify compatibility
• verify tests still pass

Copilot must avoid unnecessary dependency upgrades.

---

15. Regression Prevention

Whenever Copilot fixes a bug it must:

• identify the root cause
• add regression protection via tests when appropriate

---

16. Review Comment Handling

When responding to review comments Copilot must:

• address the exact issue
• apply fixes correctly
• verify CI again
• ensure no new failures appear

---

17. Reporting Requirements

After making fixes Copilot must report:

• root cause
• failing step
• failing tests
• stack traces
• files changed
• reason for each change
• confirmation tests now pass
• confirmation CI is green
• confirmation PR is mergeable

Copilot must not claim completion unless the PR is mergeable.

---

18. Continuous Repository Maintenance

Copilot should help maintain repository health.

If Copilot detects:

• failing CI
• failing tests
• security alerts
• broken deployment
• outdated dependencies

Copilot should propose pull requests to fix them.

---

19. Final Completion Criteria

Copilot is not finished until ALL of the following are true:

• tests pass
• CI is green
• security scans pass
• deployment checks pass
• PR is mergeable
• Merge button is available

If this is not true:

Copilot must continue working until resolved.
