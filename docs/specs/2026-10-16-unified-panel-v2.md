# TapeOut Live v0.2: Fixed Multi-Monitor Panel and Unified Accounts

Status: Implementation authorized by the user's iteration request.

## Scope

Replace the first release's tabbed dashboard with one persistent monitoring page. Network appears first, followed by the selected wallet overview, balances, circuits, and recent events. Use TapeOutScan exclusively. Add saved wallet switching and complete Chinese/English interface dictionaries. No BSC badge, external links, footer navigation, close/back/quit buttons, or secondary details window.

## Display bug and correction

The old implementation calculates a physical size using the destination monitor's scale but resizes before moving the window. Its size is therefore interpreted on the old monitor during mixed-DPI transitions. The macOS tray library additionally constructs physical cursor coordinates by multiplying global AppKit points by the tray screen's scale. Reusing those coordinates against monitor geometry makes mixed-DPI selection fragile. Resizable windows and a narrow-screen single-column breakpoint compound the failure and produce horizontal overflow.

Use a fixed **420 × 720 logical-point** panel, non-resizable and non-maximizable. Every presentation restores this content size; never shrink it according to monitor scale. Vertical scrolling belongs to the content area, never horizontal scrolling. Addresses stay on a single line using a short representation, with the full address accessible through copy and the account manager.

On macOS, position in AppKit points on the main thread: read NSEvent.mouseLocation, find the NSScreen whose frame contains the cursor, use that screen's visibleFrame, and set the borderless NSWindow frame directly in the same coordinate system. Place below the menu bar and clamp position to the clicked screen. No Retina multiplier enters this calculation. On Windows, select the monitor at the physical tray click, move first, and restore the fixed logical dimensions on scale-factor changes. Test negative monitor origins, 1×/2×/1.5× scales, and top/bottom/side taskbars.

The supported minimum available work area is 436 × 736 logical points. Smaller areas preserve panel size and anchor it to the work-area origin rather than silently shrinking it. A visible panel clicked from a different monitor must relocate and remain open; clicking again on the same monitor toggles it closed.

## UI

```text
TapeOut Live                      [中文 / EN]
Network                         Updated …
+-------------------+---------------------+
| BEM price         | Network power       |
| Verified weight   | Daily emission      |
+-------------------+---------------------+
Network pool counts / material prices

My mining                [Account selector]
Short wallet address              [Copy]
+-------------------+---------------------+
| Mining power      | Estimated BEM/day   |
| Mining circuits   | Optimal positions   |
+-------------------+---------------------+
Verified / unverified power · BEM / BNB
Circuits (same page, no detail window)
Recent events (same page)
Account manager and preferences (inline disclosure)
```

Network and wallet metrics are always rendered together, with independent loading/error/observation-age states. No score or fabricated machine-online status. Labels identify on-chain activity, estimated production, and stale quotes. The main page has no tabs, external actions, footer, or dismissal controls. Clicking outside dismisses unless pinned; tray click and Escape remain standard dismissal mechanisms. Quit is not a custom panel or tray control; OS-level application lifecycle remains available.

The account manager is an inline disclosure, not another route. Save adds/removes/renames accounts and changes preferences. At least the currently selected account stays visible in the overview during editing. Removing a saved entry removes only the local preference, not provider data, caches, or funds.

## Settings and migration

Keep the existing SQLite schema and per-wallet snapshot keys. Extend settings with `accounts: [{address, name}]` and `language: "zh" | "en"`. Retain `wallet` and `alias` as the selected-account projection for compatibility with the existing scheduler. On read, migrate a legacy non-empty wallet into the saved list without changing it; default interface language to Chinese. Validate at most 20 unique case-insensitive 20-byte hex addresses, names of at most 40 characters, and a selected address belonging to the list. Duplicate/invalid selections fail explicitly. Save the canonical settings and the existing recovery backup.

Only the selected wallet is actively polled. Switching immediately clears the old visible snapshot, loads only the selected wallet's cache, increments the existing request generation, and silently resets alert baselines. An old response cannot update the new account. The frontend also discards out-of-order dashboard responses. Network data is shared across accounts and language changes.

Locale dictionaries cover navigation-free headings, metrics, account management, empty/loading/error states, preferences, date/number formatting, pool labels, state labels, and notifications. External task names remain provider data; English uses a Task ID fallback when no English name is provided. No remote translation service is introduced.

## Implementation sequence and acceptance

1. Add failing tests for fixed geometry, cross-monitor scaling, legacy migration, duplicate addresses, invalid selection, and locale dictionary coverage.
2. Implement canonical settings/migration, explicit account switching, per-account cache isolation, and frontend response ordering.
3. Replace physical macOS sizing with AppKit positioning; constrain window capabilities; remove secondary window/external-action commands.
4. Replace App with small Network/Wallet/Activity/AccountManager components and one bilingual page. Restore two-column cards with minmax(0, 1fr), non-wrapping address controls, and overflow-safe containers.
5. Run frontend checks/build, Rust tests/format/clippy, DOM UI smoke tests, native fixed-size inspection and mixed-monitor checks where screens are available. Record unperformed hardware checks explicitly.
6. Build a new macOS development DMG, push the branch, create a new PR against main, and attach it to this chat. Run Windows/macOS CI for the PR. Do not merge automatically. Do not overwrite the installed application or its wallet settings as part of PR creation.

Tests must establish that the previous settings survive, locale keys are complete, fixed logical dimensions do not depend on DPI, and the overview contains Network above the selected wallet without tab clicks. Manual testing must confirm opening from either screen displays on that screen without changing perceived panel size.
