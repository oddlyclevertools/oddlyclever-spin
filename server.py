"""OddlyClever Music: a local music downloader + player.

Run: .venv/Scripts/python server.py   (then open http://127.0.0.1:8790)
Everything stays on this PC. Songs go to %USERPROFILE%/Music/OddlyClever Music.
"""
import concurrent.futures as cf
import hashlib
import json
import mimetypes
import os
import queue
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import yt_dlp

try:
    from ytmusicapi import YTMusic
except ImportError:  # run.bat installs requirements.txt; until then the catalogue just reports why it is off
    YTMusic = None
sys.path.insert(0, str(Path(__file__).resolve().parent))  # the embedded Windows Python doesn't add the script's folder
import updates  # app + engine updates, diagnostics and licences: /api/app/*

PORT = int(os.environ.get("OCM_PORT", 8790))
HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
# Music folder: first argument, else OCM_DIR, else Music/OddlyClever Music.
MUSIC = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("OCM_DIR", Path.home() / "Music" / "OddlyClever Music"))
COVERS = MUSIC / ".covers"
CACHE = MUSIC / ".cache"
DB_FILE = MUSIC / "library.json"
SONGS = Path(os.environ.get("OCM_SONGS") or MUSIC)  # Android: finished songs go to the public Music folder; the rest stays private
AUDIO_EXT = {".m4a", ".mp3", ".opus", ".ogg", ".webm", ".flac", ".wav", ".aac"}
YT_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
CAT_ID = re.compile(r"^[A-Za-z0-9_-]{5,80}$")  # artist (UC...) and album (MPREb_...) ids
VIDEO_IN_URL = re.compile(r"(?:[?&]v=|youtu\.be/|/shorts/)([A-Za-z0-9_-]{11})")
DIST = HERE / "dist"  # built installers, served by "Get the app"
SETUP, APK = "OddlyCleverMusic-Setup.exe", "OddlyCleverMusic.apk"
mimetypes.add_type("application/vnd.android.package-archive", ".apk")  # so phones offer to install it
HAS_FFMPEG = bool(shutil.which("ffmpeg"))  # optional: without it songs keep YouTube's own tags and a jpg cover


def js_runtime():
    """yt-dlp needs a JavaScript engine for YouTube. OCM_JS="name" or "name:path" picks one (the apps bundle QuickJS)."""
    name, _, path = os.environ.get("OCM_JS", "").partition(":")
    if name:
        return {name: {"path": path} if path else {}}
    found = next((n for n, exe in (("node", "node"), ("deno", "deno"), ("bun", "bun"), ("quickjs", "qjs")) if shutil.which(exe)), None)
    return {found: {}} if found else {}


# cachedir: yt-dlp's default (~/.cache) is not a stable, writable spot inside the phone app
BASE_OPTS = {"quiet": True, "no_warnings": True, "noprogress": True, "js_runtimes": js_runtime(), "cachedir": str(CACHE / "yt-dlp")}
try:  # reuse YouTube's parsed player across songs and restarts: re-parsing it every song made phone lookups ~11 s
    from yt_dlp.extractor.youtube.jsc._builtin.ejs import EJSBaseJCP
    EJSBaseJCP._ENABLE_PREPROCESSED_PLAYER_CACHE = True
except ImportError:
    pass

MUSIC.mkdir(parents=True, exist_ok=True)
SONGS.mkdir(parents=True, exist_ok=True)
COVERS.mkdir(exist_ok=True)
CACHE.mkdir(exist_ok=True)
(CACHE / "audio").mkdir(exist_ok=True)
lock = threading.Lock()
jobs = {}  # job id -> dict, shown in the Downloads panel
work = queue.Queue()


def load_db():
    if DB_FILE.exists():
        return json.loads(DB_FILE.read_text("utf-8"))
    return {"tracks": {}, "playlists": []}


db = load_db()


def save_db():
    tmp = DB_FILE.with_suffix(".tmp")  # write-then-rename so a crash never leaves half a library
    tmp.write_text(json.dumps(db, ensure_ascii=False, indent=1), "utf-8")
    tmp.replace(DB_FILE)


def thumb(entry):
    if entry.get("id") and YT_ID.match(entry["id"]):
        return f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg"
    th = entry.get("thumbnails") or []
    return th[-1]["url"] if th else ""


def search_count(raw):
    """?n= picks how many web results (1-30); anything else means the default 20."""
    try:
        return min(30, max(1, int(raw)))
    except (TypeError, ValueError):
        return 20


def search_url(q):
    """A pasted link lists what's behind it (song, album, playlist)."""
    with yt_dlp.YoutubeDL({**BASE_OPTS, "extract_flat": "in_playlist", "playlistend": 300}) as y:
        info = y.extract_info(q, download=False)
    out = [yt_song(e, q) for e in (info.get("entries") or [info]) if e and e.get("id")]
    return {"title": info.get("title") if info.get("entries") else None, "results": out}


def yt_song(e, q=""):
    """A yt-dlp entry in the Song shape (plain YouTube has no album art, so the cover is the video frame)."""
    artist = e.get("artist") or clean_channel(e.get("channel") or e.get("uploader") or "")
    img = thumb(e)
    return {
        "id": e["id"], "url": e.get("webpage_url") or e.get("url") or q,
        "title": e.get("track") or clean_title(e.get("title") or "", artist),
        "artist": artist, "artists": [{"name": artist, "id": None}] if artist else [],
        "album": album_ref(e.get("album")), "duration": e.get("duration") or 0, "year": str(e.get("release_year") or ""),
        "cover": img, "cover_hd": img, "thumb": img, "explicit": False, "have": e["id"] in db["tracks"],
    }


def search(q, n=20):
    if q.startswith(("http://", "https://")):
        return search_url(q)
    try:
        return catalog_search(q, n)
    except Exception as e:  # catalogue down: plain YouTube search keeps the app usable
        with yt_dlp.YoutubeDL({**BASE_OPTS, "extract_flat": "in_playlist"}) as y:
            entries = y.extract_info(f"ytsearch{n}:{q}", download=False).get("entries") or []
        found = [yt_song(x) for x in entries if x and x.get("id")]
        return {"top": None, "songs": found, "albums": [], "artists": [], "videos": [], "results": found, "warning": str(e)[-200:]}


SUGGEST_URL = "https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q="
suggest_cache = {}


def parse_suggest(raw):
    """The endpoint answers ["query", ["suggestion", ...]]; keep up to 8 strings."""
    data = json.loads(raw)
    return [s for s in data[1] if isinstance(s, str)][:8]


def suggest(q):
    """Search-as-you-type ideas from YouTube's public suggest endpoint. Any failure means no ideas."""
    if len(q) < 2:
        return []
    if q not in suggest_cache:
        try:
            with urllib.request.urlopen(SUGGEST_URL + urllib.parse.quote(q), timeout=2) as r:
                suggest_cache[q] = parse_suggest(r.read().decode("utf-8", "replace"))
        except Exception:  # offline or the endpoint changed: the app just shows no suggestions
            return []
        if len(suggest_cache) > 200:
            suggest_cache.pop(next(iter(suggest_cache)))
    return suggest_cache[q]


def clean_channel(name):
    return re.sub(r"\s*-\s*Topic$", "", name)


JUNK = re.compile(r"\s*[\(\[](official\s*(music\s*)?(video|audio|lyric video|visualizer)|lyrics?( video)?|hd|hq|4k|audio|mv|m/v)[\)\]]", re.I)


def clean_title(title, artist):
    """'Daft Punk - Get Lucky (Official Video) [HD]' -> 'Get Lucky'."""
    title = JUNK.sub("", title).strip()
    if artist and title.lower().startswith(artist.lower() + " - "):
        title = title[len(artist) + 3:]
    return title or "Untitled"


# ---------- YouTube Music catalogue (ytmusicapi, no key) ----------
SIZED = re.compile(r"=w\d+-h\d+")
memo_cache = {}  # key -> (time, value); small in-memory cache for catalogue pages and stream links
ytm_by_region = {}


def memo(key, ttl, fn):
    hit = memo_cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    memo_cache[key] = (time.time(), val)
    if len(memo_cache) > 400:
        memo_cache.pop(next(iter(memo_cache)))
    return val


def ytm(region="GB"):
    if YTMusic is None:
        raise RuntimeError("ytmusicapi is not installed: run .venv\\Scripts\\python -m pip install -r requirements.txt")
    if region not in ytm_by_region:
        ytm_by_region[region] = YTMusic(location=region)
    return ytm_by_region[region]


def pick_thumb(thumbs):
    return thumbs[-1]["url"] if thumbs else ""


def resize_cover(url, w, h=None):
    """googleusercontent art takes any size in its '=w544-h544' suffix; video thumbnails stay as they are."""
    if "googleusercontent.com" in url and SIZED.search(url):
        return SIZED.sub(f"=w{w}-h{h or w}", url, count=1)
    return url


def covers_of(url):
    return {"cover": resize_cover(url, 544), "cover_hd": resize_cover(url, 1200)}


def seconds_of(r):
    if r.get("duration_seconds"):
        return int(r["duration_seconds"])
    parts = (r.get("duration") or r.get("length") or "").split(":")
    if not parts[0] or not all(p.isdigit() for p in parts):
        return 0
    total = 0
    for p in parts:
        total = total * 60 + int(p)
    return total


def artists_of(r):
    return [{"name": a["name"], "id": a.get("id")} for a in r.get("artists") or [] if a.get("name")]


def album_ref(a):
    if isinstance(a, dict) and a.get("name"):
        return {"name": a["name"], "id": a.get("id")}
    return {"name": a, "id": None} if isinstance(a, str) and a else None


def song_shape(r, album=None, cover="", track_no=None):
    """Any ytmusicapi song/video/track dict -> the contract's Song."""
    arts = artists_of(r)
    thumbs = r.get("thumbnails") or r.get("thumbnail") or []
    s = {
        "id": r.get("videoId") or "", "title": r.get("title") or "Untitled",
        "artist": arts[0]["name"] if arts else "", "artists": arts,
        "album": album or album_ref(r.get("album")), "duration": seconds_of(r),
        "year": str(r.get("year") or ""), **covers_of(cover or pick_thumb(thumbs)),
        "explicit": bool(r.get("isExplicit")), "have": False,
    }
    if track_no or r.get("trackNumber"):
        s["track_no"] = track_no or r["trackNumber"]
    return s


def album_shape(r, artist=None, kind="Album"):
    arts = artists_of(r) or ([artist] if artist else [])
    return {
        "id": r.get("browseId") or r.get("id") or "", "title": r.get("title") or "Untitled",
        "artist": arts[0]["name"] if arts else "", "artist_id": arts[0]["id"] if arts else None,
        "year": str(r.get("year") or ""), "type": r.get("type") or kind, **covers_of(pick_thumb(r.get("thumbnails") or [])),
    }


def artist_shape(r):
    url = pick_thumb(r.get("thumbnails") or [])
    first = (artists_of(r) or [{"name": "", "id": ""}])[0]  # the mixed-search top result carries the artist this way
    a = {"id": r.get("browseId") or r.get("channelId") or r.get("id") or first["id"] or "",
         "name": r.get("artist") or r.get("title") or r.get("name") or first["name"],
         "photo": resize_cover(url, 544), "photo_hd": resize_cover(url, 1200)}
    if r.get("subscribers"):
        a["subscribers"] = r["subscribers"]
    return a


def mark_have(songs):
    for s in songs:
        s["have"] = s["id"] in db["tracks"]
    return songs


def check_id(raw):
    if not CAT_ID.match(raw or ""):
        raise ValueError("bad id")
    return raw


def run_all(jobs):
    """Run {name: callable} at once. A failed call gives None, so one slow or broken source can't sink the page."""
    out = {}
    with cf.ThreadPoolExecutor(len(jobs)) as ex:
        futs = {k: ex.submit(fn) for k, fn in jobs.items()}
        for k, f in futs.items():
            try:
                out[k] = f.result()
            except Exception as e:
                out[k] = None
                out.setdefault("_error", str(e)[-300:])
    return out


def catalog_search(q, n=20):
    y = ytm()
    got = run_all({"all": lambda: y.search(q),
                   **{k: (lambda k=k: y.search(q, filter=k, limit=n)) for k in ("songs", "albums", "artists", "videos")}})
    if all(got.get(k) is None for k in ("all", "songs", "albums", "artists", "videos")):
        raise RuntimeError(got.get("_error", "YouTube Music did not answer"))
    top = top_shape(next((r for r in got.get("all") or [] if r.get("category") == "Top result"), None))
    songs = [song_shape(r) for r in got.get("songs") or [] if r.get("videoId")]
    if top and top["kind"] == "song":  # the mixed list often lacks the album; the Songs list has it
        top["item"] = next((s for s in songs if s["id"] == top["item"]["id"]), top["item"])
    return {
        "top": top, "songs": mark_have(songs),
        "albums": [album_shape(r) for r in got.get("albums") or [] if r.get("browseId")],
        "artists": [artist_shape(r) for r in got.get("artists") or [] if r.get("browseId")],
        "videos": mark_have([song_shape(r) for r in got.get("videos") or [] if r.get("videoId")]),
        "results": songs,
    }


def top_shape(r):
    kind = (r or {}).get("resultType")
    if kind in ("song", "video") and r.get("videoId"):
        return {"kind": "song", "item": mark_have([song_shape(r)])[0]}
    if kind == "album" and r.get("browseId"):
        return {"kind": "album", "item": album_shape(r)}
    if kind == "artist" and artist_shape(r)["id"]:
        return {"kind": "artist", "item": artist_shape(r)}
    return None


def artist_page(aid):
    a = memo(("artist", aid), 3600, lambda: ytm().get_artist(aid))
    me = {"name": a.get("name", ""), "id": aid}
    songs = (a.get("songs") or {}).get("results") or []
    more = (a.get("songs") or {}).get("browseId")
    if more and len(songs) < 10:  # the page lists 5; the full "Songs" playlist has the rest
        try:
            songs = memo(("toptracks", more), 3600, lambda: ytm().get_playlist(more, limit=10))["tracks"] or songs
        except Exception:
            pass
    url = pick_thumb(a.get("thumbnails") or [])
    section = lambda k: (a.get(k) or {}).get("results") or []
    return {
        "id": aid, "name": me["name"], "photo_hd": resize_cover(url, 1200), "banner": resize_cover(url, 1920, 800),
        "description": a.get("description") or "",
        "songs": mark_have([song_shape(r) for r in songs[:10] if r.get("videoId")]),
        "albums": [album_shape(r, me) for r in section("albums")],
        "singles": [album_shape(r, me, "Single") for r in section("singles")],
        "related": [artist_shape(r) for r in section("related")],
    }


def album_page(bid):
    a = memo(("album", bid), 3600, lambda: ytm().get_album(bid))
    arts = artists_of(a)
    cover = pick_thumb(a.get("thumbnails") or [])
    ref = {"name": a.get("title", ""), "id": bid}
    tracks = [song_shape({**t, "year": a.get("year")}, album=ref, cover=cover) for t in a.get("tracks") or [] if t.get("videoId")]
    return {
        "id": bid, "title": a.get("title", ""), "artist": arts[0]["name"] if arts else "",
        "artist_id": arts[0]["id"] if arts else None, "year": str(a.get("year") or ""), "type": a.get("type") or "Album",
        "cover_hd": resize_cover(cover, 1200),
        "total_seconds": a.get("duration_seconds") or sum(t["duration"] for t in tracks), "tracks": mark_have(tracks),
    }


# ---------- discover shelves ----------
DISCOVER_TTL = 6 * 3600
SHELF_ORDER = ("top-songs", "trending", "new-releases", "popular-artists")
disc_lock = threading.Lock()


def norm(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def squareify(y, song):
    """A chart entry is a music video (16:9 frame). Swap in the same song's album-art version when the catalogue has one."""
    if "googleusercontent" in song["cover"] or not song["artist"]:
        return song
    try:
        title = clean_title(song["title"], song["artist"])
        want = norm(title)
        for r in y.search(f"{song['artist']} {title}", filter="songs", limit=3):
            same_artist = any(norm(a["name"]) == norm(song["artist"]) for a in artists_of(r))
            if r.get("videoId") and same_artist and want and (want in norm(r["title"]) or norm(r["title"]) in want):
                return song_shape(r)
    except Exception:
        pass
    return song


def shelf(sid, title, kind, items):
    return {"id": sid, "title": title, "kind": kind, "items": items}


def charts_shelves(y, region):
    ch = y.get_charts(region)
    out = []
    trend = next((v for v in ch.get("videos") or [] if v["title"].startswith("Trending")), None)
    if trend:
        tracks = [song_shape(t) for t in y.get_playlist(trend["playlistId"], limit=20)["tracks"] if t.get("videoId")]
        with cf.ThreadPoolExecutor(8) as ex:
            out.append(shelf("top-songs", "Top songs", "songs", list(ex.map(lambda s: squareify(y, s), tracks))))
    if ch.get("artists"):
        out.append(shelf("popular-artists", "Popular artists", "artists", [artist_shape(a) for a in ch["artists"][:20]]))
    return out


def home_shelves(y):
    for sec in y.get_home(limit=1):
        songs = [song_shape(r) for r in sec.get("contents") or [] if r.get("videoId")]
        if songs:
            return [shelf("trending", "Trending now", "songs", songs)]
    return []


def explore_shelves(y):
    albums = [album_shape(r) for r in y.get_explore().get("new_releases") or [] if r.get("browseId")]
    return [shelf("new-releases", "New albums & singles", "albums", albums)] if albums else []


def build_discover(region):
    y = ytm(region)
    got = run_all({"c": lambda: charts_shelves(y, region), "h": lambda: home_shelves(y), "e": lambda: explore_shelves(y)})
    shelves = [s for k in "che" for s in got.get(k) or []]
    if not shelves:
        raise RuntimeError(got.get("_error", "YouTube Music has no shelves right now"))
    shelves.sort(key=lambda s: SHELF_ORDER.index(s["id"]))
    return {"region": region, "shelves": shelves}


def cached_discover(region):
    f = CACHE / f"discover_{region}.json"
    with disc_lock:
        old = json.loads(f.read_text("utf-8")) if f.exists() else None
        if old and time.time() - old["time"] < old.get("ttl", DISCOVER_TTL):
            return old["data"]
        try:
            data = build_discover(region)
        except Exception:
            if old:  # YouTube is down: yesterday's shelves beat an empty home
                return old["data"]
            raise
        ttl = DISCOVER_TTL if len(data["shelves"]) == len(SHELF_ORDER) else 600  # a shelf is missing: look again soon
        f.write_text(json.dumps({"time": time.time(), "ttl": ttl, "data": data}, ensure_ascii=False), "utf-8")
        return data


def more_from_library(limit=2):
    """'More from <artist>' for the artists you play most (needs the artist id saved with the song)."""
    mine = {}
    for t in db["tracks"].values():
        if t.get("artist_id"):
            n = mine.setdefault(t["artist_id"], [t.get("artist", ""), 0])
            n[1] += 1 + t.get("plays", 0)
    out = []
    for aid, (name, _) in sorted(mine.items(), key=lambda kv: -kv[1][1])[:limit]:
        try:
            songs = [s for s in artist_page(aid)["songs"] if not s["have"]]
        except Exception:
            continue
        if songs:
            out.append(shelf("more-" + aid, f"More from {name}", "songs", songs))
    return out


def discover(region):
    data = cached_discover(region)
    for s in data["shelves"]:
        if s["kind"] == "songs":
            mark_have(s["items"])
    return {"region": region, "shelves": data["shelves"] + more_from_library()}


# ---------- same-origin image proxy (no CORS or referrer trouble, and each picture is fetched once) ----------
IMG_HOST = re.compile(r"^https://(?:[a-z0-9-]+\.)?(?:googleusercontent\.com|ggpht\.com|ytimg\.com)/")
IMG_DIR = CACHE / "img"


class ImgRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not IMG_HOST.match(newurl):  # never follow a cover redirect off the allow-list (no SSRF into your network)
            raise ValueError("cover redirected off the allow-list")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


img_opener = urllib.request.build_opener(ImgRedirects)


def proxied_image(url):
    """Bytes of an allow-listed cover URL, cached on disk. Raises ValueError for any other host."""
    if not IMG_HOST.match(url):
        raise ValueError("only YouTube Music cover URLs")
    IMG_DIR.mkdir(exist_ok=True)
    f = IMG_DIR / (hashlib.sha1(url.encode()).hexdigest() + ".img")
    if not f.exists():
        last = None
        for _ in range(3):  # a busy burst of tiles can get a 429 or reset: wait a beat and ask again
            try:
                with img_opener.open(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as r:
                    data, kind = r.read(), r.headers.get_content_type()
                if kind.startswith("image/") and len(data) > 200:
                    f.write_bytes(data)
                    return data, kind
            except Exception as e:
                last = e
            time.sleep(0.5)
        raise RuntimeError(f"image fetch failed: {last}")
    data = f.read_bytes()
    return data, "image/png" if data[1:4] == b"PNG" else "image/webp" if data[8:12] == b"WEBP" else "image/jpeg"


# ---------- instant streaming ----------
STREAM_TTL = 19800  # YouTube's links say expire= 6 h; keep them 5.5 h (stream() re-resolves one that dies early)
AUDIO_TYPES = {"m4a": "audio/mp4", "mp4": "audio/mp4", "webm": "audio/webm", "opus": "audio/ogg", "mp3": "audio/mpeg"}
KEEP_HEADERS = ("User-Agent", "Accept", "Accept-Language", "Sec-Fetch-Mode")


AUDIO_CACHE = CACHE / "audio"  # songs you streamed, kept so a replay starts at once (and works offline)
AUDIO_CACHE_MAX = int(os.environ.get("OCM_CACHE_MB", 800)) * 2**20  # the phone app sets a smaller cap
AHEAD_DAYS = 7  # a downloaded-ahead song ("<id>.ahead.m4a") nobody played is dropped after a week
LINKS_FILE = CACHE / "stream_links.json"
stream_locks = {}
resolve_slots = queue.LifoQueue()  # 3 lookups at once (each may run YouTube's JS puzzle: keep a phone's CPU free)
for _ in range(3):
    resolve_slots.put({})  # each slot keeps its YoutubeDLs (warmest first), so player.js and its timestamp stay in memory
# YouTube's visionos client hands out audio links that play at once (the web client's wait ~5 s first) and need no
# JS puzzle, so no QuickJS on the phone. The web client is the fallback if visionos stops working.
LOOKUPS = (("visionos", {**BASE_OPTS, "js_runtimes": {}, "extractor_args": {"youtube": {"player_client": ["visionos"]}}}),
           ("web", BASE_OPTS))
CHUNK = 4 << 20  # YouTube throttles an open-ended bytes=0- to ~2x play speed; closed ranges come at full speed


def trim_player_cache(keep=2):
    """yt-dlp never drops old parsed players (~4 MB each, YouTube ships a new one every few days): keep the newest."""
    old = sorted((CACHE / "yt-dlp" / "challenge-solver").glob("player,*"), key=lambda f: f.stat().st_mtime)[:-keep]
    for f in old:
        f.unlink(missing_ok=True)


trim_player_cache()


def load_links():
    """Stream links survive a restart (the phone app gets closed a lot); each lives about an hour."""
    try:
        links = json.loads(LINKS_FILE.read_text("utf-8"))
    except (OSError, ValueError):
        return
    for vid, (t, src) in links.items():
        if time.time() - t < STREAM_TTL:
            memo_cache[("stream", vid)] = (t, src)


def save_links():
    live = {k[1]: v for k, v in list(memo_cache.items()) if k[0] == "stream" and time.time() - v[0] < STREAM_TTL}
    tmp = LINKS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(live), "utf-8")
    tmp.replace(LINKS_FILE)


load_links()


def resolve_stream(vid):
    def look():
        slot = resolve_slots.get()
        try:
            for name, opts in LOOKUPS:
                y = slot.get(name) or slot.setdefault(name, yt_dlp.YoutubeDL({**opts, "format": "bestaudio[ext=m4a]/bestaudio"}))
                try:
                    info = y.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
                    break
                except yt_dlp.utils.DownloadError as e:
                    if name == LOOKUPS[-1][0]:
                        raise
                    print(f"{name} lookup failed for {vid}, trying the next client: {str(e)[-150:]}", file=sys.stderr)
        finally:
            resolve_slots.put(slot)
        heads = {k: v for k, v in (info.get("http_headers") or {}).items() if k in KEEP_HEADERS}
        return {"url": info["url"], "headers": heads, "type": AUDIO_TYPES.get(info.get("ext"), "audio/mp4"),
                "ext": info.get("ext") or "m4a",
                "ready": info.get("available_at") or 0}  # YouTube serves a fresh link only ~5 s after it was handed out
    with stream_locks.setdefault(vid, threading.Lock()):  # a warm-up and a tap on the same song share one lookup
        fresh = ("stream", vid) not in memo_cache
        src = memo(("stream", vid), STREAM_TTL, look)
        if fresh:
            with lock:
                save_links()
        return src


def cached_audio(vid):
    return next((f for f in AUDIO_CACHE.glob(f"{vid}.*") if f.suffix != ".part"), None)


def trim_audio_cache():
    """Keep the stream cache under its cap: downloaded-ahead songs nobody played go first (and after a week anyway),
    then the songs played longest ago (cache files only)."""
    files = sorted((f for f in AUDIO_CACHE.iterdir() if f.suffix != ".part"),
                   key=lambda f: (".ahead." not in f.name, f.stat().st_mtime))
    total = sum(f.stat().st_size for f in files)
    stale = lambda f: ".ahead." in f.name and time.time() - f.stat().st_mtime > AHEAD_DAYS * 86400
    while files and (total > AUDIO_CACHE_MAX or stale(files[0])):
        f = files.pop(0)
        total -= f.stat().st_size
        f.unlink(missing_ok=True)


KEEP_PER_HOUR = 40  # download-ahead cap (~4 MB a song), on top of the app's own Wi-Fi-only rule
keep_queue = queue.Queue(maxsize=20)
kept = []  # when each download-ahead started, for the hourly cap


def keep_song(vid):
    """Download a whole song into the stream cache before anyone taps it, so it starts at once and plays offline."""
    src = resolve_stream(vid)
    up = open_range(src, 0, CHUNK - 1)
    if up in (None, 416):
        raise OSError("YouTube refused the audio link")
    total = total_size(up)
    part = AUDIO_CACHE / f"{vid}.{uuid.uuid4().hex[:6]}.part"
    try:
        with open(part, "wb") as f:
            for chunk in read_ranges(src, up, CHUNK, total - 1):
                f.write(chunk)
        if part.stat().st_size == total and not cached_audio(vid):  # a full play may have finished it meanwhile
            part.replace(AUDIO_CACHE / f"{vid}.ahead.{src['ext']}")
            trim_audio_cache()
    finally:
        part.unlink(missing_ok=True)


def keeper():
    trim_audio_cache()  # drops week-old downloaded-ahead songs left from earlier runs
    while True:
        vid = keep_queue.get()
        kept[:] = [t for t in kept if time.time() - t < 3600]
        if cached_audio(vid) or len(kept) >= KEEP_PER_HOUR:
            continue
        kept.append(time.time())
        try:
            keep_song(vid)
        except Exception as e:  # one failed song must not stop the worker
            print(f"download-ahead of {vid} failed: {e}", file=sys.stderr)
        time.sleep(2)  # one song at a time with a pause: polite to YouTube


def ready_in(src):
    return max(0.0, min(10.0, src["ready"] - time.time()))


def open_range(src, start, end):
    """One closed byte range of the link. A web-client link wakes up at src["ready"]; it opens ~0.5-1 s early, so knock from 1.5 s before."""
    time.sleep(max(0.0, ready_in(src) - 1.5))
    req = urllib.request.Request(src["url"], headers={**src["headers"], "Range": f"bytes={start}-{end}"})
    while True:
        try:
            return urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError as e:
            if e.code == 416:
                return 416
            if e.code != 403 or time.time() > src["ready"] + 1:
                return None
            time.sleep(0.25)


def total_size(up):
    return int((up.headers.get("Content-Range") or f"/{up.headers['Content-Length']}").rsplit("/", 1)[1])


def read_ranges(src, up, start, end):
    """Yield the open first range `up`, then bytes start..end in CHUNK-sized closed ranges."""
    while True:
        with up:
            while chunk := up.read(1 << 16):
                yield chunk
        if start > end:
            return
        up = open_range(src, start, min(start + CHUNK - 1, end))
        if up in (None, 416):
            raise OSError("YouTube refused the next part of the song")
        start += CHUNK


# ---------- catalogue tags + square covers for downloads ----------
lock_ffmpeg = threading.Lock()  # both download workers and fix-info share one scratch file
EMBED_COVER = {".m4a", ".mp3", ".flac"}  # containers where ffmpeg can attach a picture


def video_id(url):
    m = VIDEO_IN_URL.search(url or "")
    return m[1] if m else None


def song_meta(vid):
    """Catalogue facts for one videoId as a Song (with track_no), or None when it isn't an album track there."""
    t = memo(("watch", vid), 3600, lambda: ytm().get_watch_playlist(vid, limit=1))["tracks"][0]
    ref = album_ref(t.get("album"))
    if t.get("videoId") != vid or not ref or not ref["id"]:
        return None
    alb = memo(("album", ref["id"]), 3600, lambda: ytm().get_album(ref["id"]))
    cover = pick_thumb(alb.get("thumbnails") or []) or pick_thumb(t.get("thumbnail") or [])
    track = next((x for x in alb.get("tracks") or [] if x.get("videoId") == vid), {})
    return song_shape({**t, "year": t.get("year") or alb.get("year")}, album=ref, cover=cover, track_no=track.get("trackNumber"))


def safe_song_meta(vid, title="", duration=0):
    """Catalogue facts for a videoId; a label's music video falls back to the same song found by name and length."""
    try:
        return (song_meta(vid) if vid else None) or (find_song(title, duration) if title and duration else None)
    except Exception:  # no network or an odd id: the caller falls back to YouTube's own info
        return None


def song_query(title):
    """'NO SNITCHING - Vin WRLD & Harshit Rao | cast | director' -> 'NO SNITCHING - Vin WRLD & Harshit Rao'."""
    return re.split(r"\s*[|\[]", JUNK.sub("", title))[0].strip()


def name_words(title):
    return " ".join(re.findall(r"[a-z0-9]+", re.split(r"\s*[(\[]", title.lower())[0]))


def same_song(hit, query, duration):
    """The hit's own name must appear in the video title and its length must match within 5 s."""
    name = name_words(hit.get("title") or "")
    return bool(name) and name in " ".join(re.findall(r"[a-z0-9]+", query.lower()))         and abs((hit.get("duration_seconds") or 0) - duration) <= 5


def find_song(title, duration):
    query = song_query(title)
    hits = memo(("find", query), 3600, lambda: ytm().search(query, filter="songs", limit=5))
    hit = next((h for h in hits if h.get("videoId") and same_song(h, query, duration)), None)
    return song_meta(hit["videoId"]) if hit else None


def fetch_cover(url, dest):
    """Save the 1200 px square cover; True when a real image landed."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
    except Exception:
        return False
    if len(data) < 1000:
        return False
    tmp = dest.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(dest)
    return True


def retag(audio, meta, cover=None):
    """Write catalogue tags (and the cover where the format allows) into a copy, then swap it in. True on success."""
    if not shutil.which("ffmpeg"):
        return False
    ext = audio.suffix.lower()
    tmp = CACHE / f"retag{ext}"
    embed = cover is not None and cover.exists() and ext in EMBED_COVER
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(audio)]
    cmd += ["-i", str(cover), "-map", "0:a", "-map", "1:v", "-disposition:v:0", "attached_pic"] if embed else ["-map", "0:a"]
    cmd += ["-c", "copy", "-map_metadata", "0"]
    tags = {"title": meta["title"], "artist": ", ".join(a["name"] for a in meta["artists"]) or meta["artist"],
            "album_artist": meta["artist"], "album": (meta["album"] or {}).get("name", ""), "date": meta["year"],
            "track": meta.get("track_no") or ""}
    for k, v in tags.items():
        cmd += ["-metadata", f"{k}={v}"]
    if ext == ".mp3":
        cmd += ["-id3v2_version", "3"]
    try:
        with lock_ffmpeg:
            r = subprocess.run(cmd + [str(tmp)], capture_output=True, text=True)
            if r.returncode != 0:
                return False
            tmp.replace(audio)
    except OSError:  # the file is open in a player right now: try again later
        return False
    return True



def catalogue_fields(meta):
    """The library.json fields that come from the catalogue (old tracks simply don't have them)."""
    alb = meta["album"] or {}
    return {"title": meta["title"], "artist": meta["artist"], "artists": meta["artists"], "album": alb.get("name", ""),
            "album_id": alb.get("id"), "artist_id": meta["artists"][0]["id"] if meta["artists"] else None,
            "year": meta["year"], "track_no": meta.get("track_no")}


def fix_info(ids=None):
    """Re-tag library songs from the catalogue. Audio files are re-tagged in place, never deleted or renamed."""
    fixed = skipped = 0
    wanted = [i for i in (ids if isinstance(ids, list) else list(db["tracks"])) if isinstance(i, str) and i in db["tracks"] and YT_ID.match(i)]
    for vid in wanted:
        t = db["tracks"][vid]
        meta = safe_song_meta(vid, t.get("source_title") or t.get("title", ""), t.get("duration") or 0)
        audio = SONGS / t["file"]
        if not meta or not audio.is_file():
            skipped += 1
            continue
        cover = COVERS / f"{vid}.jpg"
        got = fetch_cover(meta["cover_hd"], cover)
        retag(audio, meta, cover if got else None)
        with lock:
            db["tracks"][vid].update(catalogue_fields(meta), cover=cover.name if cover.exists() else db["tracks"][vid].get("cover", ""))
            save_db()
        fixed += 1
    return {"fixed": fixed, "skipped": skipped}


def add_job(url, title=""):
    jid = uuid.uuid4().hex[:8]
    jobs[jid] = {"id": jid, "url": url, "title": title or url, "status": "queued", "progress": 0, "error": "", "track": None}
    work.put(jid)
    return jid


def safe_name(text):
    return yt_dlp.utils.sanitize_filename(text, restricted=False).replace("%", "%%")  # %% = literal % in an output template


def download_opts(hook, meta):
    opts = {**BASE_OPTS, "format": "bestaudio[ext=m4a]/bestaudio", "windowsfilenames": True, "noplaylist": True, "progress_hooks": [hook]}
    if meta:  # catalogue song: our own tags and square cover go in afterwards
        name = safe_name(f"{meta['artist']} - {meta['title']}")
        return {**opts, "outtmpl": str(MUSIC / f"{name} [%(id)s].%(ext)s")}
    outtmpl = str(MUSIC / "%(artist,channel)s - %(track,title)s [%(id)s].%(ext)s")
    if not HAS_FFMPEG:  # the cover is fetched as a jpg after the download instead
        return {**opts, "outtmpl": outtmpl}
    return {**opts, "writethumbnail": True, "outtmpl": outtmpl,
            "postprocessors": [
                {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"},
                {"key": "FFmpegMetadata"},
                {"key": "EmbedThumbnail", "already_have_thumbnail": True},
            ]}


def download(jid):
    job = jobs[jid]
    job["status"] = "downloading"

    def hook(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            job["progress"] = round(100 * d.get("downloaded_bytes", 0) / total) if total else 0

    meta = safe_song_meta(video_id(job["url"]))
    try:
        with yt_dlp.YoutubeDL(download_opts(hook, meta)) as y:
            info = y.extract_info(job["url"])
        meta = meta or safe_song_meta(None, info.get("title") or "", info.get("duration") or 0)
        audio = Path(info["requested_downloads"][0]["filepath"])
        cover = COVERS / f"{info['id']}.jpg"
        if meta:
            if fetch_cover(meta["cover_hd"], cover):
                retag(audio, meta, cover)
            else:
                retag(audio, meta)
        elif audio.with_suffix(".jpg").exists():
            audio.with_suffix(".jpg").replace(cover)
        else:
            fetch_cover(f"https://i.ytimg.com/vi/{info['id']}/hqdefault.jpg", cover)
        if SONGS != MUSIC:  # downloaded and tagged privately (yt-dlp's .part files can't live in Music/), then published
            audio = Path(shutil.move(str(audio), str(SONGS / audio.name)))
        artist = info.get("artist") or clean_channel(info.get("channel") or "")
        track = {
            "id": info["id"],
            "title": info.get("track") or clean_title(info.get("title") or audio.stem, artist),
            "artist": artist,
            "codec": f"{info.get('acodec', '')} {round(info.get('abr') or 0)} kbps".strip(),
            "album": info.get("album") or "",
            "year": info.get("release_year") or (info.get("upload_date") or "")[:4],
            "duration": info.get("duration") or 0,
            "file": audio.name,
            "cover": cover.name if cover.exists() else "",
            "source": info.get("webpage_url", job["url"]),
            "source_title": info.get("title") or "",
            "added": time.time(), "liked": False, "plays": 0, "lastPlayed": 0,
        }
        if meta:
            track.update(catalogue_fields(meta))
        with lock:
            old = db["tracks"].get(track["id"], {})
            for keep in ("liked", "plays", "lastPlayed", "added"):  # re-downloading keeps your history
                if keep in old:
                    track[keep] = old[keep]
            db["tracks"][track["id"]] = track
            save_db()
        job.update(status="done", progress=100, title=track["title"], track=track["id"])
    except Exception as e:  # one bad link must not stop the queue; the error shows in the panel
        job.update(status="error", error=str(e).replace("\x1b", "")[-300:])


def worker():
    while True:
        download(work.get())


def probe_tags(path):
    """Read tags of a file you dropped into the folder yourself (ffprobe ships with ffmpeg)."""
    if not shutil.which("ffprobe"):
        return {}, 0.0
    r = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
                       capture_output=True, text=True, encoding="utf-8")
    fmt = json.loads(r.stdout or "{}").get("format", {})
    tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}
    return tags, float(fmt.get("duration") or 0)


def rescan():
    known = {t["file"] for t in db["tracks"].values()}
    added = 0
    for f in sorted(SONGS.iterdir()):
        if f.suffix.lower() not in AUDIO_EXT or f.name in known:
            continue
        tags, dur = probe_tags(f)
        tid = "local-" + uuid.uuid5(uuid.NAMESPACE_URL, f.name).hex[:12]
        cover = COVERS / f"{tid}.jpg"
        if HAS_FFMPEG:
            subprocess.run(["ffmpeg", "-v", "quiet", "-y", "-i", str(f), "-an", "-frames:v", "1", str(cover)])
        db["tracks"][tid] = {
            "id": tid, "title": tags.get("title") or f.stem, "artist": tags.get("artist") or "",
            "album": tags.get("album") or "", "year": (tags.get("date") or "")[:4], "duration": dur,
            "file": f.name, "cover": cover.name if cover.exists() else "", "source": "local",
            "added": time.time(), "liked": False, "plays": 0, "lastPlayed": 0,
        }
        added += 1
    # Files you moved away since last time drop out of the library list (the files are not touched).
    gone = [k for k, t in db["tracks"].items() if not (SONGS / t["file"]).exists()]
    for k in gone:
        del db["tracks"][k]
    save_db()
    return {"added": added, "removed": len(gone)}


def recycle(path):
    """Never hard-delete: send the file to the Windows Recycle Bin (elsewhere, to a .trash folder in the music folder)."""
    if not path.is_file():  # a library entry with an empty file name must never bin the whole music folder
        raise KeyError(path.name)
    if os.name != "nt":
        trash = MUSIC / ".trash"
        trash.mkdir(exist_ok=True)
        return shutil.move(str(path), str(trash / path.name))  # the songs folder may be on another drive
    ps = ("Add-Type -AssemblyName Microsoft.VisualBasic;"
          "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:OCM_PATH,'OnlyErrorDialogs','SendToRecycleBin')")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True, env={**os.environ, "OCM_PATH": str(path)})


MAX_BODY = 4 << 20  # JSON bodies are small (a playlist of ids); anything bigger is refused
LOOPBACK = {"127.0.0.1", "localhost", "::1"}
PRIVATE = ("/api/", "/media/", "/cover/", "/get/")  # your library and the app's controls; the page's own files are public


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    def end_headers(self):
        # App files must never be mixed old and new after an update: the browser re-checks them every load.
        if not self.path.startswith(("/media/", "/cover/", "/api/img", "/get/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass

    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not 0 <= n <= MAX_BODY:
            raise ValueError("request too large")
        data = json.loads(self.rfile.read(n) or b"{}")
        if not isinstance(data, dict):
            raise ValueError("expected a JSON object")
        return data

    def same_origin(self):
        # Blocks other websites from driving this local server from your browser.
        origin = self.headers.get("Origin")
        return origin in (None, f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}")

    def trusted(self):
        """Only this app's own page (or the app shells) may use the API: no other website, not even via DNS rebinding."""
        try:
            host = urlparse("//" + (self.headers.get("Host") or "")).hostname
        except ValueError:
            return False
        return (host in LOOPBACK and self.same_origin()
                and self.headers.get("Sec-Fetch-Site") in (None, "same-origin", "none"))

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.startswith(PRIVATE) and not self.trusted():
            return self.send_error(403)
        qs = parse_qs(u.query)
        arg = lambda k: qs.get(k, [""])[0].strip()
        try:
            if u.path == "/api/search":
                return self.send_json(search(arg("q"), search_count(qs.get("n", [None])[0])))
            if u.path == "/api/artist":
                return self.send_json(artist_page(check_id(arg("id"))))
            if u.path == "/api/album":
                return self.send_json(album_page(check_id(arg("id"))))
            if u.path == "/api/discover":
                region = (arg("region") or "GB").upper()
                if not re.match(r"^[A-Z]{2}$", region):
                    raise ValueError("region must be a 2-letter country code")
                return self.send_json(discover(region))
            if u.path == "/api/img":
                data, kind = proxied_image(arg("u"))
                self.send_response(200)
                self.send_header("Content-Type", kind)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=604800")
                self.end_headers()
                return self.wfile.write(data)
            if u.path == "/api/stream":
                if arg("prepare") and YT_ID.match(arg("id")):  # warm-up: resolve the link now so play starts at once
                    if cached_audio(arg("id")):
                        return self.send_json({"ok": True, "ready_in": 0, "cached": True})
                    src = resolve_stream(arg("id"))
                    if arg("keep"):  # the app asks only on Wi-Fi
                        try:
                            keep_queue.put_nowait(arg("id"))
                        except queue.Full:
                            pass  # busy: this song just stays a warm link
                    return self.send_json({"ok": True, "ready_in": round(ready_in(src), 1)})
                return self.stream(arg("id"))
            if u.path == "/api/suggest":
                return self.send_json({"suggestions": suggest(arg("q"))})
            if u.path == "/api/library":
                return self.send_json(db)
            if u.path == "/api/jobs":
                return self.send_json(sorted(jobs.values(), key=lambda j: j["id"]))
            if u.path.startswith("/api/app/"):
                return self.send_json(updates.get(u.path, qs, CACHE))
            if u.path == "/get/status":
                size = lambda n: (DIST / n).stat().st_size if (DIST / n).is_file() else None
                return self.send_json({"windows": size(SETUP), "android": size(APK), "share": share_info()})
            if u.path.startswith("/get/"):  # only files directly in dist/ (send_file refuses anything else)
                return self.send_file(DIST, unquote(u.path[len("/get/"):]))
            if u.path.startswith("/media/") or u.path.startswith("/cover/"):
                base = SONGS if u.path.startswith("/media/") else COVERS
                return self.send_file(base, unquote(u.path.split("/", 2)[2]))
        except ValueError as e:
            return self.send_json({"error": str(e)[-300:]}, 400)
        except Exception as e:
            return self.send_json({"error": str(e)[-300:]}, 500)
        return super().do_GET()

    def stream(self, vid):
        """Instant play: resolve the audio link with yt-dlp and pass the bytes through, with Range so seeking works."""
        if not YT_ID.match(vid):
            return self.send_json({"error": "bad video id"}, 400)
        hit = cached_audio(vid)
        if hit:
            if ".ahead." in hit.name:  # first play of a downloaded-ahead song: from now on it counts as played
                try:
                    hit = hit.rename(AUDIO_CACHE / hit.name.replace(".ahead.", ".", 1))
                except OSError:  # another request is reading it (Windows): rename on a later play
                    pass
            hit.touch()  # most recently played stays in the cache longest
            return self.send_file(AUDIO_CACHE, hit.name)
        rng = re.match(r"bytes=(\d+)-(\d*)", self.headers.get("Range") or "")
        start, want = (int(rng[1]), int(rng[2]) if rng[2] else None) if rng else (0, None)
        up = None
        for _ in range(2):  # a cached link can expire early: resolve once more, then give up
            src = resolve_stream(vid)
            up = open_range(src, start, start + CHUNK - 1 if want is None else min(want, start + CHUNK - 1))
            if up == 416:
                return self.send_error(416)
            if up:
                break
            memo_cache.pop(("stream", vid), None)
        if up is None:
            return self.send_json({"error": "YouTube refused the audio link"}, 502)
        total = total_size(up)
        end = total - 1 if want is None else min(want, total - 1)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", src["type"])
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
        self.end_headers()
        whole = start == 0 and end == total - 1
        part = AUDIO_CACHE / f"{vid}.{uuid.uuid4().hex[:6]}.part"  # the player may open two at once
        sink = open(part, "wb") if whole else None  # a full play from the start also fills the cache
        got = 0
        try:
            for chunk in read_ranges(src, up, start + CHUNK, end):
                self.wfile.write(chunk)
                if sink:
                    sink.write(chunk)
                got += len(chunk)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError):
            pass  # the player seeked away and dropped this request
        except OSError as e:  # YouTube dropped a later chunk: the player re-asks from where it stopped
            print(f"stream {vid} stopped at {start + got}: {e}", file=sys.stderr)
        finally:
            if sink:
                sink.close()
                if got == total:
                    part.replace(AUDIO_CACHE / f"{vid}.{src['ext']}")
                    trim_audio_cache()
                else:
                    part.unlink(missing_ok=True)  # only half arrived: a torn file must never be served

    def send_file(self, base, name):
        path = (base / name).resolve()
        if path.parent != base.resolve() or not path.is_file():  # no ../ escapes
            return self.send_error(404)
        size = path.stat().st_size
        start, end = 0, size - 1
        rng = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range") or "")
        if rng:  # seeking in <audio> needs byte ranges
            if rng[1]:
                start, end = int(rng[1]), int(rng[2] or end)
            elif rng[2]:
                start = max(0, size - int(rng[2]))
            end = min(end, size - 1)
            if start > end:
                return self.send_error(416)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(1 << 16, left))
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
                pass  # the player skipped ahead and dropped this request

    def do_POST(self):
        if not self.trusted():
            return self.send_error(403)
        u = urlparse(self.path)
        try:
            data = self.body()
            if u.path == "/get/share":
                return self.send_json(start_share())
            if u.path == "/api/download":
                ids = []
                for item in data.get("items", []):
                    if not isinstance(item, dict):
                        continue
                    vid, url = str(item.get("id") or ""), str(item.get("url") or "")[:2000]
                    if vid in db["tracks"] and not item.get("force"):
                        continue  # already in your library
                    if YT_ID.match(vid) and not url.startswith("http"):
                        url = f"https://www.youtube.com/watch?v={vid}"
                    if url.startswith(("http://", "https://")):
                        ids.append(add_job(url, str(item.get("title") or "")[:300]))
                return self.send_json({"jobs": ids})
            if u.path == "/api/jobs/clear":
                for k in [k for k, j in jobs.items() if j["status"] in ("done", "error")]:
                    del jobs[k]
                return self.send_json({"ok": True})
            if u.path.startswith("/api/app/"):
                return self.send_json(updates.post(u.path, data, CACHE))
            if u.path == "/api/fix-info":
                return self.send_json(fix_info(data.get("ids")))
            if u.path == "/api/rescan":
                with lock:
                    return self.send_json(rescan())
            if u.path == "/api/track":
                with lock:
                    t = db["tracks"][data["id"]]
                    if "liked" in data:
                        t["liked"] = bool(data["liked"])
                    if data.get("played"):
                        t["plays"] += 1
                        t["lastPlayed"] = time.time()
                    for k in ("title", "artist", "album"):
                        if isinstance(data.get(k), str):
                            t[k] = data[k].strip()[:200]
                    save_db()
                return self.send_json(t)
            if u.path == "/api/track/remove":
                with lock:
                    t = db["tracks"].pop(data["id"])
                    for p in db["playlists"]:
                        p["tracks"] = [x for x in p["tracks"] if x != t["id"]]
                    save_db()
                recycle(SONGS / t["file"])
                return self.send_json({"ok": True})
            if u.path == "/api/playlists":
                with lock:
                    pid = data.get("id")
                    p = next((p for p in db["playlists"] if p["id"] == pid), None)
                    if data.get("delete") and p:
                        db["playlists"].remove(p)
                    elif p:
                        p["name"] = str(data.get("name", p["name"]))[:100]
                        if isinstance(data.get("tracks"), list):
                            p["tracks"] = [x for x in data["tracks"] if x in db["tracks"]]
                    else:
                        p = {"id": uuid.uuid4().hex[:8], "name": str(data.get("name") or "New playlist")[:100],
                             "tracks": [x for x in data.get("tracks", []) if x in db["tracks"]], "created": time.time()}
                        db["playlists"].append(p)
                    save_db()
                return self.send_json(db["playlists"])
        except KeyError:
            return self.send_json({"error": "not found"}, 404)
        except ValueError as e:
            return self.send_json({"error": str(e)[-300:]}, 400)
        except Exception as e:
            return self.send_json({"error": str(e)[-300:]}, 500)
        self.send_error(404)


# ---------- "Send to my phone": a short-lived LAN share of the APK ----------
share = {}  # the live share: token, until, url, srv
share_lock = threading.Lock()
SHARE_SECONDS = 15 * 60


class ShareHandler(BaseHTTPRequestHandler):
    """The LAN side: answers only the share's secret APK URL; everything else is 404."""
    send_file = Handler.send_file

    def log_message(self, *a):
        pass

    def do_GET(self):
        if share_ok(self.path):
            return self.send_file(DIST, APK)
        self.send_error(404)


def share_ok(path):
    s = share
    return bool(s) and time.time() < s["until"] and secrets.compare_digest(path.encode(), f"/{s['token']}/{APK}".encode())


def share_info():
    return {"url": share["url"], "until": share["until"]} if share and time.time() < share["until"] else None


def lan_ip():
    # shortcut: picks the adapter of the default route; with a VPN up that may not be the home Wi-Fi one
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))  # sends nothing, just asks Windows which local address would be used
        except OSError:
            raise ValueError("This PC isn't on a network, so your phone can't reach it")
        return s.getsockname()[0]


def stop_share(srv):
    srv.shutdown()
    srv.server_close()


def start_share():
    """Serve only the APK on 0.0.0.0 at a random-token URL for 15 minutes (reuses a live share)."""
    with share_lock:
        if share_info():
            return share_info()
        if not (DIST / APK).is_file():
            raise ValueError("The Android app isn't built yet")
        ip = lan_ip()
        srv = ThreadingHTTPServer(("0.0.0.0", 0), ShareHandler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        token = secrets.token_urlsafe(16)
        share.clear()
        share.update(token=token, until=time.time() + SHARE_SECONDS, srv=srv, url=f"http://{ip}:{srv.server_port}/{token}/{APK}")
        timer = threading.Timer(SHARE_SECONDS, stop_share, [srv])
        timer.daemon = True
        timer.start()
        return share_info()


if __name__ == "__main__":
    for _ in range(2):  # two songs at a time is fast and stays polite to YouTube
        threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=keeper, daemon=True).start()
    print(f"OddlyClever Music on http://127.0.0.1:{PORT}  (songs in {SONGS})")
    ThreadingHTTPServer((os.environ.get("OCM_HOST", "127.0.0.1"), PORT), Handler).serve_forever()
