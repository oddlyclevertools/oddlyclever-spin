# OddlyClever Spin for Windows

This folder turns the music app into a normal Windows program, `OddlyClever Spin.exe`, with an installer, `dist/OddlyCleverMusic-Setup.exe`. `tools/release.sh` publishes it as `OddlyCleverSpin-Setup-<version>.exe`.

It's the same app as `run.bat`, but it doesn't need Python or ffmpeg on the PC. It runs in its own window with an icon in the Start menu and on the taskbar, and the media keys work. Only one copy runs at a time: opening it again brings the open window to the front.

## Installing it

1. Get the installer: from the GitHub release, from `dist/`, or from **Appearance → Get the app → Download for Windows** inside the app.
2. Run it and click **Install**. It installs just for you, in `%LOCALAPPDATA%\Programs\OddlyCleverMusic`, so it doesn't ask for admin rights. Windows may show **"Windows protected your PC"** because the file isn't signed. Click **More info**, then **Run anyway**.
3. Open it from the Start menu or the desktop shortcut.

Songs go to `%USERPROFILE%\Music\OddlyClever Music`, the same folder the `run.bat` copy uses, so both see the same library. The app's own settings, its browser profile and `server.log` live in `%LOCALAPPDATA%\OddlyCleverMusic`.

To uninstall, go to **Settings → Apps → Installed apps → OddlyClever Spin → Uninstall**. It removes the program and its shortcuts. It never touches your music folder or `%LOCALAPPDATA%\OddlyCleverMusic`.

Quiet install: `OddlyCleverMusic-Setup.exe /S` (add `/nodesktop` to skip the desktop shortcut). The uninstaller takes `/S` too. From Git Bash, write `//S`.

## Building it

You need the .NET SDK (8 or later), the dev venv (run `run.bat` once; it must be Python 3.12) and WSL with Ubuntu (the first build cross-compiles a small audio-only ffmpeg there with `desktop/tools/build_ffmpeg.sh`, then caches it in `desktop/build/cache`). From the `music-tool` folder:

```bash
bash desktop/build.sh
```

The version comes from `music-tool/VERSION`, shared with the Android app; the window passes it to the server as `OCM_APP_VERSION` for the update check.

It downloads the Python 3.12 embeddable zip and QuickJS-ng's `qjs.exe` once (cached in `desktop/build/cache`), stages the program in `desktop/build/stage` and writes `dist/OddlyCleverMusic-Setup.exe`. If `dist/OddlyCleverMusic.apk` exists, it goes into the program too, so the installed app can send it to a phone. To try the app without installing it, run `desktop/build/stage/OddlyClever Spin.exe`.

## How it fits together

| Path | What it is |
| --- | --- |
| `app/` | The window: WinForms and WebView2. It starts `server.py` with the bundled Python and no console window (port 8791, or any free port if that's taken), shows it, and stops it when the window closes. The server sits in a Windows job object, so it also stops if the app crashes. |
| `installer/` | `OddlyCleverMusic-Setup.exe`, with the program zipped inside. It also puts a copy of itself in the program's `server/dist`, so "Get the app" can hand it on. |
| `uninstaller/` | `Uninstall OddlyClever Spin.exe`, which "Apps & features" runs. |
| `shared/` | Names, folders, shortcuts and the "Apps & features" entry. |
| `assets/` | The record logo as an icon, drawn by `tools/make_ico.py`. |

The installed program folder holds `python/` (the embeddable Python with `requirements.txt` and pip in `Lib/site-packages`, so **Update downloader** still works), `server/` (`server.py`, `web/`, `dist/`) and `tools/` (`ffmpeg.exe`, `ffprobe.exe`, `qjs.exe`). The app passes `OCM_JS=quickjs:<path to qjs.exe>` and puts `tools/` first on `PATH`.

Set `OCM_DEVTOOLS=1` before starting the app to allow the browser developer tools.

## Licences

- ffmpeg and ffprobe are our own audio-only build of FFmpeg 9.0.2 (about 4 MB each), LGPL v2.1+ with no GPL or nonfree parts. `licenses/ffmpeg-BUILD.txt` names the source tarball and the exact configure line, and `licenses/` holds every other licence plus `THIRD_PARTY_NOTICES.md`.
- Python is under the PSF licence, QuickJS-ng under MIT, and the WebView2 SDK files under BSD-3-Clause. Their licences are in `licenses/` as well.
- `web/qrcode.js` is Kazuhiko Arase's QR code generator (MIT).
