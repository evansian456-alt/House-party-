# Repository Cleanup Quarantine — 2026-03-05

Files moved out of the repository root during the 2026-03-05 codebase cleanup.
They are preserved here for traceability and can be restored if needed.

> **Nothing here affects runtime.** All files moved here are documentation
> (`.md`) or helper shell scripts. No source code, tests, or configuration
> was modified.

---

## How To Restore a File

1. Run `git mv <current-path> <original-path>` from the repo root.
2. Verify the application still works (`npm start`, `npm test`).

---

## Markdown Docs Moved to `docs/` (organized into sub-directories)

| Original File Path | Moved To | Reason | Date |
|---|---|---|---|
| `ACTION_PLAN.md` | `docs/archive/ACTION_PLAN.md` | Implementation notes | 2026-03-05 |
| `AMPSYNC_QUICK_REF.md` | `docs/architecture/AMPSYNC_QUICK_REF.md` | Feature reference | 2026-03-05 |
| `ANDROID_*.md` (14 files) | `docs/android/` | Android audit/deployment docs | 2026-03-05 |
| `ARCHITECTURE_*.md` | `docs/architecture/` | Architecture diagrams | 2026-03-05 |
| `AUDIT_COMPLETE_SUMMARY.md` | `docs/audit/` | Audit report | 2026-03-05 |
| `CAPABILITY_MAP.md` | `docs/audit/` | Feature map | 2026-03-05 |
| `CLEANUP_IMPLEMENTATION_GUIDE.md` | `docs/audit/` | Cleanup guide | 2026-03-05 |
| `CODEBASE_AUDIT_REPORT.md` | `docs/audit/` | Audit report | 2026-03-05 |
| `CODE_REVIEW_FIXES.md` | `docs/audit/` | Review notes | 2026-03-05 |
| `COMPREHENSIVE_E2E_*.md` | `docs/testing/` | Test reports | 2026-03-05 |
| `CONFLICTS_RESOLVED.md` | `docs/pr-history/` | Merge history | 2026-03-05 |
| `CREATE_PARTY_*.md` | `docs/implementation/` | Implementation notes | 2026-03-05 |
| `DEPLOYMENT_AUTOMATION_GUIDE.md` | `docs/deployment/` | Deployment guide | 2026-03-05 |
| `DEPLOYMENT_READINESS_CHECKLIST.md` | `docs/deployment/` | Deployment checklist | 2026-03-05 |
| `DIRECT_CDN_PLAYBACK_IMPLEMENTATION.md` | `docs/implementation/` | CDN implementation notes | 2026-03-05 |
| `EMOJI_AUDIT_COMPLETE.md` | `docs/archive/` | Audit report | 2026-03-05 |
| `EVENT_REPLAY_IMPLEMENTATION_SUMMARY.md` | `docs/implementation/` | Feature summary | 2026-03-05 |
| `FINAL_DELIVERY_REPORT.md` | `docs/archive/` | Delivery report | 2026-03-05 |
| `GUEST_REACTIONS_FIX.md` | `docs/implementation/` | Bug fix notes | 2026-03-05 |
| `HOST_FAILOVER_*.md` | `docs/implementation/` or `docs/testing/` | Feature docs | 2026-03-05 |
| `IMPLEMENTATION_*.md` (multiple) | `docs/implementation/` | Implementation notes | 2026-03-05 |
| `IMPROVEMENT_*.md` | `docs/audit/` | Improvement guides | 2026-03-05 |
| `LEADERBOARD_PRO_MONTHLY_FILTER.md` | `docs/implementation/` | Feature notes | 2026-03-05 |
| `MANUAL_TEST_PLAN_UPLOAD.md` | `docs/testing/` | Test plan | 2026-03-05 |
| `MERGE_RESOLUTION_*.md` | `docs/pr-history/` | Merge history | 2026-03-05 |
| `MISSING_FEATURES.md` | `docs/implementation/` | Roadmap notes | 2026-03-05 |
| `MUSIC_SYNC_*.md` | `docs/testing/` | Sync feature docs | 2026-03-05 |
| `NEW_DOCS_README.md` | `docs/archive/` | Docs index | 2026-03-05 |
| `NEXT_STEPS.md` | `docs/archive/` | Roadmap | 2026-03-05 |
| `OBSERVABILITY_IMPLEMENTATION.md` | `docs/implementation/` | Feature notes | 2026-03-05 |
| `PAYMENT_INTEGRATION_GUIDE.md` | `docs/archive/` | Payment integration | 2026-03-05 |
| `PHASE_8_9_10_SUMMARY.md` | `docs/archive/` | Phase summary | 2026-03-05 |
| `PRODUCTION_UPGRADE_*.md` | `docs/implementation/` | Production docs | 2026-03-05 |
| `PR_*.md` (multiple) | `docs/pr-history/` | PR management | 2026-03-05 |
| `PWA_*.md` | `docs/pwa/` | PWA docs | 2026-03-05 |
| `QUICK_*.md` | `docs/archive/` | Quick reference | 2026-03-05 |
| `RAILWAY_*.md` | `docs/deployment/` | Deployment docs | 2026-03-05 |
| `README_ANDROID_AUDIT.md` | `docs/android/` | Android audit readme | 2026-03-05 |
| `READY_GATING_*.md` | `docs/implementation/` or `docs/testing/` | Feature docs | 2026-03-05 |
| `ROADMAP_VISUAL.md` | `docs/architecture/` | Roadmap | 2026-03-05 |
| `ROLLBACK_UPLOAD_TRACK.md` | `docs/pr-history/` | Rollback notes | 2026-03-05 |
| `SECURITY_*.md` (multiple) | `docs/security/` | Security summaries | 2026-03-05 |
| `SONG_SYNC_IMPROVEMENTS.md` | `docs/implementation/` | Feature notes | 2026-03-05 |
| `START_HERE_ANDROID.md` | `docs/android/` | Android guide | 2026-03-05 |
| `SYNCSPEAKER_AMPSYNC_DOCS.md` | `docs/architecture/` | Feature docs | 2026-03-05 |
| `SYNC_*.md` | `docs/architecture/` or `docs/implementation/` | Sync docs | 2026-03-05 |
| `TASK_*.md` (multiple) | `docs/archive/` | Task completion notes | 2026-03-05 |
| `TECHNICAL_AUDIT_MULTI_DEVICE_SYNC.md` | `docs/audit/` | Audit report | 2026-03-05 |
| `TEST_COVERAGE_MAP.md` | `docs/testing/` | Test coverage | 2026-03-05 |
| `TEST_EXECUTION_SUMMARY.md` | `docs/testing/` | Test results | 2026-03-05 |
| `VERIFICATION_QUICK_START.md` | `docs/testing/` | Verification guide | 2026-03-05 |
| `VISUAL_SUMMARY.md` | `docs/architecture/` | Visual summary | 2026-03-05 |
| `WHY_85_PERCENT_ANDROID_READY.md` | `docs/android/` | Android readiness | 2026-03-05 |

## Shell Scripts Moved to `scripts/`

| Original File Path | Moved To | Reason | Date |
|---|---|---|---|
| `check-all-prs.sh` | `scripts/check-all-prs.sh` | Utility script | 2026-03-05 |
| `resolve-pr-conflicts.sh` | `scripts/resolve-pr-conflicts.sh` | Utility script | 2026-03-05 |
| `run-e2e-tests.sh` | `scripts/run-e2e-tests.sh` | Utility script | 2026-03-05 |
| `generate-e2e-report.js` | `scripts/generate-e2e-report.js` | Utility script | 2026-03-05 |
| `test-crash-fix.js` | `scripts/test-crash-fix.js` | Manual test helper | 2026-03-05 |
| `test-upload-manual.js` | `scripts/test-upload-manual.js` | Manual test helper | 2026-03-05 |
| `validate-pwa.js` | `scripts/validate-pwa.js` | Utility script | 2026-03-05 |

## Notes

- No source code or test files were deleted
- All moves tracked by git; history is preserved
- Application runtime is unaffected
- `package.json` scripts updated for moved files
