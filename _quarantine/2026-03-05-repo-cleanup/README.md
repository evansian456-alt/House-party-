# Quarantine — 2026-03-05 Repo Cleanup

Files moved here during the codebase cleanup performed on 2026-03-05.

These files were moved because they were **uncertain** as to whether they are
still actively used, or because they are clearly superseded implementation
notes, completion summaries, or one-off scripts that no longer serve a
runtime purpose.

> **Nothing here affects runtime.** All files moved here are documentation
> (`.md`) or helper shell scripts that were at the repository root but
> should live elsewhere.

---

## How To Restore a File

1. Copy the file back to its **Original File Path** listed below.
2. Verify the application still works (`npm start`, `npm test`).
3. Remove it from this folder.

---

## Quarantined Files

| Original File Path | Reason For Quarantine | Date Moved |
|---|---|---|
| (see sub-directories) | Moved from repo root into docs/ sub-folders | 2026-03-05 |

---

## Notes

Root-level markdown files (except `README.md`, `CONTRIBUTING.md`, and `FAQ.md`)
were relocated into `docs/` sub-directories.  This does not affect the
application, tests, or CI.
