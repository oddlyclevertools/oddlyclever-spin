# OddlyClever Spin for Android

A standalone, sideloaded APK: `server.py` runs inside the app (Chaquopy, Python 3.12) and a full-screen WebView shows `web/`. No PC needed.

```bash
bash android/build.sh             # signed arm64 APK -> dist/OddlyCleverMusic.apk (most phones)
bash android/build.sh universal   # arm64 + x86_64 -> dist/OddlyCleverMusic-universal.apk (emulators, Chromebooks)
bash android/build.sh test        # arm64 + x86_64 with WebView debugging, for the emulator (stays in app/build)
bash android/build.sh sidetest    # test build that installs beside the real app (own id, name and songs folder)
```

`tools/release.sh` builds both public APKs and names them `OddlyCleverSpin-<version>.apk` and `OddlyCleverSpin-<version>-universal.apk`.

- The version comes from `music-tool/VERSION`, shared with the Windows app. `versionCode` is major×10000 + minor×100 + patch, so it only goes up.
- `server.py`, `updates.py` and `web/` are copied from `music-tool/` on every build (`copyAppAssets`), so the APK never drifts.
- QuickJS-ng (MIT, pinned v0.17.0 + sha256) is fetched by build.sh into `jniLibs/<abi>/libqjs.so` and runs as yt-dlp's JS engine. There's no 32-bit ARM build: Chaquopy has no Python 3.12 for armeabi-v7a.
- Signing: `~/.config/godot-keys/oddlyclever-music.jks`, passwords in `oddlyclever-music.env` next to it. Never in the repo. Losing them means everyone has to uninstall before the next update.
- Needs JDK 17 + SDK at `C:/tools/android` and Python 3.12 (the build Python for Chaquopy's pip).
- `MainActivity.kt`: starts the server (port 8790), WebView, insets, back = page history then background, app updates (hands the downloaded APK to the system installer).
- `PlaybackService.kt`: foreground media service, MediaSession + media notification, wake lock while playing.
- `assets/bridge.js`: injected before the page's scripts; mirrors `navigator.mediaSession` + `#audio` to the notification and sends its buttons back.
- `python/ocm_main.py`: starts `server.py`, moves songs from the old private folder to the public one, loads a newer yt-dlp if one passed its check.

## Where songs go

Finished songs go to the public `Music/OddlyClever Spin` folder, so they show in Files and other players and stay if the app is uninstalled. Android 8–10 ask once for storage permission first; if you say no, songs stay inside the app (`Android/data/com.oddlyclever.music/files/Music/OddlyClever Music`), which uninstalling deletes. The library, covers and stream cache always stay inside the app.
