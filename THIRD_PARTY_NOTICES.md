# Third-party notices

OddlyClever Spin is MIT licensed (see `LICENSE`). It is built on the open-source work below, and I'm grateful to everyone who made it.
Each component keeps its own licence. The full licence texts ship next to this file in the apps (`licenses/` in the Windows
program folder) and are linked here.

Versions are the ones in the 0.4 builds (4 Nov 2026). W = Windows app, A = Android app, both = both.

## Python packages

| Component | Version | Licence | Source | In |
|---|---|---|---|---|
| yt-dlp | 2026.10.26 | Unlicense (public domain) | https://github.com/yt-dlp/yt-dlp | both |
| yt-dlp-ejs | 0.8.0 | Unlicense, with bundled parts under MIT and ISC | https://github.com/yt-dlp/ejs | both |
| ytmusicapi | 1.12.3 | MIT | https://github.com/sigma67/ytmusicapi | both |
| requests | 2.34.2 | Apache-2.0 | https://github.com/psf/requests | both |
| urllib3 | 2.8.0 | MIT | https://github.com/urllib3/urllib3 | both |
| certifi | 2026.10.23 | MPL-2.0 (source is included unchanged in the app) | https://github.com/certifi/python-certifi | both |
| idna | 3.20 | BSD-3-Clause | https://github.com/kjd/idna | both |
| charset-normalizer | 3.5.2 | MIT | https://github.com/jawah/charset_normalizer | both |
| brotli | 1.2.1 | MIT | https://github.com/google/brotli | W |
| pycryptodomex | 3.24.1 | BSD-2-Clause and public domain | https://github.com/Legrandin/pycryptodome | W |
| websockets | 17.4 | BSD-3-Clause | https://github.com/python-websockets/websockets | W |
| pip | 26.3 | MIT (bundles its own vendored packages, see pip's `AUTHORS.txt` and `_vendor`) | https://github.com/pypa/pip | W |

Each package's own licence file is inside its `*.dist-info` folder in the app.

## Runtimes and tools

| Component | Version | Licence | Source | In |
|---|---|---|---|---|
| Python (embeddable) | 3.12.10 | PSF License; its `LICENSE.txt` also lists the parts Python bundles (OpenSSL, libffi, zlib, bzip2, xz, SQLite and others) | https://www.python.org/downloads/release/python-31210/ | W |
| Chaquopy (Python for Android, incl. its Python 3.12 build) | 17.0.0 | MIT; Python under the PSF License | https://github.com/chaquo/chaquopy | A |
| QuickJS-ng (`qjs`) | v0.18.0 (W), v0.17.0 (A) | MIT | https://github.com/quickjs-ng/quickjs | both |
| FFmpeg (`ffmpeg.exe`, `ffprobe.exe`) | 9.0.2 | LGPL v2.1 or later. Built by me from the unmodified source with no GPL or nonfree parts; the exact configure line is in `licenses/ffmpeg-BUILD.txt` and the build script is `desktop/tools/build_ffmpeg.sh`. Source: https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz | https://ffmpeg.org | W |
| zlib (inside the FFmpeg build) | 1.3.1 | zlib License | https://zlib.net | W |
| mingw-w64 runtime and winpthreads (inside the FFmpeg build) | 13.0.0 | ZPL 2.1 / MIT-style; see https://github.com/mingw-w64/mingw-w64/blob/master/COPYING.MinGW-w64-runtime/COPYING.MinGW-w64-runtime.txt | https://www.mingw-w64.org | W |
| Microsoft WebView2 SDK (`Microsoft.Web.WebView2.Core.dll`, `.WinForms.dll`, `WebView2Loader.dll`) | 1.0.4314.35 | Microsoft BSD-style licence (`licenses/WebView2-LICENSE.txt`) | https://www.nuget.org/packages/Microsoft.Web.WebView2 | W |
| AndroidX Activity, Core SplashScreen, WebKit | 1.9.3, 1.0.1, 1.12.1 | Apache-2.0 | https://developer.android.com/jetpack/androidx | A |
| Kotlin standard library | 2.1.21 | Apache-2.0 | https://github.com/JetBrains/kotlin | A |

The Windows app runs on the .NET Framework 4.8 and the Microsoft Edge WebView2 Runtime that come with Windows. Neither is
shipped in the installer.

## In the app's pages (`web/`)

| Component | Licence | Source |
|---|---|---|
| Inter (variable font, `web/fonts/InterVariable.woff2`) | SIL Open Font License 1.1 (`web/fonts/OFL.txt`) | https://github.com/rsms/inter |
| QR Code Generator for JavaScript (`web/qrcode.js`), Kazuhiko Arase | MIT. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED | https://github.com/kazuhikoarase/qrcode-generator |
| pixelfx (`web/pixelfx/`), Copyright (c) 2026 Patch and Hugo Duprez | MIT (`web/pixelfx/LICENSE`) | `web/pixelfx/README.md` |

pixelfx credits (from `web/pixelfx/NOTICE.md`):
- **Hugo Duprez.** `core/sim.js` and the effects that say so at the top of their file adapt Sprite Fusion's open-source pixel art
  VFX (https://www.spritefusion.com/pixel-art-vfx), Copyright (c) 2026 Hugo Duprez, MIT License.
- **Hollow Crown.** `core/act.js` adapts how Hollow Crown plays its skills (poses on 12 fps steps, hit-stops, the springy straw
  target), from https://github.com/rehan-remade/hollow-crown, Copyright (c) 2026 rehan-remade, MIT License.

## Logo artwork

| Component | Licence | Source |
|---|---|---|
| Fredoka (`brand/fonts/Fredoka-Bold.ttf`) | SIL Open Font License 1.1 | https://github.com/hafontia-zz/Fredoka |
| Rubik (`brand/fonts/Rubik-Medium.ttf`) | SIL Open Font License 1.1 | https://github.com/googlefonts/rubik |

These fonts are used to draw the logo and icons; the apps ship the finished pictures, not the font files.

## Not included

The apps contain no songs, no artwork from any music service and no third-party logos. Songs and covers are fetched on your
own device when you ask for them.
