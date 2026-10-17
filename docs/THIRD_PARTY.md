# Third-party and Brand Assets

## Phosphor Icons

The Regular gear-six, arrows-clockwise, copy, and plus paths in `src/Icons.tsx` were preserved from the approved visual reference. Phosphor is distributed under the MIT License. The complete notice is retained at `src/assets/PHOSPHOR-LICENSE.txt` and bundled into the desktop application's `licenses` resources directory.

Reference: https://phosphoricons.com/

## TapeOut Brand Mark

The user supplied the double-wing reference. Its original image is retained in `src/assets/tapeout-mark-reference.png` and the frozen reference directory. The local vector adaptations in `src-tauri/icons/*.svg` provide the padded app tile and monochrome/native tray variants. They are brand marks, not Phosphor metric icons.

Regenerate bundled desktop icons with the installed Tauri CLI:

```bash
npm run tauri icon -- src-tauri/icons/brand.svg
```

For tray images, generate a custom 32-pixel PNG into a temporary directory from `tray-template.svg` / `tray.svg`, then copy that result to the corresponding `tray-template.png` / `tray.png`. Do not overwrite source SVGs or install generated app bundles automatically.
