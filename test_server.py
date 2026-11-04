"""Quick self-check: python test_server.py (no network needed)."""
import json, os, tempfile
from pathlib import Path
os.environ["OCM_DIR"] = tempfile.mkdtemp()
import server

assert server.clean_title("Daft Punk - Get Lucky (Official Video) [HD]", "Daft Punk") == "Get Lucky"
assert server.clean_title("Song (Lyrics)", "") == "Song"
assert server.clean_title("Remix (Live)", "x") == "Remix (Live)"  # real info stays
assert server.clean_channel("Daft Punk - Topic") == "Daft Punk"
server.db["tracks"]["a"] = {"id": "a", "file": "gone.m4a"}
assert server.rescan() == {"added": 0, "removed": 1}  # moved-away files leave the list
assert [server.search_count(x) for x in ("6", "0", "99", "x", None)] == [6, 1, 30, 20, 20]
assert server.parse_suggest('["lofi", ["lofi beats", 3, "lofi girl"]]') == ["lofi beats", "lofi girl"]
assert server.suggest("a") == []  # too short: no network call

# catalogue helpers, against a trimmed real ytmusicapi capture
art = "https://yt3.googleusercontent.com/abc=w60-h60-l90-rj"
assert server.resize_cover(art, 1200) == "https://yt3.googleusercontent.com/abc=w1200-h1200-l90-rj"
assert server.resize_cover("https://lh3.googleusercontent.com/x=w1080-h450-p-l90-rj", 1920, 800).endswith("=w1920-h800-p-l90-rj")
video = "https://i.ytimg.com/vi/abc/hqdefault.jpg?sqp=1"
assert server.resize_cover(video, 1200) == video  # video frames have no size suffix
assert [server.seconds_of(x) for x in ({"duration_seconds": 161}, {"duration": "2:41"}, {"length": "1:02:03"}, {"duration": None}, {})] == [161, 161, 3723, 0, 0]
assert server.album_ref("Discovery") == {"name": "Discovery", "id": None} and server.album_ref(None) is None
assert server.video_id("https://www.youtube.com/watch?v=Pk9vPMurHVo&t=3") == "Pk9vPMurHVo" and server.video_id("https://example.com/") is None
assert server.safe_name("50% off") == "50%% off"
for ok, bad in (("UCRr1xG_2WIDs18a6cIiCxeA", "../etc"), ("MPREb_K8qWMWVqXGi", "a b")):
    assert server.check_id(ok) == ok
    try:
        server.check_id(bad)
        raise AssertionError("bad id accepted")
    except ValueError:
        pass

fx = json.loads((Path(__file__).parent / "fixtures" / "ytm_sample.json").read_text("utf-8"))
song = server.song_shape(fx["search_song"])
assert song["id"] == fx["search_song"]["videoId"] and song["artist"] == song["artists"][0]["name"]
assert song["album"]["id"].startswith("MPREb_") and song["have"] is False
assert "w544-h544" in song["cover"] and "w1200-h1200" in song["cover_hd"]
assert server.song_shape(fx["search_top_song"])["album"] is None  # the mixed list leaves the album out
vid = server.song_shape(fx["search_video"])
assert vid["cover"] == vid["cover_hd"] and "ytimg" in vid["cover"]
alb = server.album_shape(fx["search_album"])
assert alb["id"].startswith("MPREb_") and alb["type"] == "Album" and alb["year"].isdigit() and alb["artist_id"]
single = server.album_shape(fx["artist_single"], {"name": "Daft Punk", "id": "UCx"}, "Single")
assert single["type"] == "Single" and single["artist"] == "Daft Punk"  # artist-page rows carry no artist of their own
assert server.album_shape(fx["artist_album"], {"name": "Daft Punk", "id": "UCx"})["artist_id"] == "UCx"
for key in ("search_top_artist", "chart_artist"):  # three different places an artist can hide its name and id
    who = server.artist_shape(fx[key])
    assert who["id"] and who["name"] and "w544-h544" in who["photo"] and "w1200-h1200" in who["photo_hd"]
assert server.top_shape(fx["search_top_artist"])["kind"] == "artist"
assert server.top_shape(fx["search_top_song"])["kind"] == "song" and server.top_shape({"resultType": "playlist"}) is None
# album tracks come without thumbnails: the album cover is passed in and the track number kept
cover = server.pick_thumb(fx["album"]["thumbnails"])
track = server.song_shape(fx["album"]["tracks"][0], album={"name": "RAM", "id": "MPREb_x"}, cover=cover)
assert track["track_no"] == 1 and "w1200-h1200" in track["cover_hd"] and track["album"]["name"] == "RAM"
server.db["tracks"][song["id"]] = {}
assert server.mark_have([song])[0]["have"] is True
cat = server.catalogue_fields({**song, "track_no": 3})
assert cat["album_id"] == song["album"]["id"] and cat["artist_id"] == song["artists"][0]["id"] and cat["track_no"] == 3

# bad input never reaches the network
for bad in ("short", "has space!!", "x" * 12):
    assert not server.YT_ID.match(bad)
assert server.song_query("NO SNITCHING - Vin WRLD & Harshit Rao | Aarush Bhola, Laila | Anshul Garg") == "NO SNITCHING - Vin WRLD & Harshit Rao"
q = "WARNING - Addi Kalyan"
assert server.same_song({"title": "Warning (feat. X)", "duration_seconds": 200}, q, 203)
assert not server.same_song({"title": "Warning", "duration_seconds": 260}, q, 203)  # a different cut
assert not server.same_song({"title": "Danger", "duration_seconds": 203}, q, 203)

# Get the app: /get/ serves only files in dist/, the LAN share only its secret APK URL
import http.client, threading
server.DIST = Path(tempfile.mkdtemp())
(server.DIST / server.APK).write_bytes(b"apk")
app = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
threading.Thread(target=app.serve_forever, daemon=True).start()


def get(path, port=app.server_port):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request("GET", path)
    r = c.getresponse()
    return r.status, r.read()


assert get("/get/OddlyCleverMusic.apk") == (200, b"apk")
for bad in ("/get/../server.py", "/get/..%5Cserver.py", "/get/%2E%2E/server.py", "/get/", "/get/C:/Windows/win.ini"):
    assert get(bad)[0] == 404, bad
status = json.loads(get("/get/status")[1])
assert status == {"windows": None, "android": 3, "share": None}
server.lan_ip = lambda: "127.0.0.1"  # no network needed
link = server.start_share()
assert server.start_share() == link  # one share at a time
port, token = int(link["url"].split(":")[2].split("/")[0]), server.share["token"]
assert get(f"/{token}/OddlyCleverMusic.apk", port) == (200, b"apk")
for bad in (f"/{token}x/OddlyCleverMusic.apk", f"/{token}/../server.py", "/", "/api/library", "/get/OddlyCleverMusic.apk"):
    assert get(bad, port)[0] == 404, bad
server.share["until"] = 0  # expired
assert get(f"/{token}/OddlyCleverMusic.apk", port)[0] == 404 and server.share_info() is None
server.stop_share(server.share["srv"])
# only the app's own page may use the API: other websites, DNS rebinding, odd or oversized bodies are refused


def req(method, path, headers=None, body=None):
    c = http.client.HTTPConnection("127.0.0.1", app.server_port, timeout=5)
    c.request(method, path, body=body, headers=headers or {})
    r = c.getresponse()
    return r.status, r.read()


assert req("GET", "/api/library", {"Host": "evil.example:8790"})[0] == 403  # DNS rebinding
assert req("GET", "/media/x.m4a", {"Host": "evil.example"})[0] == 403
for site, code in (("cross-site", 403), ("same-site", 403), ("same-origin", 200), ("none", 200)):
    assert req("GET", "/api/library", {"Sec-Fetch-Site": site})[0] == code, site
assert req("GET", "/index.html", {"Sec-Fetch-Site": "cross-site"})[0] == 200  # the page itself is public
assert req("POST", "/api/jobs/clear", {"Origin": "https://evil.example"}, b"{}")[0] == 403
assert req("POST", "/api/jobs/clear", {"Content-Length": str(server.MAX_BODY + 1)})[0] == 400
assert req("POST", "/api/jobs/clear", body=b"[1]")[0] == 400
assert req("POST", "/api/download", body=json.dumps({"items": ["x", {"id": ["a"]}, {"url": 5}]}).encode()) == (200, b'{"jobs": []}')
apk = "/get/OddlyCleverMusic.apk"
assert req("GET", apk, {"Range": "bytes=5-"})[0] == 416
assert req("GET", apk, {"Range": "bytes=-2"}) == (206, b"pk") and req("GET", apk, {"Range": "bytes=-99"}) == (206, b"apk")
try:
    server.recycle(server.MUSIC)
    raise AssertionError("recycled a folder")
except KeyError:
    pass
import urllib.request
for bad in ("https://i.ytimg.com.evil.com/x", "https://evil.com/i.ytimg.com/", "http://i.ytimg.com/x", "https://x.ytimg.com@evil.com/"):
    assert not server.IMG_HOST.match(bad), bad
try:
    server.ImgRedirects().redirect_request(urllib.request.Request("https://i.ytimg.com/a"), None, 302, "Found", {}, "http://192.168.1.1/")
    raise AssertionError("followed a redirect off the allow-list")
except ValueError:
    pass
# stream cache: oldest song goes first, .part files are never served or trimmed
import time as _t
server.AUDIO_CACHE_MAX = 10
for i, name in enumerate(["aaaaaaaaaaa.m4a", "bbbbbbbbbbb.m4a"]):
    f = server.AUDIO_CACHE / name
    f.write_bytes(b"x" * 8)
    os.utime(f, (_t.time() - 100 + i, _t.time() - 100 + i))
(server.AUDIO_CACHE / "ccccccccccc.123.part").write_bytes(b"x" * 8)
server.trim_audio_cache()
assert not (server.AUDIO_CACHE / "aaaaaaaaaaa.m4a").exists() and server.cached_audio("bbbbbbbbbbb")
assert server.cached_audio("ccccccccccc") is None
# saved stream links come back after a restart
server.memo_cache[("stream", "ddddddddddd")] = (_t.time(), {"url": "u", "ready": 0})
server.save_links(); server.memo_cache.clear(); server.load_links()
assert server.memo_cache[("stream", "ddddddddddd")][1]["url"] == "u"
# yt-dlp keeps its cache in our folder, with the parsed-player cache on; only the newest two players stay
assert server.BASE_OPTS["cachedir"] == str(server.CACHE / "yt-dlp") and server.EJSBaseJCP._ENABLE_PREPROCESSED_PLAYER_CACHE
solver = server.CACHE / "yt-dlp" / "challenge-solver"
solver.mkdir(parents=True)
for i, name in enumerate(["player,old.json", "player,mid.json", "player,new.json", "lib.json"]):
    (solver / name).write_text("{}")
    os.utime(solver / name, (_t.time() - 100 + i, _t.time() - 100 + i))
server.trim_player_cache()
assert sorted(f.name for f in solver.iterdir()) == ["lib.json", "player,mid.json", "player,new.json"]
# lookups try visionos first, fall back to the web client, and reuse one YoutubeDL per client per slot
made = []
class FakeYDL:
    def __init__(self, opts):
        self.client = opts.get("extractor_args", {}).get("youtube", {}).get("player_client", ["web"])[0]
        made.append(self.client)
    def extract_info(self, url, download):
        if "eeeeeeeeeee" in url:
            raise ValueError("gone")
        if "hhhhhhhhhhh" in url and self.client == "visionos":
            raise server.yt_dlp.utils.DownloadError("visionos refused")
        return {"url": f"https://{self.client}/?expire=1", "ext": "m4a"}
real, server.yt_dlp.YoutubeDL = server.yt_dlp.YoutubeDL, FakeYDL
for vid in ("eeeeeeeeeee", "fffffffffff", "ggggggggggg", "hhhhhhhhhhh"):
    try:
        server.resolve_stream(vid)
    except ValueError:
        pass
server.yt_dlp.YoutubeDL = real
assert made == ["visionos", "web"], made
assert server.memo_cache[("stream", "ggggggggggg")][1]["url"].startswith("https://visionos/")
assert server.memo_cache[("stream", "hhhhhhhhhhh")][1]["url"].startswith("https://web/")
assert server.LOOKUPS[0][1]["js_runtimes"] == {}  # visionos needs no JS puzzle: no QuickJS on the phone

# streaming asks YouTube only for closed ranges (an open-ended one is throttled), stitches them, and fills the cache
from http.server import BaseHTTPRequestHandler
song, asked = bytes(range(25)), []
class FakeYouTube(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        first, last = self.headers["Range"].split("=")[1].split("-")
        asked.append((int(first), last))
        if not last:
            return self.send_error(400)  # open-ended: what we must never send
        first, last = int(first), min(int(last), len(song) - 1)
        if first >= len(song):
            return self.send_error(416)
        self.send_response(206)
        self.send_header("Content-Range", f"bytes {first}-{last}/{len(song)}")
        self.send_header("Content-Length", str(last - first + 1))
        self.end_headers()
        self.wfile.write(song[first:last + 1])
yt = server.ThreadingHTTPServer(("127.0.0.1", 0), FakeYouTube)
threading.Thread(target=yt.serve_forever, daemon=True).start()
server.CHUNK, server.AUDIO_CACHE_MAX = 10, 800 * 2**20
for vid in ("iiiiiiiiiii", "jjjjjjjjjjj"):
    server.memo_cache[("stream", vid)] = (_t.time(), {"url": f"http://127.0.0.1:{yt.server_port}/a", "headers": {}, "type": "audio/mp4", "ext": "m4a", "ready": 0})


def ranged(path, rng):
    c = http.client.HTTPConnection("127.0.0.1", app.server_port, timeout=5)
    c.request("GET", path, headers={"Range": rng})
    r = c.getresponse()
    return r.status, r.getheader("Content-Range"), r.read()


assert ranged("/api/stream?id=iiiiiiiiiii", "bytes=12-15") == (206, "bytes 12-15/25", song[12:16])  # a seek
assert not server.cached_audio("iiiiiiiiiii")  # part of a song never lands in the cache
assert ranged("/api/stream?id=iiiiiiiiiii", "bytes=0-") == (206, "bytes 0-24/25", song)
for _ in range(50):  # the cache file is renamed just after the last byte goes out
    if server.cached_audio("iiiiiiiiiii"):
        break
    _t.sleep(0.02)
assert server.cached_audio("iiiiiiiiiii").read_bytes() == song  # a full play fills the cache
server.keep_song("jjjjjjjjjjj")  # download-ahead lands marked as not played yet
assert server.cached_audio("jjjjjjjjjjj").name == "jjjjjjjjjjj.ahead.m4a" and server.cached_audio("jjjjjjjjjjj").read_bytes() == song
assert get("/api/stream?id=jjjjjjjjjjj") == (200, song)
assert server.cached_audio("jjjjjjjjjjj").name == "jjjjjjjjjjj.m4a"  # its first play makes it a played song
# the cap drops unplayed downloads-ahead before songs you played, and drops them after a week regardless
for f in server.AUDIO_CACHE.iterdir():
    f.unlink()
for name, age in (("kkkkkkkkkkk.m4a", 500), ("lllllllllll.ahead.m4a", 10), ("mmmmmmmmmmm.ahead.m4a", 8 * 86400)):
    (server.AUDIO_CACHE / name).write_bytes(b"x" * 10)
    os.utime(server.AUDIO_CACHE / name, (_t.time() - age, _t.time() - age))
server.AUDIO_CACHE_MAX = 25
server.trim_audio_cache()
assert sorted(f.name for f in server.AUDIO_CACHE.iterdir()) == ["kkkkkkkkkkk.m4a", "lllllllllll.ahead.m4a"]  # stale one gone
server.AUDIO_CACHE_MAX = 15
server.trim_audio_cache()
assert [f.name for f in server.AUDIO_CACHE.iterdir()] == ["kkkkkkkkkkk.m4a"]  # over the cap: the unplayed one goes first
assert all(last for _, last in asked) and (20, "24") in asked, asked  # closed ranges only, the last one clipped
yt.shutdown()
print("ok")
