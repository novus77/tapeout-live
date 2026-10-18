# Miner Production Panel SPAC

Status: implemented and locally verified; submission and installation pending user authorization. This supersedes earlier dashboard layout descriptions, not account or refresh behavior.

## Scope and intent

Show network context, selected-wallet totals, and per-miner estimated production on one fixed 420 × 520 logical-point panel on macOS and Windows. Follow the approved local prototype. Keep the existing themes, account-project tags, locale, refresh admission, and native positioning. No transactions, claim actions, history charts, new data providers, installer replacement, release, or automatic Git commits.

## Presentation

1. Header: brand, BEM/FAB selector, Settings, Refresh. Keep all actions accessible.
2. Network: price and total network power in two adjacent cells. Exactly one metadata row: verified weight, indexed miners, daily emission. Remove unverified weight and source-note rows for both projects. Preserve observation age and FAB reference-quote caveats in accessible metric descriptions/tooltips.
3. Wallet: existing project-filtered account selector and copyable address. Power and estimated daily output become two compact primary metrics. Miner count and optimal positions become an inline secondary row; balances remain a separate compact row. Do not calculate totals from partially loaded miners.
4. Miner detail section: heading, loaded/indexed coverage, power-descending default sort with daily-descending and ID-ascending options; localized search by processor, task ID/name, circuit IDs; independently scrollable results. Header and wallet summary do not scroll with results. No horizontal overflow at the fixed panel size.
5. Each row shows processor + circuit ID, explicit state, task name, available pool classification, power, and estimated daily output. Native disclosure expands inline to show processor address, task ID, optimal flag, grouping/IDs, and available verified/unverified FAB weights. No separate screen or link.
6. Settings retains its existing full-height scrolling layout. Browser-preview and error notices may consume dashboard space, but remain bounded and must not push the panel beyond its fixed size.

## Data contract

TapeOutScan remains the sole provider. BEM uses normalized `summary` and `circuits`: `current_hashrate`, `estimated_daily_bem`, `status`, `pool`, `is_champion`, `task_id`, `task_name`, `processor_address`, `count`, `circuit_ids`. Rows with multiple IDs or count > 1 are explicitly groups. Do not divide group metrics, duplicate a group into individual rows, or present unknown group semantics as per-miner production; show unavailable numeric metrics for groups and expose IDs/count in the disclosure.

FAB uses existing normalized address rows. Preserve optional `verifWeight` / `unverWeight` as validated nonnegative decimal strings (`verified_weight` / `unverified_weight`). Gate per-row estimated production on explicit `availability.miningStarted === true`, as already done for summary estimates. No SQL schema or settings migration is required. Existing cached rows missing new fields remain usable and show unknown weights.

FAB miner fetch remains capped at 100 records for this iteration: display loaded/indexed counts when incomplete, never imply all miners have loaded, and do not implement speculative pagination. BEM group count is distinct from underlying miner count. Missing values remain `—`; unknown state is never inferred as inactive. Zero remains a legitimate value. Format FAB output with up to eight decimals. Sort decimal strings without converting large integers through Number. Missing metrics sort last.

Wallet/project transitions unmount and reset search, sorting, disclosure and scroll context. Render no rows from mismatched snapshot owner/resource or an account not tagged for the current project. Refresh does not replace source identity or reconstruct missing data. Existing manual refresh still requests both global projects and selected-wallet tagged resources.

## Acceptance and verification

- Both projects have two main network cells and one metadata row; no unverified/source line.
- Both languages support searching, sorting, disclosure, empty/indexing/loading, partial coverage and grouping labels.
- Per-row BEM/FAB daily estimates use the correct field and unit; no fabricated claimable rewards, percentage, or OKB balance.
- Large decimal sorting, zeros, missing fields, grouped rows, partial FAB results and cross-wallet snapshots have regression coverage.
- Fixed native dimensions and tray behavior unchanged. Browser inspection checks light/dark themes, long values, mixed states and independent scrolling.
- Run frontend tests, typecheck, lint, format, production build; Rust fmt/test/clippy and macOS app packaging. Windows verification is limited to portable source/logic until CI is explicitly submitted.

## Rollout

Develop on `codex/miner-production-details`. Keep changes uncommitted for review unless the user requests submission. Do not move the v0.4.0 tag or overwrite release assets. A future approved release should use a new version.

## Verification record (2026-10-18)

- Frontend: 68 tests passed; typecheck, lint, formatting, production build passed.
- Rust: 60 tests passed, 2 public-network tests intentionally ignored; fmt and clippy passed.
- macOS application bundle built successfully. No installed application or user profile was changed. No Windows hardware or installer run was performed.
- Browser: both project metadata rows share one baseline; fixed 420 × 520 panel; dashboard main content fits; keyboard scrolling moved only the miner list (119 px) while the wallet heading stayed at the same position. Verified inline disclosure, FAB partial coverage and long eight-decimal production, English/smoke rendering and Settings scrolling.
- Independent static review found no blocking correctness/security findings. Synthetic fixture hot-reload now unmounts its previous React root before recreating it; the fixture does not read production preferences.
