# Panel v5 Refinement Implementation Plan

> **For agentic workers:** Use subagent-driven-development for implementation and independent specification/code-quality review. Complete each task with test-first checks; do not merge or install.

**Goal:** Deliver SPAC v5 account controls, numeric history, truthful FAB balance cells, and account-safe BEM/FAB manual refresh on PR #4.

**Architecture:** Keep the existing React/Tauri application and namespaced SQLite cache. Split request identity from selected-project alert identity; represent manual refresh progress in the dashboard independently of visible jobs. Use shared presentation components with source-aware unknown values.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Rust, Tauri 2, SQLite.

## Baseline and ownership

Work in the existing clean `codex/panel-v5-refinement` checkout. No new worktree, user-profile migration, installation replacement, or public release. Retain v0.4.0 until release packaging is separately requested. Use synthetic test wallets only.

## Task 1: Cross-project refresh runtime

Files: `src-tauri/src/runtime.rs`, `src-tauri/src/shell.rs`; add a focused batch/request module if required to keep scheduling and request-state transitions testable.

- [x] Write failing tests for a manual batch containing both projects' address/market/network jobs, empty-wallet omission, duplicate/in-flight admission, cooldown/backoff, and independent completion outcomes.
- [x] Write failing tests for project-switch acceptance, account switch-away/back rejection, token-safe late completion, and selected-project-only alert eligibility.
- [x] Run `cargo test` and record the expected failures before production changes.
- [x] Implement explicit request context and typed batch status. Request identity includes account revision for address resources and per-job token; project changes reset only alert context, not valid request/cache ownership. Keep bounded request concurrency of two and existing retry rules.
- [x] Register `refresh_all`; retain existing `refresh_resource` compatibility. Serialize all batch admission under the engine lock. In-flight resources belong to the batch until they settle; deferred jobs are reported, not silently successful.
- [x] Expose `refreshBatch` independently of selected dashboard jobs. Each resource entry has resource, status (`pending`, `refreshed`, `deferred`, `failed`, `cancelled`) and optional error; busy derives from pending entries. Resource names are existing BEM keys and FAB-prefixed keys. Never mix inactive-project baselines/notifications.
- [x] Run Rust tests, formatting, and clippy. Commit only the backend task files after self-review; then obtain specification review and code-quality review.

Frontend contract (additive dashboard field):

```typescript
type RefreshEntry = {
  resource: string;
  status: "pending" | "refreshed" | "deferred" | "failed" | "cancelled";
  error?: string;
};
type RefreshBatch = { busy: boolean; entries: RefreshEntry[] };
// Dashboard.refreshBatch is optional for old fixtures; native always supplies it.
// command<RefreshBatch>("refresh_all") admits or returns the active batch.
```

## Task 2: Refined presentation and refresh integration

Files: `src/AccountSelector.tsx` (new), `src/AccountManager.tsx`, `src/MonitorSections.tsx`, `src/FabNetwork.tsx`, `src/PowerHistory.tsx`, `src/App.tsx`, `src/bridge.ts`, `src/SettingsPanel.tsx`, `src/i18n.ts`, `src/styles.css`, corresponding tests.

- [x] Write and run failing UI tests for shared account selection, keyboard/focus/dismissal, trailing Edit, rename/cancel/removal, and `中文 | EN`.
- [x] Write and run failing chart tests for latest values/times, constant domains, Y labels, single-sample state, and nearest-point keyboard/pointer inspection.
- [x] Write and run failing integration tests for `refresh_all`, global busy across project changes, visible inactive-project failure/deferred outcomes, exact row removal, and unsupported FAB BEM/OKB balances without relabeling existing assets.
- [x] Implement the shared account-name popover/listbox with short addresses and selection checkmarks. Avoid nested buttons and preserve serialized persistence/error rollback.
- [x] Replace permanent account editing disclosures with trailing Edit buttons and conditional rename/remove forms. Keep public address read-only. Preserve existing validation and settings order.
- [x] Remove marked full-width supporting rows while retaining exact source detail and independent price/address freshness. Render BEM/BNB in BEM and BEM/OKB in FAB, with unsupported cells explicitly unavailable; do not add guessed provider mappings.
- [x] Implement numeric chart labels, latest sample time/value, and keyboard/pointer sample inspection within reserved margins. Never fabricate samples; clear selection on account/project changes and honor suspended native selection.
- [x] Add the typed refresh contract to native and memory-preview adapters. Render batch-wide progress/outcomes without falsely marking deferred/failed work updated. Keep active-project automatic jobs compatible.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`. Commit focused files after self-review, then obtain specification and code-quality review.

Representative behavior assertions:

```typescript
expect(screen.getByRole("button", { name: "中文" })).toBeTruthy();
expect(screen.queryByText("FAB 余额")).toBeNull();
expect(screen.getByText("OKB 余额")).toBeTruthy();
expect(screen.queryByText("0.12345678")).toBeNull(); // Legacy FAB balance is not BEM.
expect(mock.command).toHaveBeenCalledWith("refresh_all");
```

## Task 3: Integration, visual validation, and PR handoff

- [x] Inspect the full diff against SPAC v5 and fix reviewer findings with regression tests.
- [x] Run the full frontend commands above and `cargo fmt --check`, `cargo test`, `cargo clippy --all-targets -- -D warnings`.
- [x] Inspect the real preview with synthetic data at 420 × 720; exercise both projects/themes/languages, long accounts, account editor, empty/flat/varying history, focus, and refresh errors. Save only synthetic screenshots if committed.
- [x] Add `docs/validation/panel-v5/RESULTS.md` with actual commands/results, official balance-data limitation, native/Windows coverage gaps, and no-install statement.
- [x] Push implementation commits to PR #4 and inspect macOS/Windows CI; both passed for `0839b92`. Reviews and local verification passed. Track later documentation-only CI and ready-for-review delivery in PR #4; do not merge, publish, or replace the installed app.
