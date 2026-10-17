# TapeOut Live: Account Controls, History Values, and Global Refresh — SPAC v5

Status: Proposed; awaiting the user's written-spec approval before implementation.

Base: `main` at `e69d3326fdeedce0c1015a0a8b48c1ec8e0bccad` (v0.4.0). This specification supersedes the affected account, balance, chart, language-label, and manual-refresh requirements in SPAC v4. All other v4 contracts remain in force.

## 1. Scope and approach

Refine the existing fixed 420 × 720 logical-point panel on macOS and Windows. Keep the existing warm-white/smoke glass treatment, preferences order, native positioning, SQLite persistence, localization, and TapeOutScan-only data policy. No RPC provider, wallet connection, signing, transactions, cloud service, or new navigation screen is introduced.

Recommended approach: shared account-selection and balance presentation components, a readable numeric history chart, and an explicit backend cross-project manual-refresh operation. This addresses presentation and request isolation together.

Alternatives considered:

- Restyle the native select and issue the existing refresh command twice: smaller UI change, but the command still targets the selected project and the current generation guard rejects inactive-project responses. It does not meet the refresh requirement.
- Replace the panel or monitoring engine wholesale: unnecessary migration and platform regression risk. Retain existing adapters, cache namespaces, and scheduling infrastructure with focused changes.

This PR has a specification checkpoint followed by implementation after approval. Merging, publishing a release, or replacing the local installation requires subsequent user authorization.

## 2. Overview presentation

### 2.1 Shared account selector

Replace the narrow native select with one compact, theme-aware account-name button aligned to the right of My mining. Both BEM and FAB use the same component, selected account, dimensions, and interaction.

- Closed state: account name and a small downward caret; reserve space for the section heading. Truncate long names visually, while exposing their full accessible name.
- Open state: an in-panel popover with each account's name, shortened address on a second line, and a selected checkmark. Keep full addresses available to assistive technology. Do not duplicate the address inside the closed button: the wallet/copy row already presents it.
- Up to 20 accounts; bounded list height with internal vertical scrolling. Popover placement stays inside the fixed panel and creates no horizontal overflow.
- Support keyboard open, arrow navigation, Enter/Space selection, Escape dismissal, outside-click dismissal, focus restoration, and accessible listbox/option semantics. Account selection saves through the existing serialized mutation path; disable conflicting selection while pending and preserve the previous account on failure.
- Project switches retain the selected account. Wallet switches clear the old wallet's visible data and history immediately; late responses cannot populate the new wallet.

### 2.2 Remove the marked supporting rows

- Both projects: remove the visible asset-snapshot timestamp row beneath balances.
- FAB only: remove the visible price-snapshot timestamp row and the price-conversion/reference-formula row beneath network totals.
- Retain the compact unverified-weight/indexed-miner row and the section freshness indicators. Do not remove the BEM network timestamp row, which was not marked for deletion.
- Keep price, network, and wallet freshness independent. Preserve exact source timestamps and price-reference provenance in accessible metric detail/tooltips rather than the removed full-width rows. A refreshed price must not make stale mining data appear current.

### 2.3 Balance row and source contract

Use the same two-column balance-row layout and typography in both projects:

| Project | Left | Right |
| --- | --- | --- |
| BEM | BEM balance | BNB balance |
| FAB | BEM balance | OKB balance |

The FAB labels above intentionally follow the user's explicit request for **BEM + OKB**, not FAB + OKB. The existing FAB-only balance row is replaced, not retained as a third visible balance.

Data verification on 2026-10-17:

- The official [FAB client](https://tapeoutscan.io/fabx.js) presents its address summary `balance` as FAB balance. Its `nativePrice` is an OKB/USDT market quote, not a wallet holding.
- The existing normalized FAB asset `token` therefore cannot supply either requested balance. The BEM adapter's BNB holding cannot be relabeled OKB.
- A direct request to the official FAB address endpoint with a public fixture address returned HTTP 500 during specification preparation. BEM and OKB wallet holdings on FAB have **not been verified** as available from TapeOutScan.

Implementation must verify a documented or official-client-used TapeOutScan response before adding a balance mapping. Require matching address ownership, the correct chain/asset identity, a source observation time, and decimal precision. Do not guess endpoint paths or derive holdings from token prices. A BEM holding on BSC must not be reused as a different-chain BEM holding without verified identity.

If TapeOutScan still does not expose the requested holdings, render each unsupported value as `—`, with localized accessible detail such as “TapeOutScan balance unavailable.” Do not substitute zero, cached FAB/BNB values, fabricated values, or a different data source. Verified explicit zero remains `0`. Cached values retain stale status. This limitation must be stated in the PR and user handoff; the missing-data state is not evidence of a successful live balance integration.

### 2.4 Numeric power history

Keep the selected project/address's real last-24-hour history, with these additions:

- Persistent latest valid sample value with `H` and its observation time; distinguish it from the independently observed current-power metric.
- Compact Y-axis minimum, midpoint, and maximum labels with units. For a constant series use a padded domain and one clear actual-value label rather than repeated overlapping ticks.
- A point inspection state showing the selected sample's full power and localized timestamp, available by pointer and keyboard focus/arrow navigation. Nearest-point selection must use the plotted time coordinates.
- Real first/last time labels; no fabricated sample values or timestamps. Keep the existing invalid/negative/non-finite/out-of-range filtering, sorting, wallet/project ownership checks, and late-response rejection.
- Zero samples: collecting-history state, no chart line. One valid sample: display its value/time but keep collecting-history state, without inventing a second point.
- Numeric labels use compact display only when space requires it; expose full values through accessible text/inspection. Reserve chart margins so labels, grid, and line remain inside the fixed panel in both languages/themes.

## 3. Settings

### 3.1 Trailing account Edit action

Each account row contains its selection target and a separate trailing localized Edit button. Do not nest buttons. Retain the selected indicator without replacing Edit. Remove the permanent second “Edit account…” disclosure row.

Clicking Edit opens that account's inline editor within the same settings panel. Preserve the existing rename/remove functionality: the name is editable, the public address is displayed read-only, and replacing an address uses Add account plus explicit removal. This avoids silently changing account identity or rewriting cached history.

Show Save/Cancel only while editing; dismissing without saving does not persist changes. Preserve the 40-Unicode-character name limit, 20-account limit, address/duplicate validation for addition, serialized persistence, localized errors, and explicit remove confirmation. After removing the selected account, select the first remaining account or clear wallet and alias when empty. Never delete cached monitoring history or funds.

### 3.2 Language labels

Render the language control as `中文 | EN` in both languages, with an actual visual separator and two accessible selection buttons. Keep persisted values `zh` and `en`; do not migrate settings keys. Preserve the existing order: Theme, Language, Launch at login, Follow system theme, Refresh interval, Keep panel expanded.

## 4. Manual refresh: both projects

One header refresh requests BEM and FAB data for the currently selected wallet, regardless of the visible project. It updates each project's address/miners/balances/history inputs, market, and network snapshots. With no wallet, refresh both projects' market/network data only. It does not refresh every saved account.

Automatic polling remains scoped to the selected project with the existing intervals. Manual global refresh must not create a second scheduler, change persisted project selection, trigger account switching, or bypass retry/rate-limit protections.

### 4.1 Request and cache isolation

Add a dedicated typed `refresh_all` operation and a small batch coordinator:

1. Capture the normalized selected wallet and account-selection revision once.
2. Queue the BEM/FAB resource jobs under their existing namespaced cache keys. Reuse equivalent in-flight jobs; keep bounded concurrency of two and the existing manual cooldown/backoff/Retry-After rules. Share a FAB home fetch for market/network where practical without changing their independent freshness parsing.
3. Track each request by explicit project/resource/wallet context. A view-only project switch must not invalidate the other project's valid manual response. An account switch/removal must invalidate old-account address responses, including switching away and back during one request. Account-independent market/network responses may still update their own project caches.
4. Persist each valid result only to its matching namespace and wallet. Emit updates for the frontend to re-project the currently selected dashboard. Never overwrite the visible BEM dashboard with FAB data or vice versa.
5. Keep existing alert behavior scoped to automatic/selected-project monitoring. An inactive-project manual cache fill must not compare against the visible project's baseline or emit an incorrectly labeled power-drop alert. Separate request acceptance from notification eligibility.

The current runtime generation check assumes the selected project for every accepted response; it must be replaced or split with explicit account/request context, not bypassed wholesale. Preserve rejection of outdated account responses.

### 4.2 Completion and failure semantics

Expose batch progress independently of selected-project jobs. The header remains busy until all admitted jobs settle; changing project cannot incorrectly stop its indicator. Disable repeated refresh while the batch is active. Switching view is permitted; conflicting account mutations retain their existing serialization and invalidate stale address work safely.

Return/report per-project resource outcomes: refreshed, already in flight, deferred by cooldown/backoff, or failed. A deferred request is not a successful refresh. Show concise localized BEM/FAB errors when a project fails, even if it is not visible. Preserve cached data with honest freshness; do not label the entire batch updated when only one project succeeds. All completion/error paths release busy state and permit later retries.

## 5. Focused implementation boundaries

- `src/App.tsx`, `src/bridge.ts`, `src/useMonitor.ts`: global-refresh command/progress and native/browser-preview parity.
- `src/MonitorSections.tsx`, a shared account-selector component, `src/FabNetwork.tsx`: account presentation, marked-row removal, consistent balance layout and independent freshness details.
- `src/PowerHistory.tsx`: numeric chart domain, labels, sample inspection, and accessible interaction.
- `src/AccountManager.tsx`, `src/SettingsPanel.tsx`, `src/i18n.ts`, `src/styles.css`: trailing Edit action, language display, shared theme styling and localization.
- `src-tauri/src/runtime.rs`, IPC registration, focused request/batch types: cross-project manual refresh and account-safe acceptance.
- `src-tauri/src/fab.rs`, `src-tauri/src/provider.rs`, frontend asset types: only source-verified balance mappings; preserve unsupported/null states.

No SQLite schema migration is expected. Retain existing snapshots/history and backward-compatible settings. Never include the user's screenshots, wallet, balances, or local database in committed fixtures; use synthetic or already-public fixtures.

## 6. Verification and acceptance

Before production changes, write the implementation plan and failing behavior tests. Record actual test/build results and remaining limitations in the PR.

1. Shared account selector: both projects, long/Unicode names, zero/one/twenty accounts, keyboard/outside-click dismissal, pending/failure state, no horizontal overflow or stale selection.
2. Settings: trailing Edit is a sibling action, no permanent second editing row; rename save/cancel/error and remove confirmation preserve existing selection/data rules. Language displays exactly `中文 | EN` while stored values remain unchanged.
3. Overview: the three marked categories of supporting rows are absent; BEM's unmarked network timestamp remains. FAB has BEM/OKB cells, BEM retains BEM/BNB. Unsupported is `—`, not zero or renamed FAB/BNB; ownership and precision tests cover any added mappings.
4. Chart: zero/one/two/many samples, flat/zero/large series, irregular timestamps, real numeric labels and inspected values, last-24-hour bounds, keyboard inspection, project/account races, both languages/themes.
5. Runtime: refresh from either project schedules both projects without mutating settings; empty wallet skips address jobs; duplicate refresh/in-flight jobs, concurrency bound, cooldown, rate limit, one-project failure, complete failure, cache-write failure, and cancellation all settle correctly.
6. Race tests: project switch during refresh still caches both projects; account switch and switch-away/back reject old address results; network results remain project-scoped; inactive-project cache fill cannot corrupt alerts or history.
7. Run frontend typecheck, lint, formatting, tests, and production build; Rust formatting, tests, and clippy with warnings denied; existing macOS/Windows CI. Do not claim live balance verification from fixture tests.
8. Visually inspect 420 × 720 overview/settings in both themes/languages/projects with synthetic values. Verify numeric-chart readability, selector clipping/focus, inline editor layout, and no unexpected scrolling in the ordinary layout. Native multi-monitor/material behavior retains v4's contract; unavailable Windows hardware is explicitly not verified.

## 7. Delivery checkpoints

1. Open a documentation-only Draft PR for this SPAC and request written approval, including the explicit BEM/OKB availability policy.
2. After approval, add the implementation plan and develop/test on the same PR. Keep the PR draft until implementation and review are complete.
3. Report verified behavior, unsupported data, and platform testing limits. Await separate authorization to merge and replace the installed app.
