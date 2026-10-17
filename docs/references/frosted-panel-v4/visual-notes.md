# Visual Study 02 — Not an Implementation Specification

This is a prototype-only refinement. Production sources, installed applications, and stored preferences are unchanged. The preceding layout is preserved as `layout-v1.html`.

## Verified references — 2026-10-17

- TapeOut website: https://www.tapeout.net/
  - Observed computed CSS tokens: background `#f6f5f1`, ink `#1d1d1b`, muted `#6b6a66`, accent `#0f6b5c`, accent-high `#0c5a4d`, accent-soft `#e6f0ed`, line `#e3e1da`, chip `#efede6`.
  - Its warm white and deep green guide the default light material. The smoke/dark material is a proposed companion, not an observed official theme.
- Phosphor: https://phosphoricons.com/
  - Use observed official Regular paths: gear-six, arrows-clockwise, copy, plus.
  - Preserve the user's uploaded double-wing brand mark, rather than replacing it with a library glyph.
  - MIT license retained as `assets/PHOSPHOR-LICENSE.txt`.
- Inspora: https://www.inspora.design/
  - Reference the restrained surface hierarchy and edge/highlight contrast seen in its gallery, not the identity or assets of individual creators.

## Proposed material

- Warm translucent shell with 28px backdrop blur, controlled saturation, and subtle white edge highlights.
- More opaque inner data surfaces preserve legibility. Charts retain an honest empty-history state.
- A low-contrast green/warm background is a material-testing backdrop, not a proposed production wallpaper.
- Smoke glass and warm white glass are selectable in the review controls.
- Settings also expose warm white/smoke theme selection and a separate follow-system switch. Following the system disables the manual choices and responds to system appearance changes; switching it off restores the retained manual preference. Prototype choices stay in memory and do not update native preferences.
- Preference order: Theme, Language, Launch at login, Follow system theme, Refresh interval, Keep panel expanded. The final switch represents retaining the open panel when another window receives focus, not a separate always-on-top setting.

The web prototype demonstrates translucency over its own backdrop. True translucency behind the native desktop window, OS accessibility fallbacks, and Windows/macOS parity require a later approved technical specification and implementation. This study does not establish those native capabilities.
