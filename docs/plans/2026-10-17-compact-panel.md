# Compact Panel Layout

## Design

Use the supplied system-monitor reference for stronger numeric hierarchy and tighter spacing. Retain the existing warm-white/smoke palette and glass material.

- Fixed panel size: 420 by 520 logical pixels, reduced from 420 by 720.
- Header: 52 pixels. Main horizontal padding: 16 pixels.
- Metric labels: 11 pixels, medium weight. Values: 24 pixels, bold; wallet values: 26 pixels. Long values: 20 pixels.
- Reduce card padding and address-row spacing. Use proportional system typography with tabular numerals for balances.
- Apply the same fixed dimensions to CSS, Tauri startup configuration, and monitor-positioning logic. Settings remain scrollable.

## Validation

- Synthetic browser preview at `/docs/validation/compact-panel.html`; no installed profile is read.
- BEM content fits without scrolling; the balance row ends at approximately 501 pixels inside the 520-pixel panel.
- FAB long values and eight-decimal balances fit without horizontal overflow.
- Settings use vertical scrolling for content beyond the panel height.
- Frontend suite: 51 tests passed. Updated native positioning suite: 5 tests passed, including negative-origin monitors and Windows DPI scaling.
- The 480-pixel trial was rejected during visual validation because it clipped the balance row.

## Delivery

Continue the user-authorized local commit and installation workflow. Back up the old bundle and profile before replacement, then verify signature, executable identity, settings preservation, and database integrity.
