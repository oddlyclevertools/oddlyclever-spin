#!/usr/bin/env bash
# Build the Windows app and its installer in one go:
#   bash desktop/build.sh   ->   dist/OddlyCleverMusic-Setup.exe
# Needs the .NET SDK, the dev venv (.venv, Python 3.12, from run.bat) and WSL Ubuntu (it builds the small LGPL ffmpeg once).
# Downloads (cached in desktop/build/cache): the Python 3.12 embeddable zip and QuickJS-ng's qjs.exe.
set -euo pipefail
cd "$(dirname "$0")/.."          # music-tool/
VERSION=${OCM_VERSION:-$(tr -d '[:space:]' < VERSION)}  # one version for both apps
PY_VER=3.12.10                   # last 3.12 with a Windows embeddable zip; matches .venv
QJS_VER=v0.18.0
FF_VER=9.0.2                     # must match desktop/tools/build_ffmpeg.sh
D=desktop
B=$D/build
C=$B/cache
S=$B/stage
PY=.venv/Scripts/python
mkdir -p "$C" dist

echo "== icon"
[ -f "$D/assets/OddlyCleverMusic.ico" ] || "$PY" "$D/tools/make_ico.py"

echo "== downloads"
fetch() { [ -s "$C/$1" ] || curl -fsSL -o "$C/$1" "$2"; }
fetch "python-$PY_VER-embed-amd64.zip" "https://www.python.org/ftp/python/$PY_VER/python-$PY_VER-embed-amd64.zip"
fetch "qjs-$QJS_VER.exe" "https://github.com/quickjs-ng/quickjs/releases/download/$QJS_VER/qjs-windows-x86_64.exe"
fetch "quickjs-LICENSE-$QJS_VER.txt" "https://raw.githubusercontent.com/quickjs-ng/quickjs/$QJS_VER/LICENSE"
FF=$C/ffmpeg-lgpl-$FF_VER        # audio-only LGPL ffmpeg + ffprobe (~4 MB each), built once in WSL
[ -s "$FF/ffmpeg.exe" ] || wsl --cd "$(pwd -W)" -e bash desktop/tools/build_ffmpeg.sh

echo "== staging the program folder"
rm -rf "$S"                      # generated each build
mkdir -p "$S/python" "$S/server/dist" "$S/tools" "$S/licenses"
"$PY" -m zipfile -e "$C/python-$PY_VER-embed-amd64.zip" "$S/python"
# the embeddable Python ignores site-packages until its ._pth file says otherwise
printf 'python312.zip\n.\nLib\\site-packages\nimport site\n' > "$S/python/python312._pth"
"$PY" -m pip install -q --disable-pip-version-check --target "$S/python/Lib/site-packages" \
  --only-binary=:all: --platform win_amd64 --python-version 3.12 -r requirements.txt pip  # pip: "Update downloader"
# mutagen (GPL) comes with yt-dlp[default] but the app never needs it: ffmpeg writes the tags and covers
rm -rf "$S/python/Lib/site-packages/"mutagen*
cp server.py THIRD_PARTY_NOTICES.md "$S/server/"  # updates.py serves About > Licences from the notices
[ ! -f updates.py ] || cp updates.py "$S/server/"   # server.py imports it once it lands
cp -r web "$S/server/web"
[ -f dist/OddlyCleverMusic.apk ] && cp dist/OddlyCleverMusic.apk "$S/server/dist/"  # "Get the app" can send it to a phone
cp "$FF/ffmpeg.exe" "$FF/ffprobe.exe" "$S/tools/"
cp "$C/qjs-$QJS_VER.exe" "$S/tools/qjs.exe"
cp "$FF/LICENSE.md" "$S/licenses/ffmpeg-LICENSE.md"
cp "$FF/COPYING.LGPLv2.1" "$S/licenses/ffmpeg-COPYING.LGPLv2.1.txt"
cp "$FF/BUILD.txt" "$S/licenses/ffmpeg-BUILD.txt"
cp LICENSE "$S/licenses/OddlyClever-Spin-LICENSE.txt"
cp THIRD_PARTY_NOTICES.md "$S/licenses/"
cp web/fonts/OFL.txt "$S/licenses/Inter-OFL.txt"
cp "$C/quickjs-LICENSE-$QJS_VER.txt" "$S/licenses/quickjs-LICENSE.txt"
mv "$S/python/LICENSE.txt" "$S/licenses/python-LICENSE.txt"

echo "== desktop shell and uninstaller"
dotnet publish "$D/app/OddlyCleverMusic.csproj" -c Release -o "$B/bin" -p:Version="$VERSION" -v quiet -nologo
dotnet publish "$D/uninstaller/Uninstaller.csproj" -c Release -o "$B/uninstall" -p:Version="$VERSION" -v quiet -nologo
cp "$B/bin/OddlyClever Spin.exe" "$B/bin/OddlyClever Spin.exe.config" \
   "$B/bin/Microsoft.Web.WebView2.Core.dll" "$B/bin/Microsoft.Web.WebView2.WinForms.dll" "$S/"
cp -r "$B/bin/runtimes" "$S/"
cp "$B/uninstall/Uninstall OddlyClever Spin.exe" "$B/uninstall/Uninstall OddlyClever Spin.exe.config" "$S/"
NUGET=$(dotnet nuget locals global-packages -l | sed 's/^global-packages: //' | tr -d '\r')
WV2=$(sed -n 's/.*Include="Microsoft.Web.WebView2" Version="\([^"]*\)".*/\1/p' "$D/app/OddlyCleverMusic.csproj")
cp "$NUGET/microsoft.web.webview2/$WV2/LICENSE.txt" "$S/licenses/WebView2-LICENSE.txt"

echo "== installer"
dotnet publish "$D/installer/Setup.csproj" -c Release -o "$B/setup" -p:Version="$VERSION" -v quiet -nologo
cp "$B/setup/OddlyCleverMusic-Setup.exe" dist/OddlyCleverMusic-Setup.exe
ls -l dist/OddlyCleverMusic-Setup.exe | awk '{printf "done: %s (%.1f MB)\n", $NF, $5/1048576}'
