# TapeOut Live: Frosted Panel and Appearance Preferences — SPAC v4

Status: Visual prototype approved by the user on 2026-10-17. This written specification is submitted for review before production implementation. This PR initially contains documentation and reference assets only.

Base: `main` at `9993bdb` (installed application v0.3.0). This specification supersedes the layout and settings placement in the v0.2 and FAB specifications, but not their provider, precision, freshness, or account/project isolation contracts.

## 1. Scope and decision

Implement the approved compact prototype in the existing React/TypeScript + Tauri/Rust application on macOS and Windows. Keep TapeOutScan as the only data source. Do not introduce a web backend, RPC source, wallet connection, signing, or transactions.

Chosen approach: retain the existing monitoring engine and IPC contracts, replace the presentation layer with a fixed-window overview/settings flow, and add backward-compatible appearance preferences. This preserves validated BEM/FAB behavior and avoids a platform-specific UI rewrite. A CSS-only recolor would not deliver the approved information hierarchy or desktop glass; separate native UIs would unnecessarily duplicate monitoring and localization logic.

Deliver on a feature branch through one PR. Do not merge, publish a release, replace the installed application, change the user's database, or enable startup on the development machine without subsequent authorization.

## 2. Approved visual baseline

The frozen reference is `../references/frosted-panel-v4/index.html`; open it locally to inspect interactions. `settings-order.png` records the final approved arrangement. Reference values are illustrative and must never become production fixtures or fallback live data.

- Fixed content size: **420 × 720 logical points**, not physical pixels. No resize handles, maximize action, responsive single-column cards, or horizontal scrollbars.
- Warm white default: background `#F6F5F1`, ink `#1D1D1B`, muted `#6B6A66`, accent `#0F6B5C`, accent-soft `#E6F0ED`, separators `#E3E1DA`.
- Smoke companion: warm dark translucent shell, off-white text, subdued green highlights. It is a proposed companion, not an official TapeOut website theme.
- Restrained translucent shell, soft edge highlights, and more opaque inner metric groups. Do not use the prototype's test wallpaper inside the production panel.
- System font stack; tabular numbers; two-column `minmax(0, 1fr)` metric groups; short single-line wallet addresses with full-address copy.
- Preserve the supplied double-wing brand mark. Use consistent Phosphor Regular action icons for settings, refresh, copy, and add. Include the applicable MIT license; no remote fonts or icon CDN.
- No BSC badge, external TapeOutScan links, close/cross/back/quit controls, or footer navigation. The settings gear remains the single toggle between overview and settings. Escape and tray toggle remain supported dismissal mechanisms.

References observed on 2026-10-17: [TapeOut](https://www.tapeout.net/), [Phosphor](https://phosphoricons.com/), and [Inspora](https://www.inspora.design/). The prototype records the extracted brand tokens and embedded reference paths; no ongoing website dependency is required.

## 3. Views and content

### 3.1 Shared header

One header contains the double-wing mark, TapeOut Live wordmark, `BEM | FAB` segmented selector, settings gear, and refresh button. Move the project selector into the header; remove the separate project strip and header language control. Project selection still switches the complete dashboard, not just labels. Refresh applies to the current project and address. Disable conflicting controls while a settings/project/account mutation is pending.

### 3.2 Overview

Display in this exact order:

1. **Network**: token reference price, network power, verified weight, and daily emission in a two-by-two metric group; unverified weight and indexed circuit count in a compact supporting row.
2. **My mining**: saved-account selector; short address and copy; current power, estimated daily production, circuit count, and optimal positions in a two-by-two group.
3. **Balances**: BEM + BNB for BEM; FAB only for FAB. Do not invent FAB native-token balances.
4. **Power history**: one compact chart for the selected project/address. Show a localized collecting-history state when fewer than two valid samples exist; no fabricated curve.

Retain independent network/price/address freshness and provider error information using compact labels and accessible detail disclosures. Do not mark an old miner snapshot fresh because the price refreshed. Normal two-account layouts should fit without scrolling; long errors and accessibility text enlargement may use vertical scrolling without changing the window size.

The approved compact overview replaces the expanded material-price strip, circuit search/list, and recent-event list on the visible page. Their underlying provider collection, cached data, and notification processing are retained. No new details screen or hidden navigation tab is introduced. This is a presentation change, not deletion of stored history or provider capabilities.

An empty installation still shows Network. My mining has a localized action opening settings to add a public address. Missing, indexing, stale, unavailable, and explicit zero remain distinct. Chart/source timestamps must use the selected language. FAB retains eight-decimal precision; long values must fit safely without truncating into a misleading value.

### 3.3 Settings

The gear opens settings **inside the same window**, replacing the overview body, with no new window or close/back button. Clicking the gear again returns to overview. Keep the shared header.

Show the saved-account list first, with a visible selected state, local-only address hint, and Add account action. Bound the list's visible height and allow internal vertical scrolling for up to 20 accounts so preferences remain reachable.

Then show preferences in the user's exact order:

| Order | Chinese | English | Control |
| --- | --- | --- | --- |
| 1 | 主题 | Theme | 暖白 / 烟色; Warm white / Smoke |
| 2 | 语言 | Language | CN / EN |
| 3 | 开机启动 | Launch at login | Switch |
| 4 | 跟随系统主题 | Follow system theme | Switch |
| 5 | 刷新频率 | Refresh interval | 60 / 120 / 300 seconds |
| 6 | 保持面板展开 | Keep panel expanded | Switch |

Preferences save on change, without a global Save button. Show saving/error state; retain the last successfully persisted value on failure. Serialize mutations so rapid interactions cannot overwrite newer settings. A failed startup operation must not present the switch as enabled. Do not change notification consent or power-drop threshold when saving appearance settings.

“Keep panel expanded” means **do not dismiss on focus loss**. It uses the existing `pinned` setting; it does not mean always-on-top, and must not set an OS floating level. Tray toggle and Escape may still dismiss it.

The compact screen does not add notification or destructive history-cleaning controls beyond the approved prototype. Preserve their existing stored values and notification behavior unchanged.

### 3.4 Account addition and maintenance

Add account opens an inline form inside settings, not a second desktop window. Provide account name and public address, Save account and Cancel. Keep the six preferences in their stated order; the temporary form may add vertical content.

Keep existing validation: at most 20 unique case-insensitive 20-byte hexadecimal addresses and at most 40 Unicode characters per name. Reject invalid/duplicate addresses with a localized error. After successful add, select the added account and clear prior-address data immediately through the existing selection/reset mechanism. Cancel makes no persisted changes.

Preserve local rename/remove capability through an account-row editing disclosure rather than prominent extra toolbar icons. Removing an account requires explicit confirmation, changes only saved preferences, and never deletes funds, caches, or source data. If the selected account is removed, select the first remaining account; if none remain, clear both `wallet` and `alias` to avoid legacy migration re-adding the removed address.

## 4. Theme behavior and persistence

Extend the existing `Settings` payload in SQLite and its recovery backup:

```typescript
type AppearanceSettings = {
  theme: "light" | "dark";
  followSystemTheme: boolean;
};
```

`theme` is the retained manual choice, not the effective system-derived value. Warm white maps to `light`; Smoke maps to `dark`.

- Default both new and legacy installations to `theme: "light"`, `followSystemTheme: false`, matching the approved initial prototype. Preserve all pre-existing wallet/account/project/language and other preferences.
- When follow-system is off, use the saved manual theme regardless of OS appearance.
- When on, resolve from actual OS appearance, update immediately when it changes, and disable both manual theme choices. Do not overwrite the retained manual choice.
- Turning follow-system off restores that manual choice. Persist both fields across restart.
- Reject unknown theme strings at the Rust validation boundary. No SQLite table-version migration is needed: deserialize missing fields with defaults, then use the existing canonical settings path.
- Initialize appearance before revealing the native window to avoid a bright flash for a saved Smoke theme. Render CSS tokens from the same resolved theme used for native material tint.

Use a small appearance resolver/hook independent of polling and account selection. Subscribe to system appearance only with proper listener cleanup. Browser preview may use `matchMedia`; native appearance should reflect the OS rather than an explicitly forced webview theme. Theme changes must not reset cached snapshots, selected accounts, project, or request generations.

## 5. Cross-platform shell and material

Preserve existing positioning contracts in `window_layout.rs` and `shell.rs`. On macOS retain AppKit point-space positioning on the clicked screen; on Windows move first and restore logical size across DPI changes. Never shrink the panel to accommodate a smaller screen. Preserve the existing minimum-work-area policy and same-monitor tray toggle/cross-monitor relocation behavior.

Use Tauri's available native window-effect APIs behind a platform adapter, not CSS `backdrop-filter` alone, to blur content behind the desktop window:

- **macOS 13+**: transparent webview/window with an AppKit-backed sidebar/popover material and theme-appropriate tint.
- **Windows**: request supported Acrylic/blur material. Unsupported Windows builds, remote/composition-limited sessions, or effect-application failure use an opaque theme-matched surface.
- An unavailable effect must not prevent showing the panel, saving preferences, or reading data. Retain an opaque fallback and an internal diagnostic rather than a false “glass enabled” indicator.
- Respect reduced-transparency/high-contrast settings where exposed by the OS. Fall back to an opaque readable surface rather than forcing transparency. CSS forced-colors and reduced-motion fallbacks remain supported.
- Configure actual native transparency and clear webview backgrounds where required. Do not claim native blur based on browser screenshots.
- Native effects are applied on the UI thread. Reapplying a theme/material must not move or resize the window or alter focus-loss dismissal behavior.

## 6. Data architecture and compatibility

No new endpoints or provider normalization changes are required. Keep the existing boundary:

```text
TapeOutScan HTTPS GET
  -> BEM / FAB provider adapters and validation
  -> Rust runtime (selected project/address; generation guards)
  -> SQLite namespaced snapshots/history and settings backup
  -> existing Tauri IPC / snapshot_updated event
  -> React overview or settings in one fixed window
```

Network snapshots remain shared across accounts within a project; wallet snapshots and samples remain keyed by project and address. Preserve original BEM resource keys and FAB namespaces. A project/account switch rejects late responses in both Rust and React and resets only the appropriate alert baseline. UI view/theme/language changes must not create another scheduler or reset monitoring data.

Use normalized provider power-history points when their project/address ownership is established. Otherwise use the existing `get_history` command for locally collected samples. Never combine unrelated series, old-project points, or provider/local timestamps indiscriminately. Filter invalid/negative/non-finite values and sort valid timestamped samples; scope async chart results to the selected project/address and clear them immediately on selection changes.

Do not display a hard-coded 24-hour chart label unless the series is filtered to that interval. With fewer than two in-range samples, show the empty state. No analytics, third-party requests, credentials, or cloud settings sync are introduced.

## 7. Implementation boundaries

Expected focused changes:

- `src/App.tsx`: shared header, overview/settings state, existing refresh/selection flows.
- `src/SettingsPanel.tsx`, `src/AccountManager.tsx`: ordered preferences, account form/maintenance, controlled persisted mutation states.
- `src/appearance.ts`, `src/appearance.test.ts`: manual/system resolution and system-event subscription.
- `src/Icons.tsx`, local brand assets, and attribution: consistent offline icons.
- `src/MonitorSections.tsx`, `src/FabNetwork.tsx`, a focused power-history component: compact real-data overview and truthful chart states.
- `src/styles.css`: semantic theme tokens, glass/fallback surfaces, fixed two-column layout and accessible controls.
- `src/bridge.ts`, `src/i18n.ts`: backward-compatible settings contract and complete bilingual labels.
- `src-tauri/src/domain.rs`: new setting defaults/validation; no data-source changes.
- `src-tauri/src/shell.rs` and a focused appearance adapter: native material/theme setup, fallback, and supplied tray icon.
- `src-tauri/tauri.conf.json`, icon bundle assets: transparency/effects and generated platform icons.

Retain the original supplied logo as the source asset. Generate .icns/.ico and PNG app assets from it with transparent padding suitable for the platforms. Use a monochrome alpha template for the macOS menu bar and a legible Windows tray variant; do not reuse the old cube pixel generator. Do not use the same brand glyph as an unrelated metric icon.

## 8. Verification and acceptance

Before implementation, write a task-level plan and failing behavior tests. Record actual commands/results in the PR; do not equate compilation with hardware validation.

### Automated

1. Legacy settings without appearance fields migrate without changing accounts, aliases, project, language, intervals, notification consent, or history. Both appearance fields round-trip; invalid theme values fail validation. Recovery backup preserves them.
2. Theme resolver covers manual/system light/dark, live system changes, listener cleanup, and restoring the prior manual choice. Failed persistence leaves the previous effective theme and shows an error.
3. DOM tests assert the exact six-setting order, gear view toggle, no extra window/navigation controls, language changes, empty-account onboarding, account validation/add/select/remove, mutation serialization, and startup failure.
4. Network remains above My mining for BEM and FAB. FAB units and eight-decimal balances remain correct. Unknown and pending values are not converted to zero. Expanded circuit/event/material sections are absent from the compact overview.
5. History tests reject stale selection responses, invalid values, and out-of-range timestamps; fewer than two samples renders no line.
6. Preserve all existing runtime/provider/storage/alert and geometry regression tests.
7. Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `cargo fmt --check`, `cargo test`, and `cargo clippy --all-targets -- -D warnings` from their respective frontend/Rust directories. Run the existing macOS/Windows GitHub Actions workflow for implementation commits.

### Visual/native manual matrix

- Both languages × BEM/FAB × Warm white/Smoke, zero/two/twenty accounts, long aliases/large values, empty/indexing/stale/offline states. No horizontal overflow, clipped controls, or focus-ring loss.
- Warm white and Smoke on light/dark desktop content: native backdrop visibly blurs behind the panel; text remains readable. Verify opaque fallback and OS high-contrast/reduced-transparency behavior separately.
- Toggle system appearance while the panel is open and hidden; reopen and restart with each saved preference. Confirm retained manual theme and no opening flash.
- macOS Retina/non-Retina and Windows 100%/150%/200% mixed-DPI displays: opening on either display keeps 420 × 720 logical dimensions and uses that display's work area. Include negative monitor origins and relocated taskbars where hardware is available.
- Verify launch-at-login enable/disable on a test profile, focus-loss dismissal with both panel-retention states, Escape, same-display tray dismissal, and cross-display relocation.
- Check new app/dock/taskbar/menu-bar icons at native sizes and in both system appearances.

Unavailable hardware or untested native effects must be marked **not verified**, with platform and condition stated in the PR. Do not substitute the reference HTML's screenshot for a production native verification.

## 9. Review and delivery checkpoints

1. Review this written SPAC and the frozen approved prototype in the Draft PR. No production source changes belong to this first checkpoint.
2. After written-spec confirmation, add the implementation plan and develop on the same branch/PR using test-first behavior checks.
3. Complete automated checks, production UI inspection, and feasible native/manual checks; document remaining Windows/multi-monitor hardware checks honestly.
4. Mark the PR ready only after the implementation review; wait for user authorization before merging or replacing their local installation. Back up local preferences/database before a separately authorized installation.
