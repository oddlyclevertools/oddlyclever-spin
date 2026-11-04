#!/usr/bin/env bash
# A small, audio-only, LGPL ffmpeg + ffprobe for the Windows app, cross-compiled in WSL (Ubuntu) with mingw-w64.
#   wsl --cd "<music-tool>" -e bash desktop/tools/build_ffmpeg.sh      (desktop/build.sh runs this when the cache is empty)
# Output: desktop/build/cache/ffmpeg-lgpl-$FF_VER/{ffmpeg.exe,ffprobe.exe,LICENSE.md,COPYING.LGPLv2.1,BUILD.txt}
# Only what the app uses: m4a/mp4, webm/mkv, opus/ogg, mp3, flac, wav in (copy, no transcoding), tags, and cover
# pictures (jpg/png/webp in, jpg/png out). No --enable-gpl and no nonfree parts, so the result is LGPL v2.1+.
set -euo pipefail
FF_VER=9.0.2
FF_SHA256=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e  # the first download's sum; a change means the release file changed
OUT="$PWD/desktop/build/cache/ffmpeg-lgpl-$FF_VER"
W="$HOME/ffbuild"
[ -s "$OUT/ffmpeg.exe" ] && { echo "ffmpeg $FF_VER already built: $OUT"; exit 0; }

need=(build-essential mingw-w64 libz-mingw-w64-dev make nasm pkg-config xz-utils curl)
dpkg -s "${need[@]}" >/dev/null 2>&1 || { sudo apt-get update -qq && sudo apt-get install -y -qq "${need[@]}"; }

mkdir -p "$W" "$OUT"
cd "$W"
[ -s "ffmpeg-$FF_VER.tar.xz" ] || curl -fsSL -o "ffmpeg-$FF_VER.tar.xz" "https://ffmpeg.org/releases/ffmpeg-$FF_VER.tar.xz"
sum=$(sha256sum "ffmpeg-$FF_VER.tar.xz" | cut -d' ' -f1)
[ -z "$FF_SHA256" ] || [ "$sum" = "$FF_SHA256" ] || { echo "ffmpeg source checksum mismatch: $sum"; exit 1; }
rm -rf "ffmpeg-$FF_VER" && tar xf "ffmpeg-$FF_VER.tar.xz"
cd "ffmpeg-$FF_VER"

CONF=(
  --target-os=mingw32 --arch=x86_64 --cross-prefix=x86_64-w64-mingw32- --pkg-config=pkg-config
  --enable-static --disable-shared --enable-small --disable-debug --disable-doc
  --disable-everything --disable-autodetect --disable-network --disable-avdevice --disable-ffplay
  --enable-ffmpeg --enable-ffprobe --enable-zlib --enable-w32threads
  --enable-protocol=file,pipe
  --enable-demuxer=mov,matroska,mp3,ogg,flac,wav,aac,image2,image_jpeg_pipe,image_png_pipe,image_webp_pipe
  --enable-muxer=mp4,ipod,mov,matroska,webm,mp3,ogg,opus,flac,wav,adts,image2
  --enable-decoder=aac,mp3float,mp3,opus,vorbis,flac,alac,pcm_s16le,mjpeg,png,webp,vp8
  --enable-encoder=mjpeg,png
  --enable-parser=aac,mpegaudio,opus,vorbis,flac,mjpeg,png,webp,vp8
  --enable-bsf=aac_adtstoasc,mjpeg2jpeg,null
  --enable-filter=scale,format,null,anull,aformat,aresample,copy,acopy
  --extra-ldflags=-static
)
./configure "${CONF[@]}" > "$W/configure.log"
make -j"$(nproc)" > "$W/make.log"
x86_64-w64-mingw32-strip ffmpeg.exe ffprobe.exe
cp ffmpeg.exe ffprobe.exe COPYING.LGPLv2.1 "$OUT/"
cp LICENSE.md "$OUT/LICENSE.md"
{
  echo "FFmpeg $FF_VER, built from the unmodified source https://ffmpeg.org/releases/ffmpeg-$FF_VER.tar.xz"
  echo "Source sha256: $sum"
  echo "Licence: LGPL v2.1 or later (no GPL or nonfree parts). Statically linked with zlib (zlib licence) and the"
  echo "mingw-w64 runtime (see THIRD_PARTY_NOTICES.md). Rebuild with OddlyClever Spin's desktop/tools/build_ffmpeg.sh."
  echo "Configure: ./configure ${CONF[*]}"
} > "$OUT/BUILD.txt"
ls -l "$OUT"
