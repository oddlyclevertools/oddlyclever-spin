#!/usr/bin/env bash
# Makes a clean public copy of Spin with a fresh one-commit history. Nothing is pushed.
#   bash tools/export_public.sh                 -> ../oddlyclever-spin-public
#   bash tools/export_public.sh <out-dir>
# It exports the last commit (HEAD), so commit first. Excluded: the built-in list below
# plus every "- <pathspec>" line in launch/EXPORT_EXCLUDES.md. Then it scans the copy for
# secrets, personal paths and media files, and stops if it finds any.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-../oddlyclever-spin-public}"

# Never overwrite: an old export must be moved away by hand (Recycle Bin).
if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
  echo "error: $OUT already exists and isn't empty. Move it to the Recycle Bin, then run again." >&2
  exit 1
fi
[ -z "$(git status --porcelain)" ] || echo "note: you have uncommitted changes; they are NOT in the export (it uses HEAD $(git rev-parse --short HEAD))."

# Internal notes, build briefs, rejected brand options, build outputs.
EXCLUDES=(
  LAUNCH_PLAN.md SPEED.md POLISH_PHONE.md VISUAL_V4.md
  DESIGN_SPEC.md CONTRACT_NOTES.md CONTRACT_V2.md MOTION_SPEC.md
  'brand/review*' brand/make_brand.py brand/svg
  'dist/*' '**/*.ipa' '**/*.apk' '**/*.exe' '**/*.jks' '**/*.keystore' '**/*.env' '**/.env*'
  '.venv' '**/__pycache__' '**/build' '**/.gradle' 'launch/EXPORT_EXCLUDES.md'
)
if [ -f launch/EXPORT_EXCLUDES.md ]; then
  while IFS= read -r line; do
    p="${line#- }"
    if [[ "$p" == \`* ]]; then p="${p#\`}"; p="${p%%\`*}"; else p="${p%%[[:space:]]*}"; p="${p%:}"; fi
    [ -n "$p" ] && EXCLUDES+=("$p")
  done < <(grep -E '^- [^ ]' launch/EXPORT_EXCLUDES.md)
else
  echo "note: launch/EXPORT_EXCLUDES.md not written yet; using the built-in list only."
fi
SPECS=(.)
for e in "${EXCLUDES[@]}"; do SPECS+=(":(exclude,glob)$e" ":(exclude,glob)$e/**"); done

mkdir -p "$OUT"
git archive --format=tar HEAD -- "${SPECS[@]}" | tar -x -C "$OUT"
echo "exported $(find "$OUT" -type f | wc -l) files to $OUT"

fail=0
for f in LICENSE README.md; do
  [ -f "$OUT/$f" ] || { echo "MISSING: $f"; fail=1; }
done
ls "$OUT"/THIRD_PARTY_NOTICES* >/dev/null 2>&1 || { echo "MISSING: THIRD_PARTY_NOTICES"; fail=1; }

# Secrets: generic token shapes. Personal: this PC's user name and home path, plus one regex
# per line from ~/.config/oddlyclever/export_scan.txt (kept outside the repo so the names stay private).
PATTERNS='sk-ant-|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_|gho_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abprs]-|-----BEGIN [A-Z ]*PRIVATE KEY|C:[/\]+Users[/\]+|/c/Users/|/home/[a-z]'
me="${USERNAME:-${USER:-}}"; [ -n "$me" ] && PATTERNS+="|$me"
PRIVATE="$HOME/.config/oddlyclever/export_scan.txt"
if [ -f "$PRIVATE" ]; then
  while IFS= read -r p; do [ -n "$p" ] && [ "${p:0:1}" != "#" ] && PATTERNS+="|$p"; done < "$PRIVATE"
else
  echo "note: $PRIVATE not found; scanning for secrets and this PC's user name only."
fi
hits=$(grep -rnIiE --exclude=export_public.sh "$PATTERNS" "$OUT" || true)  # this script's own patterns would match
if [ -n "$hits" ]; then echo "SCAN HITS (secrets / personal):"; echo "$hits" | cut -c1-200; fail=1; fi
media=$(find "$OUT" -type f \( -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.opus' -o -iname '*.flac' -o -iname '*.wav' -o -iname '*.webm' -o -iname '*.mp4' \) )
if [ -n "$media" ]; then echo "MEDIA FILES (no songs in the repo):"; echo "$media"; fail=1; fi
big=$(find "$OUT" -type f -size +5M)
if [ -n "$big" ]; then echo "FILES OVER 5 MB:"; echo "$big"; fail=1; fi

if [ "$fail" != 0 ]; then
  echo "export FAILED the checks above. Nothing was committed in $OUT." >&2
  exit 1
fi

cd "$OUT"
git init -q -b main
git add -A
git commit -q -m "feat: OddlyClever Spin, first public release" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
echo "scan passed. Fresh repo in $OUT: $(git rev-parse --short HEAD), $(git ls-files | wc -l) files. Not pushed."
