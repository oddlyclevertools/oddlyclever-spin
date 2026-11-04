#!/usr/bin/env bash
# Builds both apps, gives them public names, writes SHA256SUMS.txt and release notes, and prints the publish command.
#   bash tools/release.sh 0.5.0              build both apps, then dry run (prints the gh command, publishes nothing)
#   bash tools/release.sh 0.5.0 --no-build   use the builds already in dist/ (must be newer than the last commit)
#   bash tools/release.sh 0.5.0 --publish    same, then asks you to type "publish" before running gh release create
# Output: dist/release-<version>/  (OddlyCleverSpin-Setup-<v>.exe, OddlyCleverSpin-<v>.apk (arm64), OddlyCleverSpin-<v>-universal.apk,
#         SHA256SUMS.txt, RELEASE_NOTES.md). The version comes from music-tool/VERSION; <version> must match it.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=oddlyclevertools/oddlyclever-spin

V="${1:-}"; shift || true
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: bash tools/release.sh <major.minor.patch> [--no-build] [--publish]" >&2; exit 2; }
BUILD=1 PUBLISH=0
for a in "$@"; do
  case "$a" in --no-build) BUILD=0 ;; --publish) PUBLISH=1 ;; *) echo "unknown option: $a" >&2; exit 2 ;; esac
done
[ "$V" = "$(tr -d '[:space:]' < VERSION)" ] || { echo "VERSION says $(cat VERSION): change it to $V first (both apps read it)" >&2; exit 2; }
TAG="v$V" OUT="dist/release-$V"

EXE_SRC=dist/OddlyCleverMusic-Setup.exe APK_SRC=dist/OddlyCleverMusic.apk UNI_SRC=dist/OddlyCleverMusic-universal.apk
if [ "$BUILD" = 1 ]; then
  # Android first: the Windows installer carries the arm64 APK for "Send to my phone".
  bash android/build.sh universal
  bash android/build.sh
  bash desktop/build.sh
else
  since=$(git log -1 --format=%ct)
  for f in "$EXE_SRC" "$APK_SRC" "$UNI_SRC"; do
    [ -f "$f" ] || { echo "missing $f: run without --no-build" >&2; exit 1; }
    [ "$(stat -c %Y "$f")" -ge "$since" ] || { echo "$f is older than the last commit: run without --no-build" >&2; exit 1; }
  done
fi
AAPT=$(ls -d "${ANDROID_HOME:-C:/tools/android/sdk}"/build-tools/*/aapt2* 2>/dev/null | tail -1 || true)
if [ -n "$AAPT" ]; then
  for f in "$APK_SRC" "$UNI_SRC"; do
    got=$("$AAPT" dump badging "$f" 2>/dev/null | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")
    [ "$got" = "$V" ] || echo "warning: $f says versionName $got, not $V."
  done
fi

mkdir -p "$OUT"
# updates.pick_asset and the site tell the two APKs apart by "universal" in the name
EXE="OddlyCleverSpin-Setup-$V.exe" APK="OddlyCleverSpin-$V.apk" UNI="OddlyCleverSpin-$V-universal.apk"
cp "$EXE_SRC" "$OUT/$EXE"
cp "$APK_SRC" "$OUT/$APK"
cp "$UNI_SRC" "$OUT/$UNI"
(cd "$OUT" && sha256sum "$EXE" "$APK" "$UNI" > SHA256SUMS.txt)

# Draft "what's new" from feat/fix commits since the last tag. Read it and rewrite it in your own words before publishing.
prev=$(git describe --tags --abbrev=0 2>/dev/null || true)
changes=$(git log --format=%s ${prev:+"$prev"..HEAD} | sed -nE 's/^(feat|fix|perf)(\([^)]*\))?: (.*)/- \3/p' | head -20)
[ -n "$changes" ] && [ -n "$prev" ] || changes="The first public release. Search, play and keep music on your own device, with no account and no servers in between."
python - "$OUT" "$V" "$changes" <<'EOF'
import sys
from pathlib import Path
out, v, changes = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
t = Path("tools/release_notes.md").read_text(encoding="utf-8")
t = t.replace("{{VERSION}}", v).replace("{{CHANGES}}", changes).replace("{{SHA256SUMS}}", (out / "SHA256SUMS.txt").read_text().strip())
(out / "RELEASE_NOTES.md").write_text(t, encoding="utf-8", newline="\n")
EOF

echo
echo "Release files in $OUT:"
(cd "$OUT" && for f in "$EXE" "$APK" "$UNI" SHA256SUMS.txt RELEASE_NOTES.md; do printf '  %-36s %s\n' "$f" "$(du -h "$f" | cut -f1)"; done)
echo
cat "$OUT/SHA256SUMS.txt"
CMD=(gh release create "$TAG" --repo "$REPO" --title "OddlyClever Spin $V" --notes-file "$OUT/RELEASE_NOTES.md"
  "$OUT/$EXE" "$OUT/$APK" "$OUT/$UNI" "$OUT/SHA256SUMS.txt")
echo
echo "Read $OUT/RELEASE_NOTES.md first. To publish, run:"
printf '  %s' gh; printf ' %q' "${CMD[@]:1}"; echo
echo
echo "Obtainium (Android auto-updates) needs nothing extra: it reads the .apk from each GitHub release."
echo "  Add-app link: obtainium://add/https://github.com/$REPO"

if [ "$PUBLISH" = 1 ]; then
  read -r -p "Type publish to create $TAG on $REPO (anything else stops): " ok
  [ "$ok" = publish ] || { echo "Not published."; exit 0; }
  "${CMD[@]}"
else
  echo "Dry run: nothing was published."
fi
