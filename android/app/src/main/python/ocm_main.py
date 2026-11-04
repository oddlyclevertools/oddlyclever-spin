"""Runs music-tool/server.py inside the app (Chaquopy). Called from MainActivity on a background thread."""
import json
import os
import runpy
import shutil
import sys

AUDIO_EXT = {".m4a", ".mp3", ".opus", ".ogg", ".webm", ".flac", ".wav", ".aac"}  # same list as server.py


def migrate(music_dir, songs_dir):
    """Move songs from the app's private folder to the public one. library.json stores bare file names, so it keeps
    working. A copy cut off by a kill is simply redone next start (the sizes differ), and the original goes only after
    a full copy."""
    moved = 0
    for name in sorted(os.listdir(music_dir)):
        src, dest = os.path.join(music_dir, name), os.path.join(songs_dir, name)
        if os.path.splitext(name)[1].lower() not in AUDIO_EXT or not os.path.isfile(src):
            continue
        try:
            if not (os.path.isfile(dest) and os.path.getsize(dest) == os.path.getsize(src)):
                shutil.copyfile(src, dest)
            if os.path.getsize(dest) == os.path.getsize(src):
                os.remove(src)  # the copy in Music/ is now the song
                moved += 1
        except OSError as e:  # this one stays private for now; the next start tries again
            print(f"couldn't move {name} to the Music folder: {e}", file=sys.stderr)
    if moved:
        print(f"moved {moved} songs to {songs_dir}")


def start(app_dir, music_dir, qjs, port, env="{}"):
    import certifi

    os.environ.update(json.loads(env))
    os.environ.update(OCM_DIR=music_dir, OCM_PORT=str(port), OCM_HOST="127.0.0.1",
                      OCM_JS="quickjs:" + qjs, SSL_CERT_FILE=certifi.where(),
                      OCM_CACHE_MB="500")  # stream cache cap: phones have less room than PCs
    # shortcut: server.py writes .cache/*.json in place, so a kill mid-write leaves an empty file that breaks
    # Discover for good; drop empty ones until server.py writes them atomically (see CONTRACT_NOTES ANDROID:).
    cache = os.path.join(music_dir, ".cache")
    for name in os.listdir(cache) if os.path.isdir(cache) else []:
        path = os.path.join(cache, name)
        if name.endswith(".json") and os.path.getsize(path) == 0:
            os.remove(path)
    songs = os.environ.get("OCM_SONGS")
    if songs and os.path.isdir(music_dir):
        migrate(music_dir, songs)
    sys.path.insert(0, app_dir)  # updates.py sits next to server.py
    import updates
    updates.load_engine(os.path.join(os.path.dirname(app_dir), "engine"))  # a newer yt-dlp from PyPI, if one passed its check
    updates.auto_engine()
    server = os.path.join(app_dir, "server.py")
    sys.argv = [server]  # server.py reads an optional music folder from argv[1]
    runpy.run_path(server, run_name="__main__")  # blocks in serve_forever()
