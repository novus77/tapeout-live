# Frosted Panel v4 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution and superpowers:requesting-code-review for independent spec and quality review. Do not merge or install.

**Goal:** Implement the approved SPAC and reference in one 420 × 720 desktop panel.

**Architecture:** Retain the TapeOutScan adapters, scheduler, and namespaced SQLite cache. Separate appearance resolution, settings UI, and power-history presentation from monitoring. Native material setup lives behind a platform adapter, with an opaque fallback.

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, SQLite, Vitest, local SVG icons.

## Working context

Continue on `codex/frosted-panel-v4` (PR #3), not `main`. The checkout is clean before this work. Preserve installed app/database, existing data contracts, and preferences. The accepted reference is `docs/references/frosted-panel-v4/index.html` and `settings-order.png`. Source, comments, and documentation use English; UI is bilingual.

## Task 1 — Appearance contract and migration

Files: `src/bridge.ts`, `src/appearance.ts`, `src/appearance.test.ts`, `src-tauri/src/domain.rs`, `src-tauri/src/storage.rs` tests.

- [x] Add failing tests for legacy defaults, manual/system resolution and restoration, unknown theme rejection, and recovery-backup round-trip.
- [x] Run `npm test` and `cargo test --manifest-path src-tauri/Cargo.toml --offline`; confirm the new assertions fail before implementation.
- [x] Extend both Settings definitions using the exact shared contract:

```typescript
type AppearanceSettings = {
  theme: "light" | "dark";
  followSystemTheme: boolean;
};
const effectiveTheme = (settings: AppearanceSettings, systemDark: boolean) =>
  settings.followSystemTheme ? (systemDark ? "dark" : "light") : settings.theme;
```

- [x] Default missing fields to light/false through serde defaults; validate theme without modifying old settings/history namespaces.
- [x] Keep theme subscription independent from polling and clean it up. Re-run tests, then inspect migration diff.

## Task 2 — Fixed overview and settings

Files: `src/App.tsx`, `src/SettingsPanel.tsx`, `src/AccountManager.tsx`, `src/MonitorSections.tsx`, `src/FabNetwork.tsx`, `src/PowerHistory.tsx`, `src/i18n.ts`, `src/styles.css`, tests.

- [x] Add DOM failures for settings-gear navigation, exact six-control order, follow-system disabling, manual restoration, save failures, add/cancel/duplicate/remove-account behavior, and no expanded circuit/activity/material content.
- [x] Retain original BEM/FAB selection and immediate prior-address clearing tests; update language interactions to occur in settings.
- [x] Implement shared header and gear-controlled body. Network stays above My mining; retain true freshness/error labels, BEM/BNB vs FAB balances, and empty-state onboarding.
- [x] Settings saves one mutation at a time. Gate synchronous click handlers with a ref as well as pending UI state; rejected saves retain confirmed preferences. Account removal clears wallet/alias when list becomes empty.
- [x] Add history tests for finite nonnegative values, ordered timestamps within 24 hours, fewer than two points, and late account/project responses. Use provider points only when valid and scoped, otherwise `get_history`; never merge series.
- [x] Style semantic warm/smoke tokens from the approved reference; fix panel size, cap account-list height, permit vertical-only scroll for exceptional content, add forced-colors/reduced-motion fallback.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; inspect rendered overview/settings in both languages and themes.

## Task 3 — Native material and icons

Files: `src-tauri/src/appearance.rs`, `src-tauri/src/shell.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/Icons.tsx`, local brand/icon assets, attribution.

- [x] Add native policy tests: retained manual choice, follow-system, accessibility fallback, unsupported effect fallback. Inspect bundled Tauri/OS APIs before integration.
- [x] Configure transparent window/webview and UI-thread native material without changing geometry, focus-loss policy, or work-area positioning. Return material status to the frontend so failure is opaque, not merely logged.
- [x] Resolve native/system theme before first show, react to system changes, preserve manual choice while following system, and respect OS accessibility settings where exposed. Material failure must leave a readable panel.
- [x] Replace cube branding with the supplied double-wing source and regular action SVGs from the frozen reference; retain Phosphor MIT license. Generate padded platform PNG/.icns/.ico and alpha tray variants from local source; no remote image service.
- [x] Run Rust tests, rustfmt, clippy, and macOS bundle build. Record Windows and multi-monitor limitations rather than claiming hardware verification from CI.

## Task 4 — Review and delivery

Files: validation record, PR #3.

- [x] Review spec compliance first, then code quality with a fresh reviewer; fix important findings and re-run affected tests.
- [x] Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- [x] Save UI proof, document native/unavailable hardware checks, inspect git diff and source-only scope.
- [x] Commit/push implementation to existing PR #3, update title/body and ready status only when implementation checks/review pass. Inspect macOS/Windows CI; report pending checks honestly. Leave main and installed application unchanged.
