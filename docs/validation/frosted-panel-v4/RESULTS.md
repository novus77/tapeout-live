# Frosted Panel v4 Validation — 2026-10-17

Scope: feature branch `codex/frosted-panel-v4`, PR #3, application version 0.4.0. Production installation and its wallet database are not replaced or edited by this delivery.

## Automated evidence

- Frontend: 26 passing tests in six suites, including existing account/project isolation regressions, settings order and mutations, appearance event ordering/cleanup, browser-only memory preview, and scoped 24-hour history.
- Rust: 37 passing deterministic tests; two public-network tests explicitly ignored. New coverage includes missing appearance fields, unknown themes, recovery backup, manual/system native policy, startup compensation, and SQLite write-failure recovery.
- TypeScript, ESLint, Prettier, Vite production build, rustfmt, and clippy with `-D warnings` passed locally. Commands are listed in the implementation plan and PR.
- The tests were developed red-first: theme fields/validation initially failed three assertions; missing native-theme policy failed compilation; settings-gear UI initially failed; selection-time history query failed its regression assertion; listener ordering and memory-preview tests failed before implementation; SQL trigger failure reproduced an incorrectly updated recovery backup before the storage correction.

## Browser/UI evidence

Test URL: `http://127.0.0.1:1421/`. These are implementation screenshots, not the frozen HTML prototype. They use synthetic public addresses ending in `000001` and `000002`, only in browser memory. No live user assets or fabricated provider metrics are displayed.

- Measured shell: **420 × 720 CSS logical pixels**, matching native content configuration.
- Chinese and English settings expose exactly Theme, Language, Launch at login, Follow system theme, Refresh interval, Keep panel expanded in that order.
- Warm white and Smoke manual selection work. Following the current light system appearance disables manual buttons and resolves light; switching follow-system off restores the prior Smoke choice.
- Two accounts were added via the actual inline form. Language and FAB switching preserve the current selected account.
- English FAB overview headings are Network → My mining → Power history. FAB balance appears; no BNB balance or external links appear. No horizontal overflow in either measured view.
- Browser console error log was empty during the recorded interactions.
- The browser-only preview notice adds 58 pixels of vertical space, so its settings page can scroll slightly. Subtracting that preview-only notice, the measured two-account production content fits the 660-pixel body. This does not establish native accessibility text-scaling behavior.

Screenshots:

- `settings-smoke.png`: Chinese Smoke settings with two synthetic accounts.
- `overview-warm-fab-en.png`: English Warm white FAB overview, with intentionally unknown live values.

## Review corrections

Independent spec review and subsequent code-quality review completed. Addressed findings:

1. Follow-system uses `set_theme(None)` instead of suppressing Windows OS theme events with a forced native theme. The applied-state key includes follow-system mode, even when the effective color is unchanged.
2. Native appearance subscription completes before initial state retrieval; late async subscription cleanup is retained.
3. Launch-at-login changes are compensated when settings persistence fails. Compensation failure returns both errors explicitly.
4. Settings SQL writes run inside a transaction before replacing the recovery backup. A failed SQL write cannot replace the confirmed backup. Reported commit failure restores the prior backup. SQLite and its separate JSON file are **not** claimed to be crash-atomic across a power interruption.

## Native/package evidence and limits

- Isolated debug application bundle built successfully with identifier `io.tapeout.live.v4test`, without loading the installed application's profile. The process started, but the UI automation binding could not reliably inspect its native window. A process sample showed an idle AppKit event loop rather than an established deadlock. That test process was stopped; its isolated profile was retained.
- Native backdrop blur, reduced-transparency/high-contrast appearance, startup OS registration, startup-flash behavior, tray interactions, and icon legibility at actual menu-bar sizes remain **not visually verified**.
- Real Windows and macOS mixed-DPI/multi-monitor hardware checks remain **not verified**. Geometry regressions and successful compilation do not replace them.
- The production macOS application and `TapeOut Live_0.4.0_aarch64.dmg` built successfully. DMG creation initially failed inside the sandbox (`hdiutil: create failed - device not configured`); retrying with the required permission succeeded. This is a local development package, not a published/notarized release.
- Mounted that DMG read-only, confirmed `Contents/Resources/licenses/PHOSPHOR-LICENSE.txt` and `icon.icns`, then detached it. SHA-256: `2588e04548d019914dc98e95612bc270209ef42c7324ba0fa0e5a6ef6c9cc21d`.
- Windows/macOS CI is triggered by pushing the implementation; its current status is reported separately in the PR rather than inferred from local macOS results.

## Delivery boundaries

This change does not merge main, publish a GitHub release, enable startup on the development computer, or replace `/Applications/TapeOut Live.app`. A later installation requires separate authorization and a backup of the user's preferences/database. The browser preview is explicitly memory-only and resets on reload.
