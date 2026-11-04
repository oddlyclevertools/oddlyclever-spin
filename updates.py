"""App and engine updates, plus the facts behind "Copy diagnostics" and the licence notices.

App: the latest GitHub release is checked at most once a day; the page offers its installer (Windows) or APK (Android).
Engine: YouTube breaks yt-dlp every few weeks. On Android yt-dlp and yt-dlp-ejs are pure Python, so newer wheels come
straight from PyPI, are checked against PyPI's sha256, unpacked into app storage and put ahead of the bundled copy on
sys.path. A version that fails a quick self-test (import, version, YoutubeDL) is rolled back on the spot. Windows uses pip.
server.py routes GET/POST /api/app/* here.
"""
import hashlib
import importlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

REPO = "oddlyclevertools/oddlyclever-spin"  # the public repo: change it here if it moves
_VERSION_FILE = Path(__file__).with_name("VERSION")  # dev runs; both apps pass OCM_APP_VERSION from their build
APP_VERSION = os.environ.get("OCM_APP_VERSION") or (_VERSION_FILE.read_text().strip() if _VERSION_FILE.is_file() else "0.0.0")
PLATFORM = os.environ.get("OCM_PLATFORM") or ("windows" if os.name == "nt" else sys.platform)
# OCM_RELEASES / OCM_PYPI point at a local fake index in tests (the Android test build reads them from test-env.json).
RELEASES = os.environ.get("OCM_RELEASES") or f"https://api.github.com/repos/{REPO}/releases/latest"
PYPI = os.environ.get("OCM_PYPI") or "https://pypi.org/pypi"
ISSUES = f"https://github.com/{REPO}/issues/new"
DAY = 24 * 3600
HERE = Path(__file__).resolve().parent
ENGINE_MODS = ("yt_dlp", "yt_dlp_ejs")

engine_dir = None  # Android: <app files>/engine, set by load_engine()
engine_lock = threading.Lock()
apk_job = {}  # the APK download: state, got, total, error


def version_tuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v or "")))


def newer(a, b):
    return version_tuple(a) > version_tuple(b)


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": f"OddlyCleverSpin/{APP_VERSION}", "Accept": "application/json"})
    return urllib.request.urlopen(req, timeout=timeout)


def get_json(url):
    with fetch(url) as r:
        return json.loads(r.read())


def safe_url(url, override):
    if not url.startswith("https://") and not os.environ.get(override):  # plain http only for a local test index
        raise ValueError("refusing a non-https download")
    return url


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text("utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path, data):
    tmp = Path(path).with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1), "utf-8")
    tmp.replace(path)


# ---------- engine ----------
def loaded_versions():
    out = {}
    try:
        out["yt-dlp"] = importlib.import_module("yt_dlp.version").__version__
    except Exception:
        out["yt-dlp"] = ""
    try:
        out["yt-dlp-ejs"] = importlib.import_module("yt_dlp_ejs").version
    except Exception:
        out["yt-dlp-ejs"] = ""
    return out


def state_file():
    return engine_dir / "state.json"


def engine_state():
    return read_json(state_file(), {}) if engine_dir else {}


def drop_engine_modules():
    """Forget the loaded engine so the next import reads it from disk. Returns what restore_engine_modules() needs."""
    gone = {k: m for k, m in sys.modules.items() if k.split(".")[0] in ENGINE_MODS}
    for k in gone:
        del sys.modules[k]
    importlib.invalidate_caches()
    # yt-dlp wraps urllib3's _PERCENT_RE when it is imported; unwrap it, or a re-import wraps the wrapper and breaks requests
    url = sys.modules.get("urllib3.util.url")
    pr = getattr(url, "_PERCENT_RE", None)
    if type(pr).__name__ == "Urllib3PercentREOverride":
        url._PERCENT_RE = pr.re
    return gone, pr


def restore_engine_modules(saved):
    gone, pr = saved
    drop_engine_modules()
    if pr is not None and "urllib3.util.url" in sys.modules:
        sys.modules["urllib3.util.url"]._PERCENT_RE = pr
    sys.modules.update(gone)


def self_test(want, where):
    """Import the engine from `where` and prove it is the version we unpacked and can build a downloader."""
    yt_dlp = importlib.import_module("yt_dlp")
    from yt_dlp.version import __version__
    if __version__ != want["yt-dlp"] or not Path(yt_dlp.__file__).resolve().is_relative_to(where):
        raise RuntimeError(f"expected yt-dlp {want['yt-dlp']} from {where.name}, got {__version__}")
    importlib.import_module("yt_dlp.extractor.youtube")
    yt_dlp.YoutubeDL({"quiet": True}).close()
    if want.get("yt-dlp-ejs") and importlib.import_module("yt_dlp_ejs").version != want["yt-dlp-ejs"]:
        raise RuntimeError("yt-dlp-ejs version mismatch")
    return yt_dlp


def try_engine(name, want):
    """Put engine/<name> first on sys.path and self-test it; on any failure the previous modules come back untouched."""
    where = (engine_dir / name).resolve()
    old = drop_engine_modules()
    sys.path.insert(0, str(where))
    try:
        return self_test(want, where)
    except Exception:
        sys.path.remove(str(where))
        restore_engine_modules(old)
        raise


def load_engine(dir_):
    """Android start-up, before server.py imports yt_dlp: use the newest engine that passes its self-test."""
    global engine_dir
    engine_dir = Path(dir_)
    engine_dir.mkdir(parents=True, exist_ok=True)
    st = engine_state()
    if st.get("trial") == "starting":  # the last start with this version died inside its self-test
        st = roll_back(st, "it stopped the app starting")
    while st.get("dir"):
        if st.get("trial"):
            st["trial"] = "starting"
            write_json(state_file(), st)
        try:
            try_engine(st["dir"], st["versions"])
            st["trial"] = False
            break
        except Exception as e:
            st = roll_back(st, str(e)[-120:])
    write_json(state_file(), st)


def roll_back(st, why):
    bad = st.get("versions", {}).get("yt-dlp")
    prev = st.get("prev") or {}
    note = f"Engine {bad} didn't pass its check ({why}), so I went back to {prev.get('versions', {}).get('yt-dlp') or 'the built-in one'}."
    return {**st, "dir": prev.get("dir"), "versions": prev.get("versions", {}), "prev": None, "trial": False,
            "bad": sorted({*st.get("bad", []), bad} - {None}), "note": note}


def wheel_of(meta):
    return next(u for u in meta["urls"] if u["packagetype"] == "bdist_wheel" and u["filename"].endswith("-py3-none-any.whl"))


def unpack_wheel(meta, into):
    """Download a wheel, check PyPI's sha256, unpack it. Raises on any mismatch."""
    w = wheel_of(meta)
    with fetch(safe_url(w["url"], "OCM_PYPI"), timeout=60) as r:
        data = r.read()
    if hashlib.sha256(data).hexdigest() != w["digests"]["sha256"]:
        raise ValueError(f"{w['filename']} failed its sha256 check")
    tmp = into.with_suffix(".whl")
    tmp.write_bytes(data)
    with zipfile.ZipFile(tmp) as z:
        z.extractall(into)  # extractall drops absolute and ../ member paths
    tmp.unlink()


def ejs_pin(meta):
    """yt-dlp pins the yt-dlp-ejs it needs in its "default" extra."""
    for r in meta["info"].get("requires_dist") or []:
        m = re.match(r"yt-dlp-ejs\s*==\s*([\w.]+)", r)
        if m:
            return m[1]
    return ""


def update_engine_android(force):
    st = engine_state()
    if not force and time.time() - st.get("checked", 0) < DAY:
        return {"status": "skipped"}
    st["checked"] = time.time()
    write_json(state_file(), st)
    meta = get_json(f"{PYPI}/yt-dlp/json")
    ver, have = meta["info"]["version"], loaded_versions()
    if not newer(ver, have["yt-dlp"]):
        return {"status": "current", "version": have["yt-dlp"]}
    if ver in st.get("bad", []):
        return {"status": "bad", "version": ver}
    want = {"yt-dlp": ver}
    name = f"yt-dlp-{ver}"
    part = engine_dir / (name + ".part")
    shutil.rmtree(part, ignore_errors=True)  # a half-unpacked earlier try
    part.mkdir()
    unpack_wheel(meta, part)
    pin = ejs_pin(meta)
    if pin and pin != have["yt-dlp-ejs"]:
        unpack_wheel(get_json(f"{PYPI}/yt-dlp-ejs/{pin}/json"), part)
        want["yt-dlp-ejs"] = pin
    if f"__version__ = '{ver}'" not in (part / "yt_dlp" / "version.py").read_text("utf-8"):
        raise ValueError("the downloaded engine has the wrong version inside")
    shutil.rmtree(engine_dir / name, ignore_errors=True)
    part.rename(engine_dir / name)
    try:
        swap_into_server(try_engine(name, want))
    except Exception as e:
        st = roll_back({**st, "dir": name, "versions": want, "prev": {"dir": st.get("dir"), "versions": st.get("versions", {})}}, str(e)[-120:])
        write_json(state_file(), st)
        return {"status": "rolled-back", "version": ver, "note": st["note"]}
    st.update(prev={"dir": st.get("dir"), "versions": st.get("versions", {})}, dir=name, versions=want, trial=False,
              note=f"Engine updated to {ver}.", updated=time.time())
    write_json(state_file(), st)
    keep = {name, (st["prev"] or {}).get("dir")}
    for old in engine_dir.iterdir():  # unpacked engines we no longer point at (app-internal files, not songs)
        if old.is_dir() and old.name not in keep:
            shutil.rmtree(old, ignore_errors=True)
    return {"status": "updated", "version": ver}


def swap_into_server(yt_dlp):
    """Hand the running server the new engine so it is live now, not only after a restart."""
    main = sys.modules.get("__main__")
    if main is None or not hasattr(main, "yt_dlp"):
        return
    main.yt_dlp = yt_dlp
    try:  # server.py turns on the parsed-player cache at start; the new modules need it too
        from yt_dlp.extractor.youtube.jsc._builtin.ejs import EJSBaseJCP
        EJSBaseJCP._ENABLE_PREPROCESSED_PLAYER_CACHE = True
    except ImportError:
        pass
    # shortcut: reaches into server.py's warm YoutubeDL slots; a slot in use right now keeps the old engine until restart
    for slot in list(getattr(getattr(main, "resolve_slots", None), "queue", [])):
        slot.clear()


def update_engine_pip():
    """Windows and the dev setup: pip upgrades yt-dlp in place, then the server reloads it."""
    r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check", "-U", "--only-binary=:all:", "yt-dlp[default]"],
                       capture_output=True, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if r.returncode:
        raise RuntimeError((r.stdout + r.stderr).strip()[-300:] or "pip failed")
    before = loaded_versions()["yt-dlp"]
    old = drop_engine_modules()
    try:
        swap_into_server(importlib.import_module("yt_dlp"))
    except Exception:
        restore_engine_modules(old)
        raise
    now = loaded_versions()["yt-dlp"]
    return {"status": "updated" if now != before else "current", "version": now}


def update_engine(force=False):
    with engine_lock:
        try:
            if engine_dir:
                return update_engine_android(force)
            return update_engine_pip()
        except Exception as e:
            note(f"engine update: {e}")
            raise


def auto_engine(delay=20):
    """Android: once a day, a little after start-up, look for a newer engine."""
    def run():
        time.sleep(delay)
        try:
            update_engine()
        except Exception:
            pass  # noted for diagnostics; the next start tries again
    threading.Thread(target=run, daemon=True).start()


# ---------- app ----------
def pick_asset(assets):
    if PLATFORM == "android":
        apks = [a for a in assets if a["name"].lower().endswith(".apk")]
        uni = os.environ.get("OCM_ABI", "arm64-v8a") != "arm64-v8a"  # emulators and older phones take the universal APK
        apks.sort(key=lambda a: ("universal" in a["name"].lower()) != uni)
        return apks[0] if apks else None
    return next((a for a in assets if a["name"].lower().endswith(".exe") and "setup" in a["name"].lower()), None)  # OddlyCleverSpin-Setup-<v>.exe


def check_app(cache, force=False):
    f = Path(cache) / "app-update.json"
    saved = read_json(f, {})
    if force or time.time() - saved.get("checked", 0) > DAY:
        try:
            rel = get_json(RELEASES)
            saved = {"checked": time.time(), "tag": rel.get("tag_name", ""), "notes": (rel.get("body") or "")[:4000],
                     "page": rel.get("html_url", ""), "assets": [{k: a.get(k) for k in ("name", "size", "browser_download_url", "digest")} for a in rel.get("assets", [])]}
        except Exception as e:
            note(f"update check: {e}")
            saved = {**saved, "checked": time.time(), "error": str(e)[-200:]}
        write_json(f, saved)
    asset = pick_asset(saved.get("assets") or [])
    latest = saved.get("tag", "").lstrip("v")
    return {"current": APP_VERSION, "latest": latest, "newer": bool(asset) and newer(latest, APP_VERSION),
            "notes": saved.get("notes", ""), "page": saved.get("page", ""), "checked": saved.get("checked", 0),
            "asset": asset and {"name": asset["name"], "size": asset["size"], "url": asset["browser_download_url"], "digest": asset.get("digest") or ""},
            "check_error": saved.get("error", ""), "download": dict(apk_job)}


def apk_path(cache):
    return Path(cache) / "update" / "update.apk"  # MainActivity.installUpdate() opens exactly this file


def download_apk(cache):
    """Android: fetch the release APK in the background; the page polls check_app() for progress."""
    rel = check_app(cache)
    if not rel["newer"]:
        raise ValueError("No newer version to get")
    if apk_job.get("state") == "downloading":
        return rel
    a, dest = rel["asset"], apk_path(cache)

    def run():
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            part = dest.with_suffix(".part")
            sha = hashlib.sha256()
            with fetch(safe_url(a["url"], "OCM_RELEASES"), timeout=60) as r, open(part, "wb") as out:
                while chunk := r.read(1 << 16):
                    out.write(chunk)
                    sha.update(chunk)
                    apk_job["got"] += len(chunk)
            if part.stat().st_size != a["size"]:
                raise ValueError("the download was cut short")
            if a["digest"].startswith("sha256:") and a["digest"][7:].lower() != sha.hexdigest():  # GitHub's own asset hash
                raise ValueError("the download didn't match its checksum")
            part.replace(dest)
            apk_job.update(state="ready", version=rel["latest"])
        except Exception as e:
            note(f"app download: {e}")
            apk_job.update(state="error", error=str(e)[-200:])
    apk_job.clear()
    apk_job.update(state="downloading", got=0, total=a["size"], error="")
    threading.Thread(target=run, daemon=True).start()
    return check_app(cache)


# ---------- diagnostics ----------
errors = []  # the last few update errors, for "Copy diagnostics"


def note(msg):
    errors.append(f"{time.strftime('%Y-%m-%d %H:%M')} {msg}"[:300])
    del errors[:-10]


def info():
    st = engine_state()
    return {"version": APP_VERSION, "platform": PLATFORM, "os": os.environ.get("OCM_OS") or sys.platform,
            "python": sys.version.split()[0], "engine": loaded_versions(),
            "engine_source": "updated" if st.get("dir") else ("pip" if not engine_dir else "built-in"),
            "engine_note": st.get("note", ""), "engine_checked": st.get("checked", 0), "js": os.environ.get("OCM_JS", "").partition(":")[0],
            "songs_public": bool(os.environ.get("OCM_SONGS")), "songs_where": os.environ.get("OCM_SONGS_LABEL", ""),
            "issues": ISSUES, "repo": f"https://github.com/{REPO}", "errors": errors[-10:]}


def licences():
    f = next((p for p in (HERE / "THIRD_PARTY_NOTICES.md", HERE / "THIRD_PARTY_NOTICES.txt", HERE / "THIRD_PARTY_NOTICES") if p.is_file()), None)
    return {"text": f.read_text("utf-8") if f else ""}


# ---------- routes (server.py: GET/POST /api/app/...) ----------
def get(path, qs, cache):
    if path == "/api/app/info":
        return info()
    if path == "/api/app/update":
        return check_app(cache, force=qs.get("force", [""])[0] == "1")
    if path == "/api/app/licences":
        return licences()
    raise ValueError("unknown app route")


def post(path, data, cache):
    if path == "/api/app/engine":
        return {**update_engine(force=True), "info": info()}
    if path == "/api/app/update/download":
        if PLATFORM != "android":
            raise ValueError("Only the Android app installs updates itself")
        return download_apk(cache)
    raise ValueError("unknown app route")
