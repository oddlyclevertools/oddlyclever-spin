# OddlyClever Spin · icon kit

This is the Swatch fan mark, picked on 3 Nov 2026. Five pills in the Raindrop ramp fan out round a gold rivet, on navy `#001233`.
Rebuild everything with `python ../make_spin_kit.py`. You need Pillow, numpy and fontTools.
Each run starts with a self-check: the rivet and background colours, the adaptive safe zone, and that the small fans stay thick enough.

`sheet.png` shows every version on light and dark.

## Sizes are drawn, not shrunk
| Size | Fan |
|---|---|
| 32 px and up | 5 pills with soft shadows (the full mark) |
| 20–24 px | 4 thicker pills, no shadows |
| 16 px | 3 pills |

At 48 px and below, the upright pill is snapped to whole pixels so its edges stay crisp.

## Files
| Folder | What | Where it goes |
|---|---|---|
| `android/res/` | `mipmap-*dpi/ic_launcher*.png` (legacy square + round), adaptive `ic_launcher_foreground` + `ic_launcher_monochrome` (Android 13 themed icons), `mipmap-anydpi-v26/ic_launcher*.xml`, `values/ic_launcher_background.xml` | Merge into `android/app/src/main/res/`. Remove the old vector `res/mipmap/ic_launcher.xml` first. Then point the manifest's `android:roundIcon` at `@mipmap/ic_launcher_round`. |
| `android/play-store-512.png` | Play Console hi-res icon (Play rounds the corners itself) | Store listing |
| `windows/app.ico` | 16, 20, 24, 32, 40, 48, 64, 128 and 256 px, each drawn for its size | Copy over `desktop/assets/OddlyCleverMusic.ico`. `build.sh` only makes a new one when that file is missing. |
| `windows/png/` | The same sizes as PNGs | Installer art, the tray |
| `ios/AppIcon.appiconset/` | 1024 px default (no alpha), plus dark and tinted versions for iOS 18 | Drop into `Assets.xcassets/` in the iOS project |
| `web/` | `favicon.ico` (16–48), `apple-touch-icon.png` (180), `icon-192/512.png`, `icon-maskable-512.png` | `web/` and the manifest |
| `svg/` | `icon-square`, `icon-rounded`, `mark` (no background) and `favicon` (the small fan) | Anywhere vector |
| `svg/wordmark-*.svg` | The lockups: stacked, and inline for narrow bars. Light and dark. The text is outlined, so it needs no font. | Store pages, README, About |
| `png-preview/` | The stacked wordmark as PNG | Quick previews |

## Fonts
The wordmark uses Fredoka Bold ("Spin") and Rubik Medium ("OddlyClever"). Both are SIL Open Font License fonts from Google Fonts, kept in `../fonts/`.
Letters are set without kerning pairs. That's fine for these two words; check it if you set new words.

## Before going public
The name has had a store, web and domain check (3 Nov 2026), but no trademark search yet. Run a UK IPO and EUIPO search first.
