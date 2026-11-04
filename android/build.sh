#!/usr/bin/env bash
# Builds the signed Android APK and copies it to music-tool/dist/OddlyCleverMusic.apk.
#   bash android/build.sh            phone build (arm64)
#   bash android/build.sh test       also adds x86_64, for the emulator, and WebView debugging
#   bash android/build.sh sidetest   test build that installs beside the real app (own id, name, songs folder)
#   bash android/build.sh universal  arm64 + x86_64 (emulators, Chromebooks, x86 tablets) -> dist/OddlyCleverMusic-universal.apk
set -euo pipefail
cd "$(dirname "$0")"

KEYS="$HOME/.config/godot-keys/oddlyclever-music.env"
[ -f "$KEYS" ] || { echo "missing $KEYS (keystore passwords)"; exit 1; }
set -a; . "$KEYS"; set +a

export JAVA_HOME="${JAVA_HOME:-C:/tools/android/jdk-17}"
echo "sdk.dir=${ANDROID_HOME:-C:/tools/android/sdk}" > local.properties
# Chaquopy builds with a Python 3.12: OCM_BUILD_PYTHON, else the dev venv (run.bat makes it), else Chaquopy's own search.
[ -n "${OCM_BUILD_PYTHON:-}" ] || [ ! -f ../.venv/Scripts/python.exe ] || export OCM_BUILD_PYTHON="$(cygpath -m "$PWD/../.venv/Scripts/python.exe")"

# QuickJS-ng (MIT): yt-dlp's JavaScript engine for YouTube. Static musl builds, pinned by hash.
QJS=v0.17.0
fetch_qjs() { # abi asset sha256
  local out="app/src/main/jniLibs/$1/libqjs.so"
  [ -f "$out" ] && echo "$3  $out" | sha256sum -c --quiet && return
  mkdir -p "$(dirname "$out")"
  curl -fsSL "https://github.com/quickjs-ng/quickjs/releases/download/$QJS/$2" -o "$out.part"
  echo "$3  $out.part" | sha256sum -c --quiet
  mv "$out.part" "$out"
}
fetch_qjs arm64-v8a qjs-linux-aarch64 3372133484edf50a69f3c67903af41206d22a061e930e3cfb63269272ef56d2e
ABIS=arm64-v8a
[ "${1:-}" = sidetest ] && { set -- test; OCM_GRADLE_ARGS="${OCM_GRADLE_ARGS:-} -Psidetest=true"; } # test build that sits beside the real app
if [ "${1:-}" = test ]; then
  fetch_qjs x86_64 qjs-linux-x86_64 0bfc02511a9f549c28b53880d988fc7cd5d361e90c5e8afdfcd7dc6774ceace5
  ABIS=arm64-v8a,x86_64
fi
if [ "${1:-}" = universal ]; then # no armeabi-v7a: Chaquopy has no Python 3.12 for it
  fetch_qjs x86_64 qjs-linux-x86_64 0bfc02511a9f549c28b53880d988fc7cd5d361e90c5e8afdfcd7dc6774ceace5
  ABIS=arm64-v8a,x86_64
fi

WEBDEBUG=false; [ "${1:-}" = test ] && WEBDEBUG=true # test builds: chrome://inspect can attach
# OCM_GRADLE_ARGS="-Pvcode=2 -Pvname=0.4.9" makes an "older" build to test in-app updates from.
./gradlew --no-daemon -q assembleRelease -Pabis=$ABIS -Pwebdebug=$WEBDEBUG ${OCM_GRADLE_ARGS:-}
APK=app/build/outputs/apk/release/app-release.apk
[ "${1:-}" = test ] && { ls -la "$APK"; exit 0; } # emulator build stays out of dist/
OUT=../dist/OddlyCleverMusic${1:+-$1}.apk  # OddlyCleverMusic.apk or OddlyCleverMusic-universal.apk
mkdir -p ../dist
cp "$APK" "$OUT"
ls -la "$OUT"
