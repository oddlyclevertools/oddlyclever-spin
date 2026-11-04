// OddlyClever Music — the player and library UI. Talks to server.py (same origin unless OCM_API_BASE is set).
// Looks and motion live in themes.css / app.css / fx.js; this file only calls window.FX defensively.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const H = document.documentElement;
const audio = $('#audio');
const BASE = window.OCM_API_BASE || '';
const fx = (n, ...a) => window.FX?.[n]?.(...a);
function vt(fn, o) {
  if (!window.FX?.viewTransition) return (fn(), Promise.resolve());
  let done = false;
  const once = () => { if (!done) { done = true; return fn(); } };
  setTimeout(once, 400); // a transition that never gets a frame (e.g. a covered window) must not block the change
  return FX.viewTransition(once, o);
}
const motionOff = () => window.FX?.motion === 'off';

const ICON = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  next: 'M6 6l8.5 6L6 18zM16 6h2v12h-2z', prev: 'M18 6l-8.5 6L18 18zM6 6h2v12H6z',
  shuffle: 'M14.8 4H20v5.2l-1.9-1.9-3.4 3.4-1.4-1.4 3.4-3.4zM4 18.6L18.1 4.5 19.5 5.9 5.4 20zm10.6-4.2l1.4-1.4 2.1 2.1L20 13.2V18.4h-5.2l1.9-1.9zM4 5.4L5.4 4l4.7 4.7-1.4 1.4z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
  repeat1: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zM13 15V9h-1l-2 1v1h1.5v4z',
  heart: 'M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3z',
  heartO: 'M16.6 3c-1.7 0-3.4.8-4.6 2.1C10.8 3.8 9.1 3 7.4 3 4.4 3 2 5.4 2 8.4c0 3.6 3.4 6.6 8.6 11.3L12 21l1.4-1.3C18.6 15 22 12 22 8.4 22 5.4 19.6 3 16.6 3zm-4.5 15.2l-.1.1-.1-.1C7.1 14 4 11.2 4 8.4 4 6.5 5.5 5 7.4 5c1.5 0 3 1 3.5 2.3h1.9C13.3 6 14.8 5 16.3 5 18.5 5 20 6.5 20 8.4c0 2.8-3.1 5.6-7.9 9.8z',
  queue: 'M3 6h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm14-4v6.2a3 3 0 1 0 2 2.8V12h3v-2z',
  lyrics: 'M4 4h16v12H7l-3 3zm3 4v2h10V8zm0 3v2h7v-2z',
  full: 'M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
  down: 'M7 10l5 5 5-5z', vol: 'M4 9v6h4l5 5V4L8 9zm12.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z',
  mute: 'M4 9v6h4l5 5V4L8 9zm16.6 0.4L19.2 8 17 10.2 14.8 8l-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4-2.2-2.2z',
  more: 'M12 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  x: 'M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  get: 'M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z',
  devices: 'M3 5h13v2H5v8h7v3H1v-2h2zm11 4h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zm1 2v7h5v-7z',
  search: 'M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  tune: 'M4 6h9v2H4zm13 0h3v2h-3zm-2-2h2v6h-2zM4 16h3v2H4zm7 0h9v2h-9zm-2-2h2v6H9zM4 11h5v2H4zm9 0h7v2h-7zm-2-2h2v6h-2z',
  back: 'M15.4 7.4L14 6l-6 6 6 6 1.4-1.4-4.6-4.6z', fwd: 'M8.6 7.4L10 6l6 6-6 6-1.4-1.4 4.6-4.6z',
  side: 'M3 4h18v16H3zm2 2v12h4V6zm6 0v12h8V6z',
  home: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z',
  library: 'M4 4h2v16H4zm4 0h2v16H8zm4.3.6l1.9-.6 5.6 15.2-1.9.7z',
  note: 'M9 3h11v13.5a3.5 3.5 0 1 1-2-3.2V7h-7v9.5A3.5 3.5 0 1 1 9 13.3z',
  album: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  artist: 'M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-8 8c0-3.3 3.6-6 8-6s8 2.7 8 6z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  sleep: 'M14.5 3A9 9 0 1 0 21 15.5 7 7 0 0 1 14.5 3z',
  grip: 'M8 6h2v2H8zm6 0h2v2h-2zM8 11h2v2H8zm6 0h2v2h-2zM8 16h2v2H8zm6 0h2v2h-2z',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1 3h2v5.4l3.5 2.1-1 1.7L11 13.6z',
  cmd: 'M5 7.4L6.4 6l6 6-6 6L5 16.6 9.6 12zM13 16h6v2h-6z',
  jump: 'M5 11h10.2l-4.6-4.6L12 5l7 7-7 7-1.4-1.4 4.6-4.6H5z',
  link: 'M10.6 13.4a1 1 0 0 1 0-1.4l3-3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0zM8 18a4 4 0 0 1-2.8-6.8l2-2 1.4 1.4-2 2a2 2 0 1 0 2.8 2.8l2-2 1.4 1.4-2 2A4 4 0 0 1 8 18zm8.8-4.8l-1.4-1.4 2-2a2 2 0 1 0-2.8-2.8l-2 2-1.4-1.4 2-2a4 4 0 1 1 5.6 5.6z',
  edit: 'M4 17.2V20h2.8l8.3-8.3-2.8-2.8zM19.7 7.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 2.8 2.8z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
  up: 'M7 14l5-5 5 5z',
};
const EVENODD = new Set(['album', 'clock']); // icons with a hole in the middle
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path${EVENODD.has(n) ? ' fill-rule="evenodd"' : ''} d="${ICON[n]}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const store = {
  get(k, d) { try { const v = localStorage.getItem('ocm.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ocm.' + k, JSON.stringify(v)); } catch { /* private window: settings just don't stick */ } },
};
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

// Placeholder cover: a little record in a colour picked from the title, so every song still looks like something.
function blankCover(seed) {
  const h = hue(seed);
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${h},45%,28%)"/><circle cx="50" cy="50" r="30" fill="hsl(${h},40%,16%)"/><circle cx="50" cy="50" r="9" fill="hsl(${(h + 40) % 360},85%,62%)"/></svg>`);
}
// Library covers are file names in .covers/; catalogue covers are full URLs.
const cover = (t) => t?.cover ? (/^(https?:|\/|data:)/.test(t.cover) ? t.cover : `${BASE}/cover/${encodeURIComponent(t.cover)}`) : blankCover(t?.album || t?.title || '?');

// ---------- cover colours: each cover is read once (24 px, fx.js), then kept for good in ocm.colours ----------
const COL = store.get('colours', {}); // cover url -> its three main colours as [h, s, l]
const colQ = new Set();
let colBusy = 0, colSave = 0, colPaint = 0;
function colourOf(src) {
  if (!src) return null;
  if (COL[src]) return COL[src];
  const blank = /^data:image\/svg\+xml,.*?hsl\((\d+)/.exec(src); // our placeholder record: its hue is right there
  if (blank) return [[+blank[1], 0.45, 0.28]];
  if (!colQ.has(src)) { colQ.add(src); pumpColours(); }
  return null;
}
function pumpColours() {
  while (colBusy < 3 && colQ.size) {
    const src = colQ.values().next().value;
    colQ.delete(src); colBusy++;
    // shortcut: a cover that can't be read is filed with the greys for good; clear ocm.colours to read it again
    Promise.resolve(fx('coverHsl', src)).then((p) => (COL[src] = p || [[0, 0, 0.5]])).finally(() => {
      colBusy--; pumpColours();
      clearTimeout(colSave); colSave = setTimeout(() => store.set('colours', COL), 1000);
      clearTimeout(colPaint); colPaint = setTimeout(colourPaint, 300);
    });
  }
}
// New colours repaint the pages that show them (once per cover, ever); never while you're typing in a filter.
function colourPaint() {
  if (['home', 'library', 'playlist'].includes(S.view) && !document.activeElement?.matches('#main input')) render();
}
// The strongest pick is often a near-black (dark pixels read as saturated): lead with the first real colour instead.
const lead = (p) => { const m = p?.find(([, s, l]) => s >= 0.16 && l > 0.12 && l < 0.92); return m ? [m, ...p.filter((x) => x !== m)] : p; };
const rampOf = (src, h) => fx('ramp', lead(colourOf(src)) || [[h, 0.55, 0.45]]) || ['#1b1b22', '#2c2c38', '#45455a', '#68687f', '#9494a8', '#c6c6d2'];
// Our own cover for playlists and mixes: a capsule scene (scenes.js) or a stack of pills in the list's ramp, big type and mono labels. No stock art.
const COVERS = new Map(); // built covers by title + label + ramp: a scene costs more than a lookup
function genCover(title, ramp, label) {
  const key = `${title}|${label}|${ramp.join()}|${!!window.Scenes}`;
  if (COVERS.has(key)) return COVERS.get(key);
  const lines = [];
  for (const w of String(title).split(/\s+/).filter(Boolean)) { if (lines.length && (lines.at(-1) + ' ' + w).length <= 11) lines[lines.length - 1] += ' ' + w; else lines.push(w); }
  const shown = lines.slice(0, 3), fs = Math.min(34, 168 / (0.6 * Math.max(1, ...shown.map((l) => l.length)))), lh = fs * 0.98;
  let art = ramp.slice(1).map((c, i) => `<rect x="${86 + i * 13}" y="${14 + i * 15}" width="150" height="28" rx="14" fill="${c}" filter="url(#s)"/>`).join('');
  const sc = window.Scenes?.forSeed(title); // the same scene for the same name, painted in this list's ramp
  if (sc) {
    try { art = Scenes.svg({ scene: sc.scene, seed: sc.seed, ramp, w: 56, h: 112 }).replace('<svg ', '<svg x="128" y="12" filter="url(#s)" '); }
    catch (e) { console.warn('Scene cover failed, using pills', e); }
  }
  const text = shown.map((l, i) => `<text x="13" y="${(187 - (shown.length - 1 - i) * lh).toFixed(1)}" font-size="${fs.toFixed(1)}">${esc(l)}</text>`).join('');
  const url = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><filter id="s" x="-20%" y="-50%" width="140%" height="220%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".35"/></filter>` +
    `<radialGradient id="g" cx=".85" cy=".1" r=".9"><stop offset="0" stop-color="${ramp[2]}" stop-opacity=".55"/><stop offset="1" stop-color="${ramp[0]}" stop-opacity="0"/></radialGradient>` +
    `<style>text{font-family:Inter,"Segoe UI",system-ui,sans-serif;font-weight:800;fill:#fff;letter-spacing:-.03em}.m{font:600 9px ui-monospace,Consolas,monospace;letter-spacing:.08em;fill-opacity:.78}</style></defs>` +
    `<rect width="200" height="200" fill="${ramp[0]}"/><rect width="200" height="200" fill="url(#g)"/>${art}<text class="m" x="13" y="22">${esc(label)}</text><text class="m" x="13" y="34">${ramp[3] || ''}</text>${text}</svg>`);
  COVERS.set(key, url);
  return url;
}
const plCover = (p) => { const t = T(p.tracks[0]); return genCover(p.name, rampOf(t && cover(t), hue(p.id)), `PLAYLIST · ${p.tracks.length}`); };
// Mono spec labels: duration, year, format, counts, as a small type detail on rows and headers.
const codecTag = (c) => { // "mp4a.40.2 129 kbps" -> "AAC 129K"
  const [f = '', k] = String(c || '').toLowerCase().split(/\s+/);
  return [/^mp4a/.test(f) ? 'aac' : f.split('.')[0], /^\d+$/.test(k || '') ? `${k}k` : ''].filter(Boolean).join(' ').toUpperCase();
};
const typeWord = (t) => (/^ep$/i.test(t || '') ? 'EP' : (t || 'album').toLowerCase()); // "Get EP", "Get single"
const specsHTML = (list) => `<div class="specs">${list.filter(Boolean).map((s) => `<span class="spec">${esc(s)}</span>`).join('')}</div>`;

// For "Copy diagnostics": the last few errors, with links, video ids, quoted titles and folder paths taken out.
const FRESH = (() => { try { return localStorage.getItem('ocm.vol') == null; } catch { return false; } })(); // read before setVol saves it
const errLog = [];
const scrub = (m) => String(m ?? '')
  .replace(/https?:\/\/\S+/g, '<link>')
  .replace(/[A-Za-z]:\\[^\s'"]+|\/(?:storage|data|sdcard|home|Users|tmp)\/[^\s'"]*/g, '<path>')
  .replace(/\[(\w+)\] [\w-]{11}\b/g, '[$1] <id>')
  .replace(/[“"][^”"]*[”"]/g, '"…"')
  .slice(0, 220);
function logError(where, msg) {
  errLog.push(`${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${where}: ${scrub(msg)}`);
  errLog.splice(0, errLog.length - 10);
}
addEventListener('error', (e) => e.message && logError('page', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
addEventListener('unhandledrejection', (e) => logError('page', e.reason?.message || e.reason));
async function api(path, body, signal) {
  try {
    const r = await fetch(BASE + path, body === undefined ? { signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  } catch (e) {
    if (e.name !== 'AbortError') logError(path.split('?')[0], e.message);
    throw e;
  }
}
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = `<span class="toast-t">${esc(msg)}</span>`; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- layout + input type (phone ≤600, tablet ≤1024, desktop) ----------
const MQ = { phone: matchMedia('(max-width: 600px)'), desk: matchMedia('(min-width: 1025px)'), touch: matchMedia('(hover: none), (pointer: coarse)') };
const touch = () => H.dataset.input === 'touch';
const desktop = () => H.dataset.layout === 'desktop';
function paintLayout() {
  H.dataset.layout = MQ.phone.matches ? 'phone' : MQ.desk.matches ? 'desktop' : 'tablet';
  H.dataset.input = MQ.touch.matches ? 'touch' : 'mouse';
}
paintLayout();

// ---------- state ----------
let lib = { tracks: {}, playlists: [] };
const S = {
  queue: store.get('queue', []), qi: store.get('qi', -1), order: store.get('order', null),
  shuffle: store.get('shuffle', false), repeat: store.get('repeat', 'off'),
  view: store.get('view', 'home'), arg: store.get('arg', null), sort: store.get('sort', 'added'),
  drawer: store.get('drawer', null), libTab: store.get('libTab', 'songs'), npTab: store.get('npTab', 'lyrics'),
  lyrics: {}, results: null, playAfter: new Set(), chip: 'all', loaded: false,
};
const T = (id) => lib.tracks[id];
// Catalogue songs you don't have yet (they play through /api/stream). Kept flat, in the library track shape.
const R = store.get('remote', {});
const secs = (d) => (typeof d === 'string' ? d.split(':').reduce((a, b) => a * 60 + +b, 0) : d || 0);
function remember(s) {
  if (!s?.id) return s;
  return (R[s.id] = { id: s.id, title: s.title || '', artist: typeof s.artist === 'string' && s.artist ? s.artist : (s.artists || []).map((a) => a.name).join(', '),
    album: typeof s.album === 'string' ? s.album : s.album?.name || '', album_id: s.album_id || s.album?.id || '', artist_id: s.artist_id || s.artists?.[0]?.id || '',
    duration: secs(s.duration), year: s.year || '', cover: s.cover || s.thumb || '', track_no: s.track_no, explicit: !!s.explicit });
}
const Q = (id) => lib.tracks[id] || R[id]; // a library track, or a remembered catalogue song
const cur = () => Q(S.queue[S.qi]);
const streaming = (t) => !!t && !T(t.id);
const srcFor = (t) => (t.file ? `${BASE}/media/${encodeURIComponent(t.file)}` : `${BASE}/api/stream?id=${encodeURIComponent(t.id)}`);
const allTracks = () => Object.values(lib.tracks);
const save = () => {
  for (const k of ['queue', 'qi', 'order', 'shuffle', 'repeat', 'view', 'arg', 'sort', 'drawer', 'libTab', 'npTab']) store.set(k, S[k]);
  store.set('remote', Object.fromEntries(S.queue.filter((id) => !T(id) && R[id]).map((id) => [id, R[id]])));
};

async function loadLib() {
  lib = await api('/api/library');
  S.queue = S.queue.filter((id) => Q(id));
  if (S.qi >= S.queue.length) S.qi = S.queue.length - 1;
  S.loaded = true;
  renderNav();
}

// ---------- overlays: one stack for Esc, the Android back button and focus ----------
// Each open overlay also pushes a history entry so the hardware back button closes it first.
// Closing one from the UI pops its entry again; pushes made meanwhile wait for that pop to land.
const OV = { stack: [], close: {} };
const NAV = { p: 0, len: 0, skip: 0, queue: [] };
const pushHist = (st) => (NAV.skip ? NAV.queue.push(st) : history.pushState(st, ''));
function ovOpen(name, push = true) {
  if (OV.stack.includes(name)) return;
  OV.stack.push(name);
  if (push) pushHist({ ...(NAV.queue.at(-1) || history.state), ov: name });
}
function ovClosed(name) {
  if (!OV.stack.includes(name)) return;
  OV.stack = OV.stack.filter((n) => n !== name);
  if (history.state?.ov === name && !NAV.queue.length) { NAV.skip++; history.back(); }
  else NAV.queue = NAV.queue.filter((s) => s.ov !== name);
}
function closeTop() { const n = OV.stack.at(-1); if (!n) return false; OV.close[n](); return true; }

// ---------- playback ----------
function playList(ids, start = 0) {
  if (!ids.length) return;
  S.order = null;
  S.queue = [...ids]; S.qi = start;
  if (S.shuffle) shuffleRest();
  load(true);
}
function shuffleRest() {
  S.order = [...S.queue];
  const rest = S.queue.filter((_, i) => i !== S.qi);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  S.queue = [S.queue[S.qi], ...rest].filter(Boolean); S.qi = 0;
}
function toggleShuffle() {
  S.shuffle = !S.shuffle;
  if (S.shuffle && S.queue.length) shuffleRest();
  else if (!S.shuffle && S.order) { const id = S.queue[S.qi]; S.queue = S.order.filter((x) => Q(x)); S.qi = Math.max(0, S.queue.indexOf(id)); S.order = null; }
  save(); paintControls(); paintQueues();
}
let counted = false;
function load(autoplay) {
  const t = cur();
  if (!t) return;
  audio.src = srcFor(t);
  counted = false;
  if (autoplay) audio.play().catch(() => {});
  paintNow(); paintQueues(); highlightRows(); save();
  fx('trackChanged', cover(t));
  prepare(S.queue[S.qi + 1], true); prepare(S.queue[S.qi + 2], true);
  setMediaSession(t);
  loadLyrics(t);
}
// A stream link takes a ~2 s lookup, so warm it up early: the next two in line, a song you hover or touch,
// the first Quick picks and any song that stays on screen. With keep, on Wi-Fi the server also downloads the
// whole song, so it starts at once and plays offline. The server keeps links 5.5 h, so re-warm after 5.
const prepared = new Map();
// Unknown connection type on Android counts as mobile data, so a phone never spends data on download-ahead.
const onWifi = (c = navigator.connection) => !c || (!c.saveData && (c.type ? ['wifi', 'ethernet'].includes(c.type) : !/Android/.test(navigator.userAgent)));
function prepare(id, keep) {
  if (!id || T(id) || Date.now() - (prepared.get(id) || 0) < 5 * 3600e3 || !/^[\w-]{11}$/.test(id)) return;
  prepared.set(id, Date.now());
  return fetch(`${BASE}/api/stream?id=${encodeURIComponent(id)}&prepare=1${keep && onWifi() ? '&keep=1' : ''}`).catch(() => prepared.delete(id));
}
const WARM = '.row[data-remote], .tile[data-kind=song], .qp, .gs-item[data-kind=web]';
// Songs on screen two scans in a row (1-2 s) get warmed top first, one lookup at a time and at most 15 per
// 5 min, so browsing never floods YouTube or keeps a tap waiting for a free lookup slot.
let onScreen = new Set(), warmBusy = false, warmTimes = [];
setInterval(() => {
  if (document.hidden || warmBusy) return;
  const vis = new Set([...document.querySelectorAll(WARM)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }).map((el) => el.dataset.id));
  const id = [...vis].find((v) => onScreen.has(v) && !T(v) && !prepared.has(v));
  onScreen = vis;
  warmTimes = warmTimes.filter((t) => Date.now() - t < 5 * 60e3);
  if (!id || warmTimes.length >= 15) return;
  warmTimes.push(Date.now());
  warmBusy = true;
  Promise.resolve(prepare(id, true)).finally(() => { warmBusy = false; });
}, 1000);
// On a phone there is no hover: start the lookup the moment a finger lands, ~150 ms before the tap counts.
document.addEventListener('pointerdown', (e) => { const el = e.target.closest?.(WARM); if (el && !T(el.dataset.id)) prepare(el.dataset.id); }, { passive: true, capture: true });
let hoverT = 0;
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest?.(WARM);
  clearTimeout(hoverT);
  if (el && !T(el.dataset.id)) hoverT = setTimeout(() => prepare(el.dataset.id), 250);
});
function setMediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album,
    artwork: t.cover ? [{ src: new URL(cover(t), location.href).href, sizes: '512x512', type: 'image/jpeg' }] : [] });
}
function next(auto) {
  if (!S.queue.length) return;
  if (auto && S.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (S.qi < S.queue.length - 1) S.qi++;
  else if (S.repeat === 'all' || !auto) S.qi = 0;
  else { audio.pause(); return; }
  load(true);
}
function prev(force) {
  if ((!force && audio.currentTime > 3) || S.qi <= 0) { audio.currentTime = 0; return; }
  S.qi--; load(true);
}
function togglePlay() {
  if (!audio.src) { if (cur()) load(true); else if (allTracks().length) playList(sortTracks(allTracks()).map((t) => t.id)); return; }
  audio.paused ? audio.play() : audio.pause();
}
function playNext(ids) { S.queue.splice(S.qi + 1, 0, ...ids); if (S.qi < 0) { S.qi = 0; load(true); } save(); paintQueues(); toast(ids.length > 1 ? `${ids.length} songs play next` : 'Plays next'); }
function addToQueue(ids) { S.queue.push(...ids); if (S.qi < 0) { S.qi = 0; load(true); } save(); paintQueues(); toast(ids.length > 1 ? `Added ${ids.length} songs to Up next` : 'Added to Up next'); }

audio.addEventListener('ended', () => (sleep.song ? stopSleep(true) : next(true)));
audio.addEventListener('play', () => { document.body.classList.add('playing'); paintControls(); });
audio.addEventListener('pause', () => { document.body.classList.remove('playing'); paintControls(); });
audio.addEventListener('error', () => { if (!audio.getAttribute('src')) return; toast("Can't play this file — skipping"); setTimeout(() => next(true), 800); });
audio.addEventListener('timeupdate', () => {
  const d = audio.duration || cur()?.duration || 0, c = audio.currentTime, p = `${d ? (c / d) * 100 : 0}%`;
  for (const [seek, a, b] of [['#seek', '#tCur', '#tDur'], ['#npSeek', '#npCur', '#npDur']]) {
    const el = $(seek);
    if (!el.matches(':active')) { el.value = d ? (c / d) * 1000 : 0; el.style.setProperty('--p', `${el.value / 10}%`); }
    $(a).textContent = fmt(c); $(b).textContent = fmt(d);
  }
  $('#bar').style.setProperty('--p', p); // not on #np: nothing there reads it, and it restyled the whole player 4x a second
  if (!counted && c > Math.min(30, d / 2)) { counted = true; const t = cur(); if (T(t?.id)) api('/api/track', { id: t.id, played: true }).then((x) => (lib.tracks[x.id] = x)).catch(() => {}); }
  store.set('pos', c);
  syncLyrics(c);
});
for (const id of ['#seek', '#npSeek']) {
  $(id).addEventListener('input', (e) => { const d = audio.duration || 0; e.target.style.setProperty('--p', `${e.target.value / 10}%`); if (d) audio.currentTime = (e.target.value / 1000) * d; });
}
const vol = $('#vol');
function setVol(v) { audio.volume = v / 100; vol.value = v; vol.style.setProperty('--p', `${v}%`); store.set('vol', v); $('#muteBtn').innerHTML = svg(v ? 'vol' : 'mute'); $('#muteBtn').setAttribute('aria-label', v ? 'Mute' : 'Unmute'); }
vol.addEventListener('input', () => setVol(+vol.value));
$('#muteBtn').onclick = () => { if (+vol.value) { store.set('unmute', +vol.value); setVol(0); } else setVol(store.get('unmute', 80)); };

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => audio.play());
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('nexttrack', () => next(false));
  ms.setActionHandler('previoustrack', () => prev());
  ms.setActionHandler('seekto', (e) => (audio.currentTime = e.seekTime));
}

// ---------- sleep timer: fades the last 10 s, then pauses and puts the volume back ----------
const sleep = { end: 0, song: false, t: 0 };
function setSleep(min) {
  stopSleep(false);
  sleep.song = min === 'song';
  if (typeof min === 'number' && min > 0) sleep.end = Date.now() + min * 60000;
  if (sleep.end || sleep.song) sleep.t = setInterval(sleepTick, 500);
  paintSleep();
  toast(sleep.song ? 'Stops at the end of this song' : sleep.end ? `Stops in ${min} min` : 'Sleep timer off');
}
function stopSleep(pause) {
  clearInterval(sleep.t); sleep.end = 0; sleep.song = false;
  if (pause) audio.pause();
  audio.volume = +vol.value / 100;
  paintSleep();
}
const sleepLeft = () => (sleep.song ? (audio.duration || 0) - audio.currentTime : (sleep.end - Date.now()) / 1000);
function sleepTick() {
  if (sleep.song && audio.paused) return;
  const left = sleepLeft();
  if (left <= 0.3) return stopSleep(true);
  if (left < 10) audio.volume = (+vol.value / 100) * (left / 10);
  paintSleep();
}
function paintSleep() {
  const on = !!(sleep.end || sleep.song), b = $('#sleepBadge');
  b.hidden = !on;
  if (on) b.textContent = Math.max(1, Math.ceil(sleepLeft() / 60));
  for (const el of $$('#sleepBtn, [data-act=sleep]')) {
    el.classList.toggle('on', on);
    el.setAttribute('aria-label', on ? `Sleep timer: ${b.textContent} min left` : 'Sleep timer');
  }
}
function sleepMenu(e) {
  e.stopPropagation();
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(r.left, r.top - 8, [
    { label: 'Off', icon: 'x', do: () => setSleep(0) },
    ...[5, 15, 30, 45, 60].map((n) => ({ label: `${n} minutes`, icon: 'sleep', do: () => setSleep(n) })),
    { label: 'End of this song', icon: 'note', do: () => setSleep('song') },
  ], { title: 'Sleep timer', sub: 'Music fades out and stops' });
}

// ---------- likes, playlists ----------
async function like(id, on, btn) {
  const t = T(id); if (!t) return;
  on = on ?? !t.liked;
  if (on && btn) fx('burst', btn, { kind: 'heart' });
  lib.tracks[id] = await api('/api/track', { id, liked: on });
  paintNow(); if (S.view === 'liked' || (S.view === 'library' && S.libTab === 'liked')) render();
  else $$(`.row[data-id="${CSS.escape(id)}"] .like`).forEach((b) => paintLike(b, on));
}
function paintLike(b, on) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = svg(on ? 'heart' : 'heartO'); }
async function savePlaylist(p) { lib.playlists = await api('/api/playlists', p); renderNav(); return lib.playlists; }
async function newPlaylist(ids = []) {
  const name = await ask('New playlist', 'Give it a name.', { input: 'My mix', ok: 'Make it' });
  if (!name) return;
  const list = await savePlaylist({ name, tracks: ids });
  toast(`Made “${name}”`);
  return list[list.length - 1];
}
async function addToPlaylist(pid, ids) {
  const p = lib.playlists.find((x) => x.id === pid);
  const add = ids.filter((id) => !p.tracks.includes(id));
  await savePlaylist({ id: pid, tracks: [...p.tracks, ...add] });
  toast(add.length ? `Added to ${p.name}` : `Already in ${p.name}`);
}
function movePlaylistTrack(pid, from, to) {
  const p = lib.playlists.find((x) => x.id === pid);
  if (!p || to < 0 || to >= p.tracks.length || from === to) return;
  const tr = [...p.tracks]; const [m] = tr.splice(from, 1); tr.splice(to, 0, m);
  savePlaylist({ id: p.id, tracks: tr }).then(render);
}
function moveQueue(from, to) {
  if (to < 0 || to >= S.queue.length || from === to) return paintQueues();
  const curId = S.queue[S.qi]; const [m] = S.queue.splice(from, 1); S.queue.splice(to, 0, m);
  S.qi = S.queue.indexOf(curId); save(); paintQueues();
}

// ---------- dialogs: settings, shortcuts, ask (replaces prompt/confirm) ----------
let dlgOpener = null;
function openDlg(id, focusEl) {
  const d = $('#' + id);
  if (d.hidden) dlgOpener = document.activeElement;
  d.hidden = false; ovOpen(id);
  (focusEl || d.querySelector('button, input'))?.focus();
}
function closeDlg(id) {
  const d = $('#' + id); if (d.hidden) return;
  d.hidden = true; ovClosed(id);
  dlgOpener?.focus?.(); dlgOpener = null;
}
for (const id of ['settings', 'keys']) OV.close[id] = () => closeDlg(id);
$$('.dlg').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.dlg-x')) OV.close[d.id](); }));

let askDone = null;
OV.close.ask = () => askDone?.(null);
function ask(title, text, { input, ok = 'OK', danger = false } = {}) {
  askDone?.(null);
  return new Promise((resolve) => {
    $('#askTitle').textContent = title; $('#askText').textContent = text || '';
    const inp = $('#askInput'), okB = $('[data-ask=ok]');
    inp.hidden = input == null; inp.value = input ?? ''; inp.setAttribute('aria-label', title);
    okB.textContent = ok; okB.classList.toggle('danger', danger);
    askDone = (v) => { askDone = null; closeDlg('ask'); resolve(v === null ? (input == null ? false : null) : v); };
    okB.onclick = () => askDone(input == null ? true : inp.value.trim() || null);
    $('[data-ask=cancel]').onclick = () => askDone(null);
    inp.onkeydown = (e) => { if (e.key === 'Enter') okB.click(); };
    openDlg('ask', input == null ? okB : inp);
    if (input != null) inp.select();
  });
}

// Appearance: fx.js owns the settings; we only render them and send changes.
const THEMES = [
  { id: 'night-market', name: 'Night Market', mood: 'Neon paper-cut night, the Oddly Clever house look.', modes: ['dark', 'light'] },
  { id: 'glasshouse', name: 'Glasshouse', mood: 'Frosted glass over a slow aurora: calm, airy, expensive.', modes: ['dark', 'light'] },
  { id: 'vinyl-club', name: 'Vinyl Club', mood: 'Warm record shop: cream paper, charcoal ink, amber glow.', modes: ['light', 'dark'] },
  { id: 'midnight-ink', name: 'Midnight Ink', mood: 'OLED black, hairlines, one electric lime accent, no decoration.', modes: ['dark'] },
  { id: 'sunset-tape', name: 'Sunset Tape', mood: 'Retro cassette sunset: pink, orange, violet gradients, playful and loud.', modes: ['dark', 'light'] },
];
const DEFAULTS = { v: 1, theme: 'night-market', mode: 'auto', albumColours: true, aurora: true, motion: 'full', webFonts: true };
const themes = () => window.FX?.themes || THEMES;
const settings = () => fx('getSettings') || DEFAULTS;
function paintSettings() {
  const s = settings(), th = themes().find((t) => t.id === s.theme) || themes()[0];
  $('#themeGrid').innerHTML = themes().map((t) => `<button class="theme-card" role="radio" aria-checked="${t.id === s.theme}" data-theme-pick="${t.id}"><span class="swatch" aria-hidden="true"><i></i><i></i><i></i></span><b>${esc(t.name)}</b><span class="sub">${esc(t.mood)}</span></button>`).join('');
  const darkOnly = !th.modes.includes('light');
  $$('[data-mode-pick]').forEach((b) => { b.setAttribute('aria-checked', b.dataset.modePick === s.mode); b.disabled = darkOnly && b.dataset.modePick === 'light'; });
  $('#modeHint').textContent = darkOnly ? 'This theme is dark only.' : (window.OCMNative ? 'Auto follows your phone.' : 'Auto follows your system.');
  $$('[data-motion-pick]').forEach((b) => b.setAttribute('aria-checked', b.dataset.motionPick === s.motion));
  $('#setAlbum').checked = !!s.albumColours; $('#setAurora').checked = !!s.aurora; $('#setFonts').checked = !!s.webFonts;
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  $('#setRegion').innerHTML = REGIONS.map((c) => [c, names.of(c)]).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => `<option value="${c}"${c === region() ? ' selected' : ''}>${esc(n)}</option>`).join('');
}
// Discover region lives in app.js storage (ocm.region), not in fx.js's appearance object.
$('#setRegion').onchange = (e) => { store.set('region', e.target.value); toast(`Home now shows music from ${e.target.selectedOptions[0].text}`); if (S.view === 'home') render(); };
function setting(patch) { fx('applySettings', patch); paintSettings(); }
function openSettings() { paintSettings(); paintGetApp(); paintUpdates(); openDlg('settings', $('#settings [aria-checked=true]')); }

// ---------- Get the app: download the Windows installer or the APK, or send the APK to a phone on the Wi-Fi ----------
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
async function paintGetApp() {
  let st = {};
  try { st = await api('/get/status'); } catch { /* an older server: both cards just say not built */ }
  for (const [kind, size] of [['windows', st.windows], ['android', st.android]]) {
    const card = $(`.ga-card[data-ga="${kind}"]`);
    card.classList.toggle('missing', size == null);
    $('.ga-size', card).textContent = size == null ? 'Not built yet' : mb(size);
    $$('a[data-ga-file]', card).forEach((a) => { if (size == null) a.removeAttribute('href'); else a.href = `${BASE}/get/${a.dataset.gaFile}`; a.setAttribute('aria-disabled', size == null); });
  }
  $('#gaSend').disabled = st.android == null;
  showShare(st.share).catch(() => {});
}
async function showShare(sh) {
  if (sh) await loadQr();
  $('#gaShare').hidden = !sh;
  if (!sh) return;
  const qr = qrcode(0, 'M'); qr.addData(sh.url); qr.make();
  $('#gaQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  $('#gaUrl').textContent = sh.url;
  $('#gaUntil').textContent = `The link stops working at ${new Date(sh.until * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}
const loadQr = () => window.qrcode ? Promise.resolve() : new Promise((ok, fail) => document.head.append(Object.assign(document.createElement('script'), { src: 'qrcode.js', onload: ok, onerror: fail })));
$('#gaSend').onclick = async () => {
  try { await showShare(await api('/get/share', {})); $('#gaShare').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  catch (e) { toast(`Couldn't share it: ${e.message}`); }
};
// ---------- updates, engine, help, licences (updates.py answers /api/app/*) ----------
let upd = null; // the last /api/app/update answer
const ANDROID = !!window.OCMNative;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const engineLine = (i) => {
  const e = i.engine || {}, how = { updated: 'updated', 'built-in': 'built in', pip: 'installed' }[i.engine_source];
  const note = /^Engine updated/.test(i.engine_note || '') ? '' : i.engine_note; // "updated" already says it
  return `yt-dlp ${e['yt-dlp'] || 'not found'}${how ? ` (${how})` : ''}${note ? `. ${note}` : ''}`;
};
async function paintUpdates(force) {
  let i = {};
  try { i = await api('/api/app/info'); } catch { /* an older server: the section just stays plain */ }
  $('#updEngine').textContent = engineLine(i);
  if (i.issues) $('#diagReport').href = i.issues;
  $('#updApp').textContent = `Version ${i.version || '?'} · checking…`;
  try { upd = await api('/api/app/update' + (force ? '?force=1' : '')); }
  catch { $('#updApp').textContent = `Version ${i.version || '?'}`; return; }
  $('#updApp').textContent = `Version ${upd.current} · ${upd.newer ? `${upd.latest} is out` : upd.check_error ? "couldn't check just now" : 'up to date'}`;
  paintUpdNew();
}
function paintUpdNew() {
  const box = $('#updNew');
  box.hidden = !upd?.newer;
  if (box.hidden) return;
  const d = upd.download || {};
  $('#updNewTitle').textContent = `Spin ${upd.latest} is ready`;
  $('#updNotes').textContent = upd.notes.trim() || 'Fixes and small improvements.';
  $('#updGet').hidden = !ANDROID; $('#updLink').hidden = ANDROID;
  $('#updLink').href = upd.asset.url;
  $('#updPage').hidden = !upd.page; $('#updPage').href = upd.page || '#';
  $('#updGet').textContent = d.state === 'ready' ? 'Install' : 'Download and install';
  $('#updGet').disabled = d.state === 'downloading';
  $('#updState').textContent = d.state === 'downloading' ? `Downloading… ${Math.round((100 * d.got) / (d.total || 1))}%`
    : d.state === 'error' ? `The download stopped (${d.error}). Try again in a moment.`
    : d.state === 'ready' ? 'Downloaded. Android shows its installer next: tap Update.' : mb(upd.asset.size);
}
$('#updCheck').onclick = () => paintUpdates(true);
$('#updGet').onclick = async () => {
  try {
    if (upd?.download?.state !== 'ready') {
      upd = await api('/api/app/update/download', {});
      while (upd.download?.state === 'downloading') { paintUpdNew(); await wait(700); upd = await api('/api/app/update'); }
      paintUpdNew();
      if (upd.download?.state !== 'ready') return;
    }
  } catch (e) { return toast(`Couldn't get the update: ${e.message}`); }
  const r = window.OCMNative?.installUpdate?.();
  if (r === 'permission') $('#updState').textContent = 'Android needs your OK first: turn on “Allow from this source”, then come back.';
  else if (r === 'missing') { upd.download = {}; paintUpdNew(); toast('The download went missing. Tap to get it again.'); }
};
// The Android app calls this when the install can't go ahead (MainActivity.pageEvent).
window.__ocmEvent = (name) => {
  if (name === 'install-blocked') $('#updState').textContent = 'Installs from Spin are still off, so nothing changed. Tap Install to try again, or get the APK from the release page.';
  if (name === 'install-failed') toast("Android couldn't open its installer");
};
async function updateEngine() {
  const b = $('#updEngineBtn'); b.disabled = true;
  toast('Looking for a newer engine…');
  try {
    const r = await api('/api/app/engine', {});
    toast({ updated: `Engine updated to ${r.version}`, current: `The engine is up to date (${r.version})`, 'rolled-back': r.note,
      bad: `Engine ${r.version} didn't pass its check, so I'm staying on this one` }[r.status] || 'Done');
    if (r.info) $('#updEngine').textContent = engineLine(r.info);
  } catch (e) { toast(`Couldn't update the engine: ${e.message}`); }
  b.disabled = false;
}
$('#updEngineBtn').onclick = updateEngine;
// A quiet note once per new version; the details live in Settings › More.
async function updateNudge() {
  try { upd = await api('/api/app/update'); } catch { return; }
  if (!upd.newer || store.get('updSeen') === upd.latest) return;
  const n = document.createElement('div');
  n.className = 'upd-nudge'; n.setAttribute('role', 'status');
  n.innerHTML = `<span>Update available · Spin ${esc(upd.latest)}</span><button class="pill sm hot" type="button">See what's new</button><button class="ico" type="button" aria-label="Not now">${svg('x')}</button>`;
  const done = () => { store.set('updSeen', upd.latest); n.remove(); };
  n.children[1].onclick = () => { done(); openSettings(); setTimeout(() => $('#setUpdates').scrollIntoView({ block: 'start', behavior: motionOff() ? 'auto' : 'smooth' }), 350); };
  n.children[2].onclick = done;
  document.body.append(n);
}
async function copyText(t) {
  if (window.OCMNative?.copy) return OCMNative.copy(t); // the Android WebView has no clipboard API of its own
  try { await navigator.clipboard.writeText(t); return true; } catch { /* older WebViews: the textarea route below */ }
  const a = Object.assign(document.createElement('textarea'), { value: t });
  document.body.append(a); a.select();
  const ok = document.execCommand('copy'); a.remove(); return ok;
}
$('#diagCopy').onclick = async () => {
  const [i, jobs] = await Promise.all([api('/api/app/info').catch(() => ({})), api('/api/jobs').catch(() => [])]);
  const e = i.engine || {}, s = settings();
  const errs = [...(i.errors || []), ...errLog, ...jobs.filter((j) => j.status === 'error').map((j) => `download: ${j.error}`)].map(scrub).slice(-15);
  const text = [
    `OddlyClever Spin ${i.version || '?'} on ${i.platform || '?'} (${i.os || navigator.platform})`,
    `Engine: yt-dlp ${e['yt-dlp'] || '?'} (${i.engine_source || '?'}), yt-dlp-ejs ${e['yt-dlp-ejs'] || '-'}, JS ${i.js || 'auto'}, Python ${i.python || '?'}`,
    i.engine_note && `Engine note: ${scrub(i.engine_note)}`,
    `Songs folder: ${i.songs_public ? 'public Music folder' : 'app folder'}`,
    `Browser: ${(navigator.userAgent.match(/(Chrome|Edg|Firefox|Version)\/[\d.]+/g) || ['?']).join(' ')}`,
    `Screen: ${innerWidth}x${innerHeight} @${devicePixelRatio}, ${H.dataset.layout}, ${H.dataset.input}, theme ${s.theme}, motion ${s.motion}`,
    'Recent errors:', ...(errs.length ? errs : ['none']).map((x) => `  ${x}`),
  ].filter(Boolean).join('\n');
  toast(await copyText(text) ? 'Copied. Paste it into your report.' : "Couldn't copy here");
};
$('#setLicences').onclick = async () => {
  const box = $('#licBox');
  box.hidden = !box.hidden;
  $('#setLicences').setAttribute('aria-expanded', !box.hidden);
  if (box.hidden || $('#licText').textContent) return;
  try { $('#licText').textContent = (await api('/api/app/licences')).text || 'The licence notices are missing from this build.'; }
  catch (e) { $('#licText').textContent = `Couldn't load them: ${e.message}`; }
};

// ---------- first run (new installs only): a look, where songs go, a fair-use line, how it works ----------
const FIRST_LOOKS = ['raindrop', 'night-market', 'vinyl-club'];
const liveOn = () => { try { return (localStorage.getItem('ocm.scene') || 'off') !== 'off'; } catch { return false; } }; // scenes.js loads after app.js
function firstRun() {
  if (store.get('firstRun') || !FRESH || Object.keys(lib.tracks).length) return store.set('firstRun', 1);
  const looks = FIRST_LOOKS.map((id) => themes().find((t) => t.id === id)).filter(Boolean);
  const d = document.createElement('div');
  d.className = 'dlg fr-dlg'; d.id = 'firstRun';
  d.innerHTML = `<div class="dlg-card dlg-small fr-card" role="dialog" aria-modal="true" aria-labelledby="frTitle">
    <p class="fr-step" id="frStep"></p>
    <section class="fr-page" data-fr="0"><h2 id="frTitle">Welcome to Spin</h2><p class="hint">Pick a look to start with. You can change it any time in Settings.</p>
      <div class="fr-looks" role="radiogroup" aria-label="Look">${looks.map((t) => `<button type="button" role="radio" class="fr-look" data-fr-look="${t.id}" aria-checked="${t.id === settings().theme}"><span class="fr-sw" aria-hidden="true">${(t.swatch || []).slice(0, 3).map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</span><b>${esc(t.name)}</b></button>`).join('')}</div>
      <label class="switch"><input type="checkbox" role="switch" id="frLive"${liveOn() ? ' checked' : ''}><span class="track" aria-hidden="true"><i></i></span><span class="lbl">Live background</span><span class="hint">A slow moving scene behind the pages. Off saves battery.</span></label></section>
    <section class="fr-page" data-fr="1" hidden><h2>Where your songs go</h2><p class="fr-where" id="frWhere">…</p>
      <ol class="fr-how"><li>Search for a song, an album or an artist.</li><li>Tap to play it straight away, or tap <b>Get</b> to keep it.</li><li>Songs you get play offline, from this device.</li></ol>
      <p class="fr-fair">Please only download music you have the right to, for your own personal use.</p></section>
    <footer class="fr-foot"><button class="pill" type="button" data-fr-go="skip">Skip</button><button class="pill hot" type="button" data-fr-go="next">Next</button></footer>
  </div>`;
  document.body.append(d);
  let step = 0;
  const show = () => {
    $$('.fr-page', d).forEach((p) => (p.hidden = +p.dataset.fr !== step));
    $('#frStep').textContent = `Step ${step + 1} of 2`;
    $('[data-fr-go=next]', d).textContent = step ? 'Start listening' : 'Next';
  };
  const finish = () => { store.set('firstRun', 1); closeDlg('firstRun'); d.remove(); };
  OV.close.firstRun = finish;
  d.addEventListener('click', (e) => {
    const look = e.target.closest('[data-fr-look]'), go = e.target.closest('[data-fr-go]');
    if (look) { setting({ theme: look.dataset.frLook }); $$('[data-fr-look]', d).forEach((b) => b.setAttribute('aria-checked', b === look)); }
    if (go?.dataset.frGo === 'skip' || (go && step)) finish();
    else if (go) { step = 1; show(); $('[data-fr-go=next]', d).focus(); }
  });
  $('#frLive', d).onchange = (e) => window.Scenes?.setLive(e.target.checked ? 'aurora' : 'off');
  api('/api/app/info').then((i) => ($('#frWhere').textContent = i.songs_where
    ? `On this phone, in ${i.songs_where}. They show up in your Files app and other music players, and they stay if you uninstall Spin.`
    : 'In your Music folder, under OddlyClever Music. Nothing is uploaded anywhere.')).catch(() => ($('#frWhere').textContent = 'In your Music folder, on this device.'));
  show();
  openDlg('firstRun', $('[data-fr-go=next]', d));
}

$('#settings').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-pick], [data-mode-pick], [data-motion-pick]');
  if (!b) return;
  const d = b.dataset;
  setting(d.themePick ? { theme: d.themePick } : d.modePick ? { mode: d.modePick } : { motion: d.motionPick });
  $(`#settings [data-${d.themePick ? 'theme' : d.modePick ? 'mode' : 'motion'}-pick="${d.themePick || d.modePick || d.motionPick}"]`)?.focus();
});
$('#setAlbum').onchange = (e) => setting({ albumColours: e.target.checked });
$('#setAurora').onchange = (e) => setting({ aurora: e.target.checked });
$('#setFonts').onchange = (e) => setting({ webFonts: e.target.checked });
document.addEventListener('fx:settings', () => { if (!$('#settings').hidden) paintSettings(); });
$('#settingsBtn').onclick = openSettings;
// Sidebar shortcut straight to the Windows / Android downloads (pointless inside the Android app itself).
$('#getAppNav').hidden = !!window.OCMNative;
$('#getAppNav').onclick = () => { openSettings(); setTimeout(() => $('#getApp').scrollIntoView({ block: 'start', behavior: motionOff() ? 'auto' : 'smooth' }), 350); };  // after the dialog's open spring
$('#topSettings').onclick = openSettings;
const openKeys = () => openDlg('keys');

// ---------- menus: a popup on desktop, a bottom sheet on touch / phone / tablet ----------
const useSheet = () => touch() || !desktop();
function openMenu(x, y, items, head) {
  if (useSheet()) return openSheet(items, head);
  const m = $('#menu');
  m.innerHTML = '';
  for (const it of items) {
    if (it === '-') { m.append(document.createElement('hr')); continue; }
    const b = document.createElement('button');
    b.setAttribute('role', 'menuitem');
    b.textContent = it.label; if (it.danger) b.className = 'danger';
    b.onclick = (e) => { e.stopPropagation(); if (it.sub) openMenu(x, y, it.sub, head); else { closeMenu(); it.do(); } };
    m.append(b);
  }
  m.hidden = false; ovOpen('menu', false);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  m.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  m.querySelector('button')?.focus();
}
function closeMenu() { $('#menu').hidden = true; ovClosed('menu'); }
OV.close.menu = closeMenu;
document.addEventListener('click', (e) => { if (!e.target.closest('#menu')) closeMenu(); });
$('#menu').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault(); e.stopPropagation();
  const bs = $$('#menu button'), i = bs.indexOf(document.activeElement);
  bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus();
});

let sheetOpener = null;
function openSheet(items, head) {
  const w = $('#sheet'), h = $('.sheet-head', w), body = $('.sheet-body', w);
  h.hidden = !head;
  if (head) h.innerHTML = `${head.img ? `<img alt="" src="${esc(head.img)}">` : ''}<div class="sheet-t"><b>${esc(head.title)}</b><span>${esc(head.sub || '')}</span></div>`;
  body.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button class="sheet-item${it.danger ? ' danger' : ''}" role="menuitem" data-i="${i}"><span class="sheet-ico">${svg(it.icon || (it.sub ? 'more' : 'jump'))}</span><span class="sheet-txt">${esc(it.label)}</span>${it.note ? `<span class="sheet-sub">${esc(it.note)}</span>` : ''}</button>`)).join('');
  body.onclick = (e) => {
    const it = items[+e.target.closest('.sheet-item')?.dataset.i];
    if (!it) return;
    if (it.sub) return openSheet(it.sub, head);
    closeSheet(); it.do();
  };
  if (w.hidden) { sheetOpener = document.activeElement; ovOpen('sheet'); }
  w.hidden = false; H.dataset.sheet = 'open';
  body.scrollTop = 0;
  $('.sheet-item', body)?.focus({ preventScroll: true });
}
function closeSheet() {
  const w = $('#sheet'); if (w.hidden) return;
  w.hidden = true; H.dataset.sheet = 'closed'; ovClosed('sheet');
  $('.sheet', w).classList.remove('swipe-commit-down', 'is-dragging');
  sheetOpener?.focus?.({ preventScroll: true }); sheetOpener = null;
}
OV.close.sheet = closeSheet;
$('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) closeSheet(); });

function menuPoint(e) {
  if (e.clientX || e.clientY) return [e.clientX, e.clientY];
  const r = (e.currentTarget?.getBoundingClientRect ? e.currentTarget : e.target).getBoundingClientRect();
  return [r.left + 24, r.bottom];
}
function trackMenu(e, id, ctx = {}) {
  e.preventDefault(); e.stopPropagation();
  const t = Q(id); if (!t) return;
  if (!T(id)) return openMenu(...menuPoint(e), [ // a catalogue song you don't have yet
    { label: 'Play next', icon: 'next', do: () => playNext([id]) },
    { label: 'Add to Up next', icon: 'queue', do: () => addToQueue([id]) },
    { label: jobFor(id) ? 'Getting it…' : 'Get — save to your library', icon: 'get', do: () => jobFor(id) || getSongs([t]) },
    ...(t.album_id || t.artist_id ? ['-'] : []),
    ...(t.album_id ? [{ label: 'Go to album', icon: 'album', do: () => go('album', CAT + t.album_id) }] : []),
    ...(t.artist_id ? [{ label: 'Go to artist', icon: 'artist', do: () => go('artist', CAT + t.artist_id) }] : []),
  ], { img: cover(t), title: t.title, sub: t.artist });
  const items = [
    { label: 'Play next', icon: 'next', do: () => playNext([id]) },
    { label: 'Add to Up next', icon: 'queue', do: () => addToQueue([id]), note: S.queue.length > S.qi + 1 ? `${ordinal(S.queue.length - S.qi)} in line` : '' },
    { label: 'Add to playlist…', icon: 'plus', sub: [{ label: 'New playlist', icon: 'plus', do: () => newPlaylist([id]) }, ...lib.playlists.map((p) => ({ label: p.name, icon: 'queue', do: () => addToPlaylist(p.id, [id]) }))] },
    { label: t.liked ? 'Unlike' : 'Like', icon: t.liked ? 'heartO' : 'heart', do: () => like(id, undefined, e.target.closest('.row, .qrow, .card, .gs-item')?.querySelector('.like')) },
    '-',
    { label: 'Go to album', icon: 'album', do: () => go('album', t.album_id ? CAT + t.album_id : albumKey(t)) },
    { label: 'Go to artist', icon: 'artist', do: () => go('artist', t.artist_id ? CAT + t.artist_id : mainArtist(t)) },
    { label: 'Edit song info', icon: 'edit', do: () => editInfo(id) },
    ...(t.source === 'local' ? [] : [{ label: 'Fix song info', icon: 'tune', do: () => fixInfo([id]) }]),
  ];
  if (ctx.playlist) {
    const p = lib.playlists.find((x) => x.id === ctx.playlist), n = p.tracks.length;
    if (touch()) items.push({ label: 'Move…', icon: 'up', sub: [
      { label: 'Move to top', icon: 'up', do: () => movePlaylistTrack(p.id, ctx.index, 0) },
      { label: 'Move up', icon: 'up', do: () => movePlaylistTrack(p.id, ctx.index, ctx.index - 1) },
      { label: 'Move down', icon: 'down', do: () => movePlaylistTrack(p.id, ctx.index, Math.min(n - 1, ctx.index + 1)) },
    ] });
    items.push({ label: 'Remove from this playlist', icon: 'x', do: () => savePlaylist({ id: p.id, tracks: p.tracks.filter((x, i) => i !== ctx.index) }).then(render) });
  }
  if (ctx.queueIndex != null) {
    const i = ctx.queueIndex;
    if (touch()) items.push({ label: 'Move…', icon: 'up', sub: [
      { label: 'Move to top', icon: 'up', do: () => moveQueue(i, Math.min(i, S.qi + 1)) },
      { label: 'Move up', icon: 'up', do: () => moveQueue(i, i - 1) },
      { label: 'Move down', icon: 'down', do: () => moveQueue(i, i + 1) },
    ] });
    items.push({ label: 'Remove from Up next', icon: 'x', do: () => removeFromQueue(i) });
  }
  items.push('-', { label: 'Move file to Recycle Bin', icon: 'trash', danger: true, do: () => removeTrack(id) });
  openMenu(...menuPoint(e), items, { img: cover(t), title: t.title, sub: t.artist });
}
const ordinal = (n) => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function listMenu(e, ids, head, extra = []) {
  e.preventDefault(); e.stopPropagation();
  const mine = ids.filter(T); // only songs you have can go in a playlist
  openMenu(...menuPoint(e), [
    { label: 'Play', icon: 'play', do: () => playList(ids) },
    { label: 'Shuffle', icon: 'shuffle', do: () => { S.shuffle = true; playList(ids, Math.floor(Math.random() * ids.length)); paintControls(); } },
    { label: 'Play next', icon: 'next', do: () => playNext(ids) },
    { label: 'Add to Up next', icon: 'queue', do: () => addToQueue(ids) },
    ...(mine.length ? [{ label: 'Add to playlist…', icon: 'plus', sub: [{ label: 'New playlist', icon: 'plus', do: () => newPlaylist(mine) }, ...lib.playlists.map((p) => ({ label: p.name, icon: 'queue', do: () => addToPlaylist(p.id, mine) }))] }] : []),
    ...extra,
  ], head);
}
// Re-tag songs from the music catalogue: clean title, artist, album and a square cover. Files are never moved or deleted.
async function fixInfo(ids) {
  if (!ids && !await ask('Fix song info?', 'Looks up your songs in the music catalogue and swaps messy titles, artists and video thumbnails for clean info and square album covers. Your files stay where they are.', { ok: 'Fix them' })) return;
  toast(ids ? 'Fixing song info…' : 'Fixing song info for your library…');
  $$('[data-a=fixall]').forEach((b) => (b.disabled = true));
  try {
    const r = await api('/api/fix-info', ids ? { ids } : {});
    const n = Array.isArray(r.fixed) ? r.fixed.length : +r.fixed || 0;
    await loadLib(); render(); paintNow(); paintQueues();
    toast(n ? `Fixed ${plural(n, 'song')}` : 'Nothing needed fixing');
  } catch (e) { toast(`Couldn't fix song info: ${e.message}`); }
  $$('[data-a=fixall]').forEach((b) => (b.disabled = false));
}
async function editInfo(id) {
  const t = T(id);
  const title = await ask('Edit song info', 'Title', { input: t.title, ok: 'Next' }); if (title == null) return;
  const artist = await ask('Edit song info', 'Artist', { input: t.artist, ok: 'Next' }); if (artist == null) return;
  const album = await ask('Edit song info', 'Album (leave empty for none)', { input: t.album || ' ', ok: 'Save' }); if (album == null) return;
  lib.tracks[id] = await api('/api/track', { id, title, artist, album: album.trim() });
  render(); paintNow();
}
async function removeTrack(id) {
  const t = T(id);
  if (!await ask('Move to the Recycle Bin?', `“${t.title}” goes to the Recycle Bin. You can restore it from there.`, { ok: 'Move to Recycle Bin', danger: true })) return;
  const playing = S.queue[S.qi] === id;
  if (playing) { audio.pause(); audio.removeAttribute('src'); }
  await api('/api/track/remove', { id });
  S.queue = S.queue.filter((x) => x !== id); S.qi = Math.min(S.qi, S.queue.length - 1);
  await loadLib(); render(); paintNow(); paintQueues(); save();
  toast('Moved to the Recycle Bin');
}
function removeFromQueue(i) {
  const playing = i === S.qi;
  S.queue.splice(i, 1);
  if (i < S.qi) S.qi--;
  if (playing) { S.qi = Math.min(S.qi, S.queue.length - 1); S.qi >= 0 ? load(!audio.paused) : audio.pause(); }
  save(); paintQueues(); paintNow();
}

// ---------- grouping ----------
const mainArtist = (t) => (t.artist || 'Unknown artist').split(/,|&| feat\.? | ft\.? /i)[0].trim();
const albumKey = (t) => `${t.album || 'Singles'}\u0001${mainArtist(t)}`;
function sortTracks(list, by = S.sort) {
  const f = {
    added: (a, b) => b.added - a.added,
    title: (a, b) => a.title.localeCompare(b.title),
    artist: (a, b) => mainArtist(a).localeCompare(mainArtist(b)) || a.title.localeCompare(b.title),
    plays: (a, b) => b.plays - a.plays || b.lastPlayed - a.lastPlayed,
  }[by];
  return [...list].sort(f);
}
function groupBy(list, key) {
  const m = new Map();
  for (const t of list) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  return m;
}

// ---------- navigation + history (back/forward buttons, Alt+arrows, Android back) ----------
const LIB_VIEWS = ['library', 'songs', 'albums', 'artists', 'liked', 'playlist', 'album', 'artist', 'get'];
function go(view, arg = null, push = true) {
  // A page change closes the layers on top of it (search, Now Playing, the phone pane); menus close themselves.
  if (push) for (const n of [...OV.stack].reverse()) if (n !== 'menu' && n !== 'sheet') OV.close[n]();
  const last = NAV.want || { view: S.view, arg: S.arg };
  if (push && !(view === last.view && arg === last.arg)) {
    NAV.p++; NAV.len = NAV.p;
    pushHist({ v: view, a: arg, p: NAV.p });
  }
  NAV.want = { view, arg };
  vt(() => { // a transition callback can run late: always show the newest request, never an older one
    ({ view, arg } = NAV.want);
    S.view = view; S.arg = arg; S.filter = ''; S.chip = 'all'; S.popMore = false;
    H.dataset.view = view; save(); render(); $('#main').scrollTop = 0;
    fx('enter', $('#main'));
  }, { kind: 'page' });
  paintNavBtns();
}
function paintNavBtns() { $('#navBack').disabled = NAV.p <= 0; $('#navFwd').disabled = NAV.p >= NAV.len; }
$('#navBack').onclick = () => history.back();
$('#navFwd').onclick = () => history.forward();
window.addEventListener('popstate', (e) => {
  const st = e.state || {};
  if (NAV.skip) { if (!--NAV.skip) NAV.queue.splice(0).forEach((s) => history.pushState(s, '')); return; }
  OV.stack.filter((n) => n === 'menu' || (n === 'search' && desktop())).forEach((n) => OV.close[n]());
  if (OV.stack.length) return void OV.close[OV.stack.at(-1)]();
  if (st.ov || !st.v) return; // an overlay entry left behind by a forward step: nothing to show
  NAV.p = st.p || 0; NAV.len = Math.max(NAV.len, NAV.p);
  go(st.v, st.a ?? null, false);
});
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) go(b.dataset.view, b.dataset.arg || null); });
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  const v = b.dataset.view;
  if (b.classList.contains('on') && v !== 'search') return $('#main').scrollTo({ top: 0, behavior: motionOff() ? 'auto' : 'smooth' });
  if (v === 'search') { go('search', null); gsIn.focus(); openSearch(); } else go(v);
});
$('#topGet').onclick = () => go('get');

function renderNav() {
  $('#plNav').innerHTML = lib.playlists.map((p) => `<button data-view="playlist" data-arg="${esc(p.id)}"><span class="nv-ico pl-dot" style="--h:${hue(p.id)}"></span><span class="nv-txt">${esc(p.name)}</span></button>`).join('');
  $$('#nav button[data-view]').forEach((b) => {
    const on = b.dataset.view === S.view && (b.dataset.arg || null) === (S.view === 'playlist' ? S.arg : null);
    b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  const tab = S.view === 'home' || S.view === 'shelf' ? 'home' : S.view === 'search' ? 'search' : S.view === 'downloads' ? 'downloads' : LIB_VIEWS.includes(S.view) ? 'library' : '';
  $$('#tabbar .tab').forEach((b) => { const on = b.dataset.view === tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  // Drop songs from a list onto a playlist name to add them.
  $$('#plNav button').forEach((b) => {
    b.ondragover = (e) => { if (e.dataTransfer.types.includes('text/ocm-track')) { e.preventDefault(); b.classList.add('drop'); } };
    b.ondragleave = () => b.classList.remove('drop');
    b.ondrop = (e) => { e.preventDefault(); b.classList.remove('drop'); addToPlaylist(b.dataset.arg, [e.dataTransfer.getData('text/ocm-track')]); };
  });
}

// ---------- building blocks ----------
const GRIP = `<button class="grip ico" aria-label="Drag to reorder">${svg('grip')}</button>`;
const likeBtn = (t) => `<button class="ico like${t.liked ? ' on' : ''}" aria-label="Like" aria-pressed="${!!t.liked}">${svg(t.liked ? 'heart' : 'heartO')}</button>`;
const getCell = (t) => (jobFor(t.id) ? '<span class="got">Getting…</span>' : `<button class="pill sm get" aria-label="Get ${esc(t.title)}">Get</button>`);
// Rows take library tracks or catalogue songs; a song you don't have yet is a remote row (Get instead of like).
function rowsHTML(list, { numbered = false, playlist = null, trackNo = false } = {}) {
  if (!list.length) return '';
  const drag = touch() ? '' : ' draggable="true"', grip = touch() && playlist ? GRIP : '';
  return `<div class="rows">${list.map((s, i) => { const t = T(s.id) || remember(s), remote = !T(s.id); return `
    <div class="row" data-id="${esc(t.id)}" data-i="${i}"${remote ? ' data-remote="1"' : drag} tabindex="0">
      <span class="n">${trackNo ? s.track_no || i + 1 : numbered ? i + 1 : ''}</span>
      <span class="thumb"><img loading="lazy" src="${esc(cover(t))}" alt=""><span class="eq" aria-hidden="true"></span></span>
      <div class="t"><b>${esc(t.title)}</b><span>${!remote && t.codec ? `<i class="spec">${esc(codecTag(t.codec).split(' ')[0])}</i>` : ''}${esc(t.artist || 'Unknown artist')}</span></div>
      <span class="al">${esc(t.album)}</span>
      ${remote ? `<span class="d">${t.duration ? fmt(t.duration) : ''}</span>${getCell(t)}` : `${likeBtn(t)}<span class="d">${fmt(t.duration)}</span>`}
      <button class="ico more" aria-label="More">${svg('more')}</button>${grip}
    </div>`; }).join('')}</div>`;
}
function wireRows(root, list, ctx = {}) {
  const ids = list.map((t) => t.id);
  root.querySelectorAll('.row[data-id]').forEach((row) => {
    const i = +row.dataset.i, id = row.dataset.id;
    row.onclick = (e) => {
      if (e.target.closest('.get')) return getSongs([Q(id)]);
      const lb = e.target.closest('.like'); if (lb) return like(id, undefined, lb);
      if (e.target.closest('.more')) return trackMenu(e, id, { ...ctx, index: i });
      if (e.target.closest('.grip')) return;
      playList(ids, i);
    };
    row.onkeydown = (e) => { if (e.key === 'Enter' && e.target === row) playList(ids, i); };
    row.oncontextmenu = (e) => trackMenu(e, id, { ...ctx, index: i });
    row.ondragstart = (e) => { e.dataTransfer.setData('text/ocm-track', id); e.dataTransfer.setData('text/ocm-index', String(i)); row.classList.add('dragging'); };
    row.ondragend = () => row.classList.remove('dragging');
    if (ctx.playlist) { // drag to reorder inside a playlist
      row.ondragover = (e) => { e.preventDefault(); row.classList.add('over'); };
      row.ondragleave = () => row.classList.remove('over');
      row.ondrop = (e) => { e.preventDefault(); row.classList.remove('over'); movePlaylistTrack(ctx.playlist, +e.dataTransfer.getData('text/ocm-index'), i); };
      const g = row.querySelector('.grip');
      if (g) g.onpointerdown = (e) => gripDrag(e, row, (from, to) => movePlaylistTrack(ctx.playlist, from, to));
    }
  });
  highlightRows();
}
function highlightRows() {
  const id = S.queue[S.qi];
  $$('.row[data-id]').forEach((r) => r.classList.toggle('cur', r.dataset.id === id));
}

function cardsHTML(items, round = false) {
  return `<div class="cards">${items.map((c, i) => c.mix ? `
    <button class="card mix" data-i="${i}" data-mix="${c.mix}" style="--mix-h:${c.h}">
      <div class="cv"><span class="mix-name">${c.name}</span><span class="mix-art">${c.arts.map((a) => `<img loading="lazy" src="${esc(a)}" alt="">`).join('')}</span><span class="go">${svg('play')}</span></div>
      <b>${esc(c.title)}</b><span class="sub">${esc(c.sub)}</span>
    </button>` : `
    <button class="card${round ? ' round' : ''}" data-i="${i}"${c.coverSrc ? ` data-cover-src="${esc(c.coverSrc)}"` : ''}>
      <div class="cv"><img loading="lazy" src="${esc(c.img)}" alt="">${c.play ? `<span class="go">${svg('play')}</span>` : ''}${c.spec ? `<span class="spec cv-spec"><i style="background:${c.swatch}"></i>${esc(c.spec)}</span>` : ''}</div>
      <b>${esc(c.title)}</b><span class="sub">${esc(c.sub)}</span>
    </button>`).join('')}</div>`;
}
function wireCards(root, items) {
  root.querySelectorAll(':scope .card').forEach((el) => {
    const c = items[+el.dataset.i]; if (!c) return;
    el.onclick = (e) => (e.target.closest('.go') && c.play ? c.play() : c.open());
    if (c.menu) el.oncontextmenu = c.menu;
  });
}
const albumCards = (groups) => [...groups].map(([k, ts]) => {
  const ids = ts.map((t) => t.id), name = ts[0].album || 'Singles';
  return { kind: 'album', id: k, title: name, sub: mainArtist(ts[0]), img: cover(ts[0]), open: () => go('album', k), play: () => playList(ids),
    menu: (e) => listMenu(e, ids, { img: cover(ts[0]), title: name, sub: mainArtist(ts[0]) }, [{ label: 'Go to artist', icon: 'artist', do: () => go('artist', mainArtist(ts[0])) }]) };
});
const artistCards = (groups) => groups.map(([name, ts]) => ({ kind: 'artist', id: name, title: name, sub: plural(ts.length, 'song'), img: cover(ts[0]), open: () => go('artist', name),
  play: () => playList(sortTracks(ts, 'plays').map((t) => t.id)),
  menu: (e) => listMenu(e, sortTracks(ts, 'plays').map((t) => t.id), { img: cover(ts[0]), title: name, sub: plural(ts.length, 'song') }) }));

// ---------- shelves + tiles (home, catalogue pages, search) ----------
// A tile item: { kind: song|album|artist|mix, id, img, title, sub, badge?, open, play?, menu? }. Shelves are kept by key for Show all.
const SH = {};
function tileHTML(it, i) {
  const art = `<img loading="lazy" src="${esc(it.img)}" alt="">`;
  return `<article class="tile" data-kind="${it.kind}" data-id="${esc(it.id)}" data-i="${i}" tabindex="0">` +
    `<div class="tile-art">${art}${it.play ? `<button class="tile-play ico" aria-label="Play ${esc(it.title)}">${svg('play')}</button>` : ''}${it.badge ? `<span class="tile-badge">${esc(it.badge)}</span>` : ''}</div>` +
    `<b class="tile-title">${esc(it.title)}</b><span class="tile-sub">${esc(it.sub || '')}</span></article>`;
}
const SHELF_TOOLS = `<button class="ico shelf-prev" aria-label="Scroll left">${svg('back')}</button><button class="ico shelf-next" aria-label="Scroll right">${svg('fwd')}</button>`;
function shelfHTML(key, title, kind, items) {
  if (!items.length) return '';
  SH[key] = { title, kind, items };
  return `<section class="shelf" data-kind="${kind}" data-shelf="${esc(key)}"><header class="shelf-head"><h2>${esc(title)}</h2><div class="shelf-tools">${items.length > 6 ? '<button class="shelf-all">Show all</button>' : ''}${SHELF_TOOLS}</div></header>` +
    `<div class="shelf-track">${items.map(tileHTML).join('')}</div></section>`;
}
const SKEL_TILE = '<article class="tile skeleton" aria-hidden="true"><div class="tile-art"></div><b class="tile-title"></b><span class="tile-sub"></span></article>';
const skelShelf = (kind = 'albums') => `<section class="shelf" data-kind="${kind}" aria-hidden="true"><header class="shelf-head"><h2><span class="skel skel-line"></span></h2></header><div class="shelf-track">${SKEL_TILE.repeat(8)}</div></section>`;
// Quick picks: a dense grid of songs (3 columns x 4 rows on desktop).
function quickHTML(list) {
  if (!list.length) return '';
  SH.quick = { title: 'Quick picks', kind: 'songs', items: songTiles(list) };
  return `<section class="shelf" data-kind="quick" data-shelf="quick"><header class="shelf-head"><h2>Quick picks</h2><div class="shelf-tools">${SHELF_TOOLS}</div></header><div class="quick-grid">${list.map((s, i) => {
    const t = T(s.id) || remember(s);
    return `<div class="qp" data-id="${esc(t.id)}" data-i="${i}" tabindex="0"><img loading="lazy" src="${esc(cover(t))}" alt=""><div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><button class="ico qp-play" aria-label="Play ${esc(t.title)}">${svg('play')}</button><button class="ico qp-more" aria-label="More">${svg('more')}</button></div>`;
  }).join('')}</div></section>`;
}
function wireTiles(root, items) {
  root.querySelectorAll('.tile[data-i]').forEach((el) => {
    const it = items[+el.dataset.i]; if (!it) return;
    el.onclick = (e) => (e.target.closest('.tile-play') && it.play ? it.play() : it.open());
    el.onkeydown = (e) => { if (e.key === 'Enter' && e.target === el) it.open(); };
    if (it.menu) el.oncontextmenu = it.menu;
  });
}
function wireShelves(root) {
  root.querySelectorAll('.shelf[data-shelf]').forEach((sec) => {
    const key = sec.dataset.shelf, sh = SH[key], track = sec.querySelector('.shelf-track, .quick-grid');
    const pb = sec.querySelector('.shelf-prev'), nb = sec.querySelector('.shelf-next');
    const ends = () => { pb.disabled = track.scrollLeft < 4; nb.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4; };
    const by = (d) => track.scrollBy({ left: d * track.clientWidth * 0.9, behavior: motionOff() ? 'auto' : 'smooth' });
    pb.onclick = () => by(-1); nb.onclick = () => by(1);
    track.addEventListener('scroll', ends, { passive: true }); ends();
    if (key === 'quick') setTimeout(() => [...track.querySelectorAll('.qp[data-id]')].filter((q) => !T(q.dataset.id)).slice(0, 3).forEach((q) => prepare(q.dataset.id, true)), 1500);
    sec.querySelector('.shelf-all')?.addEventListener('click', () => go('shelf', key));
    if (key !== 'quick') return wireTiles(sec, sh.items);
    sec.querySelectorAll('.qp').forEach((el) => {
      const it = sh.items[+el.dataset.i];
      el.onclick = (e) => (e.target.closest('.qp-more') ? it.menu(e) : it.play());
      el.onkeydown = (e) => { if (e.key === 'Enter' && e.target === el) it.play(); };
      el.oncontextmenu = it.menu;
    });
  });
}

// ---------- the music catalogue (DATA's /api/artist, /api/album, /api/discover) ----------
// Catalogue pages reuse the album/artist views with arg = CAT + id; library pages keep name keys.
const CAT = '\u0002', isCat = (a) => typeof a === 'string' && a[0] === CAT;
const playSongs = (list, i = 0) => playList(list.map((s) => (T(s.id) || remember(s)).id), i);
const songTiles = (list) => list.map((s, i) => {
  const t = T(s.id) || remember(s);
  return { kind: 'song', id: t.id, img: cover(t), title: t.title, sub: t.artist, badge: T(t.id) ? 'In library' : '', open: () => playSongs(list, i), play: () => playSongs(list, i), menu: (e) => trackMenu(e, t.id) };
});
const albumTiles = (list, onArtist = false) => list.map((a) => ({ kind: 'album', id: a.id, img: a.cover || blankCover(a.title), title: a.title,
  sub: onArtist ? [a.year, a.type !== 'Album' && a.type].filter(Boolean).join(' · ') : [a.type && a.type !== 'Album' ? a.type : '', a.artist].filter(Boolean).join(' · '),
  open: () => go('album', CAT + a.id), play: () => playPage('album', a.id), menu: (e) => albumMenu(e, a) }));
const artistTiles = (list) => list.map((a) => ({ kind: 'artist', id: a.id, img: a.photo || blankCover(a.name), title: a.name, sub: 'Artist',
  open: () => go('artist', CAT + a.id), play: () => playPage('artist', a.id) }));
const shelfTiles = (sh) => (sh.kind === 'albums' ? albumTiles(sh.items) : sh.kind === 'artists' ? artistTiles(sh.items) : songTiles(sh.items));
function albumMenu(e, a) {
  e.preventDefault(); e.stopPropagation();
  openMenu(...menuPoint(e), [
    { label: 'Play', icon: 'play', do: () => playPage('album', a.id) },
    { label: `Get ${typeWord(a.type)}`, icon: 'get', do: () => getPage('album', a.id) },
    ...(a.artist_id ? [{ label: 'Go to artist', icon: 'artist', do: () => go('artist', CAT + a.artist_id) }] : []),
  ], { img: a.cover, title: a.title, sub: a.artist });
}
// One fetch per page, shared by the page view and tile Play buttons. An error sticks until "Try again" (no retry loop on render).
const PAGE = {};
function page(kind, id) {
  const k = `${kind}:${id}`;
  if (PAGE[k]) return PAGE[k];
  const e = (PAGE[k] = {});
  e.p = api(`/api/${kind}?id=${encodeURIComponent(id)}`).then((d) => (e.data = d), (err) => { e.err = err.message; throw err; });
  e.p.catch(() => {}).then(() => {
    if (!['album', 'artist'].includes(S.view) || !isCat(S.arg)) return;
    render();
    if (S.view === kind && S.arg === CAT + id) fx('enter', $('#main'));
  });
  return e;
}
// The same song can have another video id in search than on its album page, so match yours by album + title too.
const albumTracks = (a) => (a.tracks || []).map((s) => T(s.id) || allTracks().find((t) => t.album_id === a.id && norm(t.title) === norm(s.title)) || remember({ ...s, cover: s.cover || a.cover_hd || a.cover, album: s.album || { name: a.title, id: a.id },
  artist: s.artist || a.artist, artist_id: s.artist_id || s.artists?.[0]?.id || a.artist_id, year: s.year || a.year }));
async function pageSongs(kind, id) {
  if (PAGE[`${kind}:${id}`]?.err) delete PAGE[`${kind}:${id}`];
  const pg = page(kind, id); await pg.p;
  return kind === 'album' ? albumTracks(pg.data) : (pg.data.songs || []).map(remember);
}
async function playPage(kind, id) { try { playSongs(await pageSongs(kind, id)); } catch (e) { toast(`Can't play that right now: ${e.message}`); } }
async function getPage(kind, id) {
  try { const want = (await pageSongs(kind, id)).filter((s) => !T(s.id) && !jobFor(s.id)); want.length ? getSongs(want) : toast('Already in your library'); }
  catch (e) { toast(`Can't get that right now: ${e.message}`); }
}
const region = () => store.get('region', 'GB');
const REGIONS = ['GB', 'US', 'IE', 'CA', 'AU', 'NZ', 'IN', 'PK', 'NG', 'ZA', 'KE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK', 'PL', 'PT', 'BR', 'MX', 'AR', 'CO', 'JP', 'KR', 'PH', 'ID', 'TR', 'AE'];
const DISC = {}; // region -> { data } | { err, at } | {} while loading
function discover() {
  const r = region(), d = DISC[r];
  if (d && !(d.err && Date.now() - d.at > 60000)) return d;
  const e = (DISC[r] = {});
  api(`/api/discover?region=${r}`).then((x) => (e.data = x), (err) => Object.assign(e, { err: err.message, at: Date.now() }))
    .then(() => { if (S.view === 'home' && region() === r) render(); });
  return e;
}

function hero(kind, title, { sub = '', subHTML = '', art = null, round = false, eyebrow = '', track = null, src = null, banner = null, actions = '', specs = null } = {}) {
  src = src || (track?.cover ? cover(track) : null);
  return `<header class="hero" data-kind="${kind}"${src ? ` data-cover-src="${esc(src)}"` : ''}>` +
    (banner ? `<div class="hero-banner" style="background-image:${esc(`url("${banner}")`)}"></div>` : art ? `<img class="hero-art${round ? ' round' : ''}" src="${esc(art)}" alt="">` : '') +
    `<div class="hero-txt">${eyebrow ? `<span class="hero-type">${esc(eyebrow)}</span>` : ''}<h1 class="hero-title">${esc(title)}</h1>` +
    `${sub || subHTML ? `<div class="hero-sub">${subHTML || esc(sub)}</div>` : ''}${specs ? specsHTML(specs) : ''}${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div></header>`;
}
// Play + Shuffle (+ extra buttons): inside the hero as .hero-actions, or in .actions where there is no hero.
const actionBtns = (ids, extra = '') => `${ids.length ? `<button class="pill hot" data-a="play">${svg('play')} Play</button><button class="pill" data-a="shuffle">${svg('shuffle')} Shuffle</button>` : ''}${extra}`;
const listActions = (ids, extra = '') => (ids.length || extra ? `<div class="actions">${actionBtns(ids, extra)}</div>` : '');
function wireActions(root, ids) {
  root.querySelector('[data-a=play]')?.addEventListener('click', () => { S.shuffle = false; playList(ids); paintControls(); });
  root.querySelector('[data-a=shuffle]')?.addEventListener('click', () => { S.shuffle = true; playList(ids, Math.floor(Math.random() * ids.length)); paintControls(); });
}
// Empty states: one friendly line and one button (data-empty names the action).
const EMPTY = { retry: () => { for (const k in PAGE) if (PAGE[k].err) delete PAGE[k]; render(); }, upd: () => updateEngine(), get: () => go('get'), songs: () => go('songs'), search: () => { gsIn.focus(); openSearch(); }, library: () => go('library'), play: () => togglePlay() };
const empty = (headline, line, label, act) => `<div class="empty"><b>${headline}</b>${line}${act ? `<br><button class="pill hot" data-empty="${act}">${label}</button>` : ''}</div>`;
document.addEventListener('click', (e) => { const b = e.target.closest('[data-empty]'); if (b) EMPTY[b.dataset.empty]?.(); });
const emptyLib = () => empty('Your shelf is empty', 'Search at the top to find songs, paste a link, or drop your own files in the music folder.', 'Add music', 'get');
const skelCards = (n) => `<div class="cards">${'<div class="skel skel-card" aria-hidden="true"></div>'.repeat(n)}</div>`;
const skelRows = (n) => '<div class="skel skel-row" aria-hidden="true"></div>'.repeat(n);
const skelPage = () => `<header class="hero"><div class="hero-txt"><div class="skel skel-line" aria-hidden="true"></div><div class="skel skel-line" aria-hidden="true"></div></div></header>${skelCards(6)}${skelRows(6)}`;

function totalTime(ts) { const m = Math.round(ts.reduce((a, t) => a + (t.duration || 0), 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; }

// A song list page: hero, actions, sort/filter, rows. opts.bare skips the hero (used inside Library).
function songList(root, title, list, opts = {}) {
  const sorts = opts.sortable ? `<div class="chips sort" role="group" aria-label="Sort">${['added', 'title', 'artist', 'plays'].map((s) => `<button class="chip" data-s="${s}" aria-pressed="${S.sort === s}">${{ added: 'Recently added', title: 'Title', artist: 'Artist', plays: 'Most played' }[s]}</button>`).join('')}<input class="filter" placeholder="Filter songs" value="${esc(S.filter || '')}" aria-label="Filter songs"></div>` : '';
  let shown = opts.sortable ? sortTracks(list) : list;
  const q = norm(S.filter || '');
  if (q) shown = shown.filter((t) => norm(`${t.title} ${t.artist} ${t.album}`).includes(q));
  const ids = shown.map((t) => t.id);
  root.innerHTML = (opts.bare ? listActions(ids, opts.extra || '') : hero(opts.kind || 'songs', title, { sub: opts.sub ?? `${plural(list.length, 'song')} · ${totalTime(list)}`, art: opts.art, round: opts.round, eyebrow: opts.eyebrow, track: opts.track, specs: opts.specs, actions: actionBtns(ids, opts.extra || '') })) + sorts +
    (shown.length ? rowsHTML(shown, opts) : (allTracks().length ? empty(opts.emptyHead || 'Nothing here yet', opts.emptyMsg || '', opts.emptyBtn, opts.emptyAct) : emptyLib()));
  wireActions(root, shown.map((t) => t.id));
  wireRows(root, shown, { playlist: opts.playlist });
  root.querySelectorAll('.sort [data-s]').forEach((b) => (b.onclick = () => { S.sort = b.dataset.s; save(); render(); }));
  const f = root.querySelector('.filter');
  if (f) f.oninput = () => { S.filter = f.value; const pos = f.selectionStart; render(); const g = $('#main .filter'); g.focus(); g.setSelectionRange(pos, pos); };
}

// ---------- smart mixes, built from your own library ----------
function mixes(all) {
  const now = Date.now() / 1000, cap = (ts) => ts.slice(0, 50), used = new Set(); // each mix takes its colour from a cover no other mix used
  const plays = new Map();
  for (const t of all) plays.set(mainArtist(t), (plays.get(mainArtist(t)) || 0) + (t.plays || 0) + (t.liked ? 2 : 0));
  const top = [...plays].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [
    { mix: 'forgotten', name: 'Forgotten<br>favourites', h: 28, ts: all.filter((t) => t.liked && t.plays <= 2).sort((a, b) => a.lastPlayed - b.lastPlayed) },
    { mix: 'repeat', name: 'On<br>repeat', h: 330, ts: sortTracks(all.filter((t) => t.plays >= 2), 'plays') },
    { mix: 'fresh', name: 'Fresh<br>finds', h: 160, ts: sortTracks(all.filter((t) => t.added > now - 14 * 86400), 'added') },
    { mix: 'quick', name: 'Quick<br>hits', h: 50, ts: all.filter((t) => t.duration > 0 && t.duration < 210) },
    { mix: 'long', name: 'Long<br>listens', h: 260, ts: all.filter((t) => t.duration > 360) },
    { mix: 'like', name: `More like<br>${esc(top || '')}`, h: 200, ts: top ? sortTracks(all.filter((t) => mainArtist(t) === top), 'plays') : [] },
  ].filter((m) => m.ts.length >= 6).map((m) => {
    const ts = cap(m.ts), ids = ts.map((t) => t.id), title = m.name.replace('<br>', ' ').replace(/&amp;/g, '&');
    const arts = [...new Set(ts.map(cover))].slice(0, 4), src = ts.map(cover).find((c) => !used.has(c)) || arts[0];
    used.add(src);
    const img = genCover(title, rampOf(src, m.h), `MIX · ${ts.length}`);
    return { ...m, kind: 'mix', id: m.mix, title, sub: plural(ts.length, 'song'), arts, img, open: () => { playList(ids); toast(`Playing ${title}`); }, play: () => playList(ids),
      menu: (e) => listMenu(e, ids, { img, title, sub: plural(ts.length, 'song') }) };
  });
}
// Made for you: the mixes as colour blocks (one big, the rest small) on their generated covers, with the real art inset.
function blocksHTML(list) {
  if (!list.length) return '';
  return `<section class="shelf" data-kind="blocks"><header class="shelf-head"><h2>Made for you</h2></header><div class="cblocks">${list.map((it, i) =>
    `<article class="tile cblock" data-kind="mix" data-id="${esc(it.id)}" data-i="${i}" tabindex="0" aria-label="${esc(it.title)}, ${esc(it.sub)}"><img class="cb-cover" src="${esc(it.img)}" alt="">` +
    `<span class="cb-art" aria-hidden="true">${it.arts.slice(0, 3).map((a) => `<img loading="lazy" src="${esc(a)}" alt="">`).join('')}</span>` +
    `<button class="tile-play ico" aria-label="Play ${esc(it.title)}">${svg('play')}</button></article>`).join('')}</div></section>`;
}

// ---------- browse by colour ----------
const HUES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Mint', 'Cyan', 'Sky', 'Blue', 'Violet', 'Purple', 'Pink', 'Greys'];
const binOf = ([h, s, l]) => (s < 0.16 || l < 0.08 || l > 0.94 ? 12 : Math.round(h / 30) % 12); // 12 = greys
function albumColours(all) {
  let waiting = 0;
  const list = [...groupBy(all, albumKey)].map(([k, ts]) => { const c = lead(colourOf(cover(ts[0])))?.[0]; if (!c) waiting++; return c && { k, ts, c, bin: binOf(c) }; }).filter(Boolean);
  return { list, waiting };
}
function swatchHTML(all) {
  const { list, waiting } = albumColours(all), n = HUES.map((_, b) => list.filter((a) => a.bin === b).length);
  if (!list.length && !waiting) return '';
  return `<div class="swatches" role="group" aria-label="Browse albums by colour">${HUES.map((name, b) => `<button class="sw" data-bin="${b}" style="--c:${b < 12 ? `hsl(${b * 30} 78% 56%)` : 'linear-gradient(90deg, #2a2a2e, #d8d8dc)'}" aria-pressed="${S.libTab === 'colours' && S.hueBin === b}" aria-label="${name}: ${plural(n[b], 'album')}" title="${name}"${n[b] ? '' : ' disabled'}></button>`).join('')}</div>` +
    (waiting ? `<p class="hint">Reading cover colours… ${waiting} to go</p>` : '');
}

// ---------- views ----------
// ---------- catalogue album + artist pages ----------
function pageState(m, pg, what) {
  if (pg.err) { m.innerHTML = empty(`Couldn't open this ${what}`, esc(pg.err), 'Try again', 'retry'); return false; }
  if (!pg.data) { m.innerHTML = skelPage(); return false; }
  return true;
}
const getAllBtn = (missing, total, word) => (missing.length ? `<button class="pill get-all" data-a="getall">${svg('get')} ${missing.length < total ? `Get ${missing.length} more` : `Get ${word}`}</button>` : '<span class="got">In your library</span>');
function wireHero(m, list, menu) {
  const ids = list.map((s) => s.id);
  wireActions(m, ids);
  m.querySelector('.hero [data-a=more]')?.addEventListener('click', menu);
  m.querySelector('[data-a=getall]')?.addEventListener('click', () => getSongs(list.filter((s) => !T(s.id) && !jobFor(s.id))));
}
function catAlbum(m, id) {
  const pg = page('album', id);
  if (!pageState(m, pg, 'album')) return;
  const a = pg.data, ts = albumTracks(a), have = ts.filter((t) => T(t.id)), word = typeWord(a.type);
  const liked = have.length && have.every((t) => T(t.id).liked);
  const more = a.artist_id ? page('artist', a.artist_id).data : null;
  const others = more ? [...(more.albums || []), ...(more.singles || [])].filter((x) => x.id !== a.id) : [];
  m.innerHTML = hero('album', a.title, {
    eyebrow: a.type || 'Album', art: a.cover_hd || a.cover, src: a.cover_hd || a.cover,
    specs: [a.year, `${ts.length} TRK`, fmt(a.total_seconds || ts.reduce((n, t) => n + (t.duration || 0), 0)), have.length ? `${have.length}/${ts.length} SAVED` : ''],
    subHTML: a.artist_id ? `<button class="hero-artist" data-a="artist">${esc(a.artist)}</button>` : esc(a.artist), // year, count and length are in the specs
    actions: actionBtns(ts.map((t) => t.id), (have.length ? `<button class="ico like${liked ? ' on' : ''}" data-a="like" aria-label="Like the songs you have" aria-pressed="${!!liked}">${svg(liked ? 'heart' : 'heartO')}</button>` : '') +
      `<button class="ico more" data-a="more" aria-label="More">${svg('more')}</button>${getAllBtn(ts.filter((t) => !T(t.id)), ts.length, word)}`),
  }) + rowsHTML(ts, { trackNo: true }) + shelfHTML(`a:${a.id}:more`, `More by ${a.artist}`, 'albums', albumTiles(others, true));
  wireRows(m, ts); wireShelves(m);
  wireHero(m, ts, (e) => listMenu(e, ts.map((t) => t.id), { img: a.cover, title: a.title, sub: a.artist },
    [{ label: `Get ${word}`, icon: 'get', do: () => getPage('album', a.id) }, ...(a.artist_id ? [{ label: 'Go to artist', icon: 'artist', do: () => go('artist', CAT + a.artist_id) }] : [])]));
  m.querySelector('[data-a=artist]')?.addEventListener('click', () => go('artist', CAT + a.artist_id));
  m.querySelector('.hero [data-a=like]')?.addEventListener('click', async (e) => {
    if (!liked) fx('burst', e.currentTarget, { kind: 'heart' });
    await Promise.all(have.map((t) => api('/api/track', { id: t.id, liked: !liked }).then((x) => (lib.tracks[x.id] = x))));
    render(); paintNow();
  });
}
function catArtist(m, id) {
  const pg = page('artist', id);
  if (!pageState(m, pg, 'artist')) return;
  const ar = pg.data, songs = (ar.songs || []).map(remember), shown = songs.slice(0, S.popMore ? 10 : 5);
  const about = (ar.description || '').split(/(?<=\.)\s/)[0].slice(0, 180);
  m.innerHTML = hero('artist', ar.name, {
    eyebrow: 'Artist', banner: ar.banner || ar.photo_hd || ar.photo, src: ar.photo_hd || ar.photo, sub: about,
    actions: actionBtns(songs.map((s) => s.id), `<button class="ico more" data-a="more" aria-label="More">${svg('more')}</button>${songs.length ? getAllBtn(songs.slice(0, 10).filter((s) => !T(s.id)), Math.min(10, songs.length), 'popular songs') : ''}`),
  }) + (shown.length ? `<section class="pop"><h2>Popular</h2>${rowsHTML(shown, { numbered: true })}${songs.length > 5 ? `<button class="pill sm pop-more">${S.popMore ? 'Show less' : 'Show more'}</button>` : ''}</section>` : '') +
    shelfHTML(`ar:${id}:albums`, 'Albums', 'albums', albumTiles(ar.albums || [], true)) +
    shelfHTML(`ar:${id}:singles`, 'Singles & EPs', 'albums', albumTiles(ar.singles || [], true)) +
    shelfHTML(`ar:${id}:related`, 'Fans also like', 'artists', artistTiles(ar.related || []));
  wireRows(m, shown); wireShelves(m);
  wireHero(m, songs.slice(0, 10), (e) => listMenu(e, songs.map((s) => s.id), { img: ar.photo, title: ar.name, sub: 'Artist' }));
  m.querySelector('.pop-more')?.addEventListener('click', () => { S.popMore = !S.popMore; render(); });
}

const VIEWS = {
  // Home: greeting, Quick picks, your mixes, discover shelves (skeletons while loading), then your library shelves.
  home(m, all) {
    const h = new Date().getHours();
    const hi = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const d = discover(), shelves = d.data?.shelves || [];
    const top = shelves.find((s) => s.kind === 'songs')?.items || [];
    const quick = [...sortTracks(all, 'plays').slice(0, 12), ...top.filter((s) => !T(s.id))].slice(0, 12);
    const back = [...all].filter((t) => t.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed);
    const liked = all.filter((t) => t.liked);
    const lists = [
      ['l:back', 'Jump back in', 'albums', albumCards([...groupBy(back, albumKey)].slice(0, 16))],
      ['l:fresh', 'Fresh on the shelf', 'songs', songTiles(sortTracks(all, 'added').slice(0, 20))],
      ['l:repeat', 'On repeat', 'songs', songTiles(sortTracks(all.filter((t) => t.plays > 1), 'plays').slice(0, 20))],
      ['l:artists', 'Your artists', 'artists', artistCards([...groupBy(all, mainArtist)].sort((a, b) => b[1].length - a[1].length).slice(0, 16))],
    ];
    const disc = d.data ? shelves.map((s) => shelfHTML(`d:${s.id}`, s.title, s.kind, shelfTiles(s))).join('')
      : d.err ? '' : (quick.length ? '' : skelShelf('quick')) + skelShelf('songs') + skelShelf('albums') + skelShelf('artists');
    const mix = mixes(all);
    m.innerHTML = `<p class="home-greet">${hi}</p>` + quickHTML(quick) + blocksHTML(mix) + disc +
      lists.filter((l) => l[3].length > 1).map(([k, t, kind, items]) => shelfHTML(k, t, kind, items)).join('') + // a one-item shelf looks unfinished
      (!all.length && d.err ? empty("Can't reach the music catalogue", 'Your own songs show here once you add some.', 'Add music', 'get') : '') +
      (liked.length ? `<div class="actions"><button class="pill hot" id="playLiked">${svg('heart')} Play your ${plural(liked.length, 'liked song')}</button><button class="pill" id="mixAll">${svg('shuffle')} Shuffle everything</button></div>` : '');
    wireShelves(m);
    const blocks = m.querySelector('.cblocks'); if (blocks) wireTiles(blocks, mix);
    $('#playLiked')?.addEventListener('click', () => playList(liked.map((t) => t.id)));
    $('#mixAll')?.addEventListener('click', () => { S.shuffle = true; playList(all.map((t) => t.id), Math.floor(Math.random() * all.length)); paintControls(); });
  },
  // Show all: every tile of one shelf in a grid.
  shelf(m) {
    const sh = SH[S.arg];
    if (!sh) return go('home');
    m.innerHTML = hero('shelf', sh.title) + `<div class="tile-grid" data-kind="${sh.kind}">${sh.items.map(tileHTML).join('')}</div>`;
    wireTiles(m, sh.items);
  },
  songs(m, all, bare) {
    songList(m, 'Songs', all, { sortable: true, bare, extra: `<button class="pill" id="rescan">Find my files</button>${all.some((t) => t.source !== 'local') ? `<button class="pill" data-a="fixall">${svg('tune')} Fix song info</button>` : ''}` });
    $('#rescan').onclick = rescan;
    m.querySelector('[data-a=fixall]')?.addEventListener('click', () => fixInfo());
  },
  liked(m, all, bare) {
    songList(m, 'Liked', sortTracks(all.filter((t) => t.liked), 'added'), { kind: 'liked', bare, emptyHead: 'No liked songs yet', emptyMsg: 'Tap the heart on any song and it lands here.', emptyBtn: 'Go to Songs', emptyAct: 'songs' });
  },
  albums(m, all, bare) {
    const groups = [...groupBy(sortTracks(all, 'artist'), albumKey)].sort((a, b) => a[1][0].album === '' ? 1 : b[1][0].album === '' ? -1 : (a[1][0].album).localeCompare(b[1][0].album));
    const items = albumCards(groups);
    m.innerHTML = (bare ? '' : hero('albums', 'Albums', { sub: plural(groups.length, 'album') })) + (groups.length ? cardsHTML(items) : emptyLib());
    wireCards(m, items);
  },
  album(m, all) {
    if (isCat(S.arg)) return catAlbum(m, S.arg.slice(1));
    const ts = all.filter((t) => albumKey(t) === S.arg).sort((a, b) => a.added - b.added);
    const t0 = ts[0] || {};
    const secsAll = ts.reduce((a, t) => a + (t.duration || 0), 0);
    songList(m, t0.album || 'Singles', ts, { kind: 'album', eyebrow: 'Album', art: ts.length ? cover(t0) : null, track: t0, numbered: true,
      specs: [t0.year, `${ts.length} TRK`, fmt(secsAll), codecTag(t0.codec)], sub: mainArtist(t0) });
  },
  artists(m, all, bare) {
    const groups = [...groupBy(all, mainArtist)].sort((a, b) => a[0].localeCompare(b[0]));
    const items = artistCards(groups);
    m.innerHTML = (bare ? '' : hero('artists', 'Artists', { sub: plural(groups.length, 'artist') })) + (groups.length ? cardsHTML(items, true) : emptyLib());
    wireCards(m, items);
  },
  artist(m, all) {
    if (isCat(S.arg)) return catArtist(m, S.arg.slice(1));
    const ts = sortTracks(all.filter((t) => mainArtist(t) === S.arg), 'plays');
    songList(m, S.arg, ts, { kind: 'artist', eyebrow: 'Artist', round: true, art: ts.length ? cover(ts[0]) : null, track: ts[0] });
  },
  playlist(m) {
    const p = lib.playlists.find((x) => x.id === S.arg);
    if (!p) return go('home');
    const ts = p.tracks.map(T).filter(Boolean);
    songList(m, p.name, ts, { kind: 'playlist', eyebrow: 'Playlist', playlist: p.id, numbered: true, art: plCover(p), track: ts[0],
      specs: [`${ts.length} TRK`, fmt(ts.reduce((n, t) => n + (t.duration || 0), 0))], sub: '',
      emptyHead: 'This playlist is empty', emptyMsg: touch() ? 'Press and hold a song, then pick Add to playlist.' : 'Right-click a song → Add to playlist, or drag a song onto this playlist in the sidebar.', emptyBtn: 'Go to Songs', emptyAct: 'songs',
      extra: `<button class="pill" id="plRename">${svg('edit')} Rename</button><button class="pill" id="plDelete">${svg('trash')} Delete playlist</button>` });
    $('#plRename').onclick = async () => { const n = await ask('Rename playlist', '', { input: p.name, ok: 'Rename' }); if (n) { await savePlaylist({ id: p.id, name: n }); render(); } };
    $('#plDelete').onclick = async () => { if (await ask('Delete this playlist?', `“${p.name}” goes away. Your songs stay in the library.`, { ok: 'Delete playlist', danger: true })) { await savePlaylist({ id: p.id, delete: true }); go('home'); } };
  },
  playlists(m, all, bare) {
    m.innerHTML = `<div class="actions"><button class="pill hot" id="plNew">${svg('plus')} New playlist</button></div>` +
      (lib.playlists.length ? `<div class="rows">${lib.playlists.map((p, i) => { const t = T(p.tracks[0]); return `
        <div class="row pl-row" data-i="${i}" tabindex="0"><span class="n"></span><span class="thumb"><img loading="lazy" src="${plCover(p)}" alt=""></span>
        <div class="t"><b>${esc(p.name)}</b><span>${plural(p.tracks.length, 'song')}</span></div><span class="al"></span><span></span><span class="d"></span><button class="ico more" aria-label="More">${svg('more')}</button></div>`; }).join('')}</div>`
        : empty('No playlists yet', 'Make one, then add songs from any song’s menu.'));
    $('#plNew').onclick = async () => { const p = await newPlaylist(); if (p) go('playlist', p.id); };
    m.querySelectorAll('.pl-row').forEach((row) => {
      const p = lib.playlists[+row.dataset.i], ids = p.tracks.filter(T);
      const menu = (e) => listMenu(e, ids, { img: plCover(p), title: p.name, sub: plural(ids.length, 'song') }, [{ label: 'Open playlist', icon: 'jump', do: () => go('playlist', p.id) }]);
      row.onclick = (e) => (e.target.closest('.more') ? menu(e) : go('playlist', p.id));
      row.onkeydown = (e) => { if (e.key === 'Enter') go('playlist', p.id); };
      row.oncontextmenu = menu;
    });
  },
  library(m, all) {
    const tabs = { songs: 'Songs', albums: 'Albums', colours: 'By colour', artists: 'Artists', liked: 'Liked', playlists: 'Playlists' };
    m.innerHTML = hero('library', 'Your library', { sub: `${plural(all.length, 'song')} · ${plural(lib.playlists.length, 'playlist')}` }) +
      `<div class="actions"><button class="pill" data-empty="get">${svg('get')} Add music</button></div>` + (['albums', 'colours'].includes(S.libTab) ? swatchHTML(all) : '') +
      `<div class="chips" role="group" aria-label="Show">${Object.entries(tabs).map(([k, v]) => `<button class="chip" data-lib="${k}" aria-pressed="${S.libTab === k}">${v}</button>`).join('')}</div><div id="libBody"></div>`;
    m.querySelectorAll('[data-lib]').forEach((b) => (b.onclick = () => { S.libTab = b.dataset.lib; S.hueBin = null; save(); render(); fx('enter', $('#libBody')); }));
    m.querySelectorAll('.sw').forEach((b) => (b.onclick = () => {
      const bin = +b.dataset.bin;
      S.hueBin = S.libTab === 'colours' && S.hueBin === bin ? null : bin; S.libTab = 'colours';
      save(); render(); fx('enter', $('#libBody'));
    }));
    (VIEWS[S.libTab] || VIEWS.songs)($('#libBody'), all, true);
  },
  // Albums by cover colour: one hue (or all of them, rainbow order), each band dark to light along the ramp.
  colours(m, all) {
    const { list } = albumColours(all);
    const shown = list.filter((a) => S.hueBin == null || a.bin === S.hueBin).sort((a, b) => a.bin - b.bin || a.c[2] - b.c[2]);
    const items = albumCards(shown.map((a) => [a.k, a.ts]));
    items.forEach((it, i) => { const [h, s, l] = shown[i].c; Object.assign(it, { swatch: `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`, spec: s < 0.16 ? 'MONO' : `H ${Math.round(h)}°` }); });
    m.innerHTML = shown.length ? cardsHTML(items) : list.length ? empty('No albums in this colour', 'Pick another colour above.') : allTracks().length ? '' : emptyLib();
    wireCards(m, items);
  },
  downloads(m) {
    m.innerHTML = hero('downloads', 'Downloads', { sub: 'Songs you’re getting, and ones that just finished.' }) + `<div id="dlBody"></div>`;
    paintJobs($('#dlBody'));
  },
  get: renderGet,
  search: renderSearch,
};
function render() {
  renderNav();
  H.dataset.view = S.view;
  // the field shows the query of the page you're on, not one you left (results sync it in renderSearch)
  const f = $('#gsInput'); if (f.value && document.activeElement !== f && !(S.view === 'search' && S.arg)) { f.value = ''; $('#gsClear').hidden = true; }
  const m = $('#main');
  if (!S.loaded) { m.innerHTML = skelPage(); return; }
  (VIEWS[S.view] || VIEWS.home)(m, allTracks());
}
async function rescan() {
  const r = await api('/api/rescan', {}); await loadLib(); render();
  toast(`Found ${plural(r.added, 'new file')}`);
}

// ---------- add music (paste a link, downloads, find my files) ----------
function renderGet(m) {
  m.innerHTML = hero('get', 'Add music', { sub: 'Paste a link to a song, album or playlist. To find songs, use the search box at the top.' }) +
    `<form class="getbox" id="getForm"><input id="q" autocomplete="off" placeholder="Paste a YouTube, SoundCloud, Bandcamp or Internet Archive link" value="${esc(S.getQ || '')}" aria-label="Paste a link or type a search"><button class="pill hot">${svg('get')} Get</button></form>
     <p class="hint">Saves the best audio the site offers (no re-encoding, so no quality loss), with cover art and song info, into your music folder. For your own use: get music you own or that's free to download.</p>
     <div id="results"></div>
     <section class="shelf"><h2>Your own files</h2><p class="hint">Copied songs into the music folder yourself? Press this to add them.</p><div class="actions"><button class="pill" id="rescan2">Find my files</button></div></section>
     <section class="shelf"><h2>Downloads</h2><div id="dlBody"></div></section>`;
  $('#getForm').onsubmit = (e) => { e.preventDefault(); doSearch($('#q').value.trim()); };
  $('#rescan2').onclick = rescan;
  paintJobs($('#dlBody'));
  paintResults();
}
// Web results belong to one view + query, so a slow answer never lands on the wrong page.
const resultsKey = () => `${S.view}|${S.view === 'search' ? (S.arg || '').trim() : S.getQ}`;
async function doSearch(q, n = 20) {
  if (!q) return;
  if (S.view === 'get') S.getQ = q;
  const key = resultsKey(), box = $('#results'); if (!box) return;
  box.innerHTML = `<div class="rows results">${skelRows(4)}</div>`;
  try { S.results = await webSearch(q, n); S.resultsKey = key; paintResults(); }
  catch (e) { if (resultsKey() === key && $('#results')) $('#results').innerHTML = empty("That didn't work", esc(e.message), 'Update the downloader', 'upd'); }
}
// Catalogue results (search page and pasted links): song rows (stream or Get), then album and artist shelves.
function paintResults() {
  const box = $('#results'); if (!box || !S.results || S.resultsKey !== resultsKey()) return;
  const R0 = S.results, songs = R0.songs || R0.results || [], albums = R0.albums || [], artists = R0.artists || [];
  if (!songs.length && !albums.length && !artists.length) { box.innerHTML = empty('No songs found', 'Try other words.'); return; }
  const missing = songs.filter((r) => !T(r.id) && !jobFor(r.id));
  box.innerHTML = (songs.length > 1 && R0.title ? `<div class="actions"><h2>${esc(R0.title)}</h2>${missing.length ? `<button class="pill hot" id="getAll">${svg('get')} Get all ${missing.length}</button>` : ''}</div>` : '') +
    (songs.length ? `<section class="shelf" data-kind="songs"><h2>Songs</h2>${rowsHTML(songs)}</section>` : '') +
    shelfHTML('r:albums', 'Albums', 'albums', albumTiles(albums)) + shelfHTML('r:artists', 'Artists', 'artists', artistTiles(artists));
  wireRows(box, songs); wireShelves(box);
  $('#getAll')?.addEventListener('click', () => getSongs(missing));
}

// ---------- downloads ----------
let jobs = [], polling = null;
const jobFor = (id) => jobs.find((j) => j.url.includes(id) && j.status !== 'done');
async function getSongs(items, andPlay = false) {
  const r = await api('/api/download', { items: items.map(({ id, url, title }) => ({ id, url, title })) });
  if (andPlay) r.jobs.forEach((j) => S.playAfter.add(j));
  toast(items.length > 1 ? `Getting ${r.jobs.length} songs` : `Getting “${items[0].title}”`);
  pollJobs();
}
async function pollJobs() {
  clearTimeout(polling);
  const before = new Set(jobs.filter((j) => j.status === 'done').map((j) => j.id));
  try { jobs = await api('/api/jobs'); } catch { polling = setTimeout(pollJobs, 3000); return; }
  const fresh = jobs.filter((j) => j.status === 'done' && !before.has(j.id));
  if (fresh.length) {
    await loadLib();
    for (const j of fresh) if (S.playAfter.delete(j.id) && j.track) { if (S.qi < 0 || audio.paused) playList([j.track]); else playNext([j.track]); }
    if (!['get', 'search', 'downloads'].includes(S.view)) render();
    paintNow(); paintQueues();
  }
  paintResults(); paintGsWeb(); paintStream();
  $$('.row[data-remote] .get').forEach((b) => { if (jobFor(b.closest('.row').dataset.id)) b.outerHTML = '<span class="got">Getting…</span>'; });
  const active = jobs.filter((j) => j.status === 'queued' || j.status === 'downloading');
  $('#dlPill').hidden = !active.length; $('#dlCount').textContent = active.length;
  $('#tabDlBadge').hidden = !active.length; $('#tabDlBadge').textContent = active.length;
  if (S.drawer === 'downloads') paintDrawer();
  const dl = $('#dlBody'); if (dl) paintJobs(dl);
  if (active.length) polling = setTimeout(pollJobs, 800);
}
$('#dlPill').onclick = () => openDrawer('downloads');
function dlStackHTML() {
  const shown = jobs.slice(-12), active = shown.filter((j) => j.status === 'queued' || j.status === 'downloading');
  if (!active.length) return '';
  const pct = (j) => (j.status === 'done' ? 100 : j.status === 'error' ? 0 : +j.progress || 0), done = shown.filter((j) => j.status === 'done').length;
  const all = Math.round(shown.reduce((a, j) => a + pct(j), 0) / shown.length);
  return `<div class="dl-stack" role="img" aria-label="Getting ${plural(shown.length, 'song')}, ${done} done, ${all}%">${shown.map((j) => `<i class="dlp ${j.status}" style="--p:${pct(j)}%"></i>`).join('')}<span class="spec">${done}/${shown.length} · ${all}%</span></div>`;
}
function paintJobs(root) {
  root.innerHTML = dlStackHTML() + (jobs.length ? `<div class="actions"><button class="pill" data-j="clear">Clear finished</button><button class="pill" data-j="upd">Update downloader</button></div>` : empty('No downloads yet', 'Search at the top and press Get on any song.', 'Search', 'search')) +
    [...jobs].reverse().map((j) => `<div class="job ${j.status}"><b>${esc(j.title)}</b><small>${j.status === 'error' ? esc(j.error) : j.status === 'done' ? 'Done — in your library' : j.status === 'queued' ? 'Waiting…' : `${j.progress}%`}</small>${j.status === 'downloading' || j.status === 'queued' ? `<div class="bar2"><i style="width:${j.progress}%"></i></div>` : ''}${j.status === 'error' ? `<div class="actions"><button class="pill" data-retry="${esc(j.url)}">Try again</button></div>` : ''}</div>`).join('');
  root.querySelector('[data-j=clear]')?.addEventListener('click', async () => { await api('/api/jobs/clear', {}); pollJobs(); });
  root.querySelector('[data-j=upd]')?.addEventListener('click', updateEngine);
  root.querySelectorAll('[data-retry]').forEach((b) => (b.onclick = () => getSongs([{ url: b.dataset.retry, title: 'Retry' }])));
}

// ---------- right pane: up next / lyrics / downloads ----------
function openDrawer(tab) {
  const want = S.drawer === tab ? null : tab, was = !!S.drawer;
  const apply = () => { S.drawer = want; save(); paintDrawer(); paintControls(); };
  if (!!want === was) return apply();
  if (want && !desktop()) ovOpen('drawer'); else if (!want) ovClosed('drawer');
  vt(apply, { kind: 'drawer' });
}
OV.close.drawer = () => openDrawer(null);
$('#drawerClose').onclick = () => openDrawer(null);
$$('.drawer-tabs [data-tab]').forEach((b) => (b.onclick = () => { S.drawer = b.dataset.tab; save(); paintDrawer(); paintControls(); }));
function paintDrawer() {
  const d = $('#drawer');
  d.hidden = !S.drawer;
  if (!S.drawer) return;
  $$('.drawer-tabs [data-tab]').forEach((b) => { const on = b.dataset.tab === S.drawer; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const body = $('#drawerBody');
  body.setAttribute('aria-labelledby', `tab-${S.drawer}`);
  if (S.drawer === 'queue') paintQueue(body);
  else if (S.drawer === 'lyrics') { body.innerHTML = `<div class="lyr" id="lyrSide">${lyricsHTML()}</div>`; wireLyricClicks(body); lastLine = -1; syncLyrics(audio.currentTime); }
  else paintJobs(body);
}
function qrowHTML(id, i) {
  const t = Q(id); if (!t) return '';
  return `<div class="qrow${i === S.qi ? ' cur' : ''}"${touch() ? '' : ' draggable="true"'} data-i="${i}"><span class="thumb"><img src="${esc(cover(t))}" alt=""><span class="eq" aria-hidden="true"></span></span><div class="qt"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><button class="ico" data-a="rm" aria-label="Remove">${svg('x')}</button>${touch() ? GRIP : ''}</div>`;
}
function paintQueue(body) {
  if (!S.queue.length) { body.innerHTML = empty('Up next is empty', 'Play any song and the rest of its list lines up here.'); return; }
  body.innerHTML = `<h6>Now playing</h6>${qrowHTML(S.queue[S.qi], S.qi)}<h6>Up next · ${S.queue.length - S.qi - 1}</h6>${S.queue.map((id, i) => (i > S.qi ? qrowHTML(id, i) : '')).join('')}` +
    (S.qi > 0 ? `<h6>Played</h6>${S.queue.map((id, i) => (i < S.qi ? qrowHTML(id, i) : '')).join('')}` : '');
  body.querySelectorAll('.qrow').forEach((el) => {
    const i = +el.dataset.i;
    el.onclick = (e) => { if (e.target.closest('[data-a=rm]')) return removeFromQueue(i); if (e.target.closest('.grip')) return; S.qi = i; load(true); };
    el.oncontextmenu = (e) => trackMenu(e, S.queue[i], { queueIndex: i });
    el.ondragstart = (e) => e.dataTransfer.setData('text/ocm-q', String(i));
    el.ondragover = (e) => { e.preventDefault(); el.classList.add('over'); };
    el.ondragleave = () => el.classList.remove('over');
    el.ondrop = (e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text/ocm-q'); moveQueue(Number.isNaN(from) ? i : from, i); };
    const g = el.querySelector('.grip');
    if (g) g.onpointerdown = (e) => gripDrag(e, el, moveQueue);
  });
}
function paintQueues() {
  if (S.drawer === 'queue') paintDrawer();
  if (!$('#np').hidden && S.npTab === 'queue') paintQueue($('#npQueue'));
}

// ---------- lyrics (LRCLIB: free, no key) ----------
async function loadLyrics(t) {
  if (S.lyrics[t.id]) return paintLyrics();
  const cached = store.get('lyr.' + t.id, null);
  if (cached) { S.lyrics[t.id] = cached; return paintLyrics(); }
  S.lyrics[t.id] = { loading: true }; paintLyrics();
  const p = new URLSearchParams({ track_name: t.title, artist_name: mainArtist(t) });
  let res = null, busy = false;
  try { // search (not /get) so a song without lyrics is an empty list, not a 404 in the console
    const r = await fetch(`https://lrclib.net/api/search?${p}`); busy = r.status >= 500;
    const list = r.ok ? await r.json() : [];
    res = list.find((x) => Math.abs((x.duration || 0) - (t.duration || 0)) < 8) || list[0] || null;
  } catch { busy = true; /* offline */ }
  const data = { lines: res?.syncedLyrics ? parseLRC(res.syncedLyrics) : null, plain: res?.plainLyrics || '', instrumental: !!res?.instrumental, busy };
  S.lyrics[t.id] = data;
  if (res) store.set('lyr.' + t.id, data);
  paintLyrics();
}
function parseLRC(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const words = line.replace(/\[\d+:\d+(?:[.:]\d+)?\]/g, '').trim();
    for (const m of line.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)) out.push({ t: +m[1] * 60 + parseFloat(m[2].replace(':', '.')), w: words || '♪' });
  }
  return out.sort((a, b) => a.t - b.t);
}
function lyricsHTML() {
  const t = cur(); const L = t && S.lyrics[t.id];
  if (!t) return empty('No song playing', 'Play a song to see its lyrics.');
  if (!L || L.loading) return `<div class="skel skel-line" aria-hidden="true"></div>`.repeat(5);
  if (L.instrumental) return empty('♪ Instrumental', 'No words in this one. Enjoy the music.');
  if (L.lines) return L.lines.map((l, i) => `<p data-i="${i}" data-t="${l.t}">${esc(l.w)}</p>`).join('');
  if (L.plain) return `<p class="plain">${esc(L.plain)}</p>`;
  return empty('No lyrics', L.busy ? "The lyrics service didn't answer. Reopen the app later to try again." : 'No lyrics found for this one.');
}
function wireLyricClicks(root) { root.querySelectorAll('p[data-t]').forEach((p) => (p.onclick = () => { audio.currentTime = +p.dataset.t; audio.play(); })); }
function paintLyrics() {
  if (S.drawer === 'lyrics') paintDrawer();
  if (!$('#np').hidden && S.npTab === 'lyrics') paintNPLyrics();
  lastLine = -1; syncLyrics(audio.currentTime);
}
function paintNPLyrics() { const box = $('#npLyrics'); box.innerHTML = `<div class="lyr">${lyricsHTML()}</div>`; wireLyricClicks(box); }
let lastLine = -1;
function syncLyrics(c) {
  const t = cur(); const L = t && S.lyrics[t.id];
  if (!L?.lines) return;
  let i = -1; for (let k = 0; k < L.lines.length && L.lines[k].t <= c + 0.25; k++) i = k;
  if (i === lastLine) return;
  lastLine = i;
  for (const [box, scroller] of [[$('#lyrSide'), $('#drawerBody')], [$('#np').hidden ? null : $('#npLyrics'), $('#npLyrics')]]) {
    if (!box) continue;
    box.querySelectorAll('p[data-i]').forEach((p) => { const n = +p.dataset.i; p.classList.toggle('on', n === i); p.classList.toggle('past', n < i); });
    const on = box.querySelector('p.on');
    if (on && scroller.clientHeight) {
      const top = scroller.scrollTop + on.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight * 0.38;
      if (window.MotionPlayer) MotionPlayer.lyricScroll(scroller, top, box); // spring wave
      else scroller.scrollTo({ top, behavior: motionOff() ? 'auto' : 'smooth' });
    }
  }
}

// ---------- now playing (dock + full screen) ----------
function paintControls() {
  const playing = !audio.paused;
  for (const b of $$('#play, [data-act=play]')) { b.dataset.state = playing ? 'playing' : 'paused'; b.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  for (const b of $$('#shuffle, [data-act=shuffle]')) { b.classList.toggle('on', S.shuffle); b.setAttribute('aria-pressed', S.shuffle); }
  for (const b of $$('#repeat, [data-act=repeat]')) {
    const n = S.repeat === 'one' ? 'repeat1' : 'repeat';
    if (b.dataset.ico !== n) { b.innerHTML = svg(n); b.dataset.ico = n; }
    b.classList.toggle('on', S.repeat !== 'off'); b.setAttribute('aria-pressed', S.repeat !== 'off');
    b.setAttribute('aria-label', { off: 'Repeat', all: 'Repeat: all', one: 'Repeat: this song' }[S.repeat]);
  }
  for (const [id, tab] of [['#queueBtn', 'queue'], ['#lyricsBtn', 'lyrics']]) { $(id).classList.toggle('on', S.drawer === tab); $(id).setAttribute('aria-pressed', S.drawer === tab); }
}
function paintNow() {
  const t = cur();
  H.dataset.hasTrack = !!t;
  $('#barTitle').textContent = t ? t.title : 'Nothing playing';
  $('#barArtist').textContent = t ? t.artist : 'Pick a song to start';
  $('#barCover').src = t ? cover(t) : blankCover('none');
  const lb = $('#barLike'); paintLike(lb, !!t?.liked); lb.hidden = !t || streaming(t);
  $('[data-act=like]').hidden = streaming(t);
  paintStream();
  paintLike($('[data-act=like]'), !!t?.liked);
  document.title = t ? `${t.title} · ${t.artist}` : 'OddlyClever Spin';
  if (t) { $('#npCover').src = cover(t); $('#npTitle').textContent = t.title; $('#npArtist').textContent = [t.artist, t.album].filter(Boolean).join(' — '); }
  if (!$('#np').hidden && S.npTab === 'info') paintInfo();
}
// A song playing from /api/stream shows "Streaming" and a Get button (bar + Now Playing).
function paintStream() {
  const t = cur(), on = streaming(t), job = on && jobFor(t.id);
  for (const id of ['#barStream', '#npStream']) $(id).hidden = !on;
  for (const id of ['#barGet', '#npGet']) { const b = $(id); b.hidden = !on; b.disabled = !!job; b.textContent = job ? 'Getting…' : 'Get'; b.setAttribute('aria-label', job ? 'Getting this song' : 'Get this song — save it to your library'); }
}
for (const id of ['#barGet', '#npGet']) $(id).onclick = (e) => { e.stopPropagation(); const t = cur(); if (streaming(t) && !jobFor(t.id)) getSongs([t]); };
function paintInfo() {
  const t = cur(); if (!t) return ($('#npInfo').innerHTML = '');
  if (streaming(t)) return ($('#npInfo').innerHTML = `<dl class="kv">${[['Title', t.title], ['Artist', t.artist], ['Album', t.album], ['Year', t.year], ['Length', t.duration ? fmt(t.duration) : ''], ['From', 'Streaming — press Get to save it']]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`);
  const when = (s) => (s ? new Date(s * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');
  const rows = [['Title', t.title], ['Artist', t.artist], ['Album', t.album || 'Single'], ['Year', t.year], ['Length', fmt(t.duration)],
    ['Plays', t.plays], ['Last played', when(t.lastPlayed)], ['Added', when(t.added)], ['Format', codecTag(t.codec) || t.codec], ['From', t.source === 'local' ? 'Your own file' : t.source], ['File', t.file]];
  $('#npInfo').innerHTML = `<dl class="kv">${rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
function setNPTab(tab) {
  if (desktop() && tab === 'now') tab = 'lyrics';
  S.npTab = tab; save();
  $('#np').dataset.ptab = tab;
  $$('[data-nptab]').forEach((b) => { const on = b.dataset.nptab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  for (const [id, k] of [['#npLyrics', 'lyrics'], ['#npQueue', 'queue'], ['#npInfo', 'info']]) { $(id).hidden = k !== tab; $(id).classList.toggle('on', k === tab); }
  if (tab === 'lyrics') { paintNPLyrics(); lastLine = -1; syncLyrics(audio.currentTime); }
  else if (tab === 'queue') paintQueue($('#npQueue'));
  else if (tab === 'info') paintInfo();
}
$$('[data-nptab]').forEach((b) => (b.onclick = () => setNPTab(b.dataset.nptab)));
let npOpener = null;
function openNP(on) {
  $('#np').hidden = !on;
  if (on) { paintNow(); setNPTab(desktop() ? S.npTab : 'now'); }
}
// Open/close with the cover morph; swipe-down closes without a transition (it already animated out).
function setNP(on, { animate = true } = {}) {
  if (on === !$('#np').hidden) return;
  if (on && !cur()) return;
  if (on) { npOpener = document.activeElement; ovOpen('np'); } else ovClosed('np');
  const apply = () => { openNP(on); H.dataset.np = on ? 'open' : 'closed'; };
  (animate ? vt(apply, { kind: 'np' }) : (apply(), Promise.resolve())).then(() => {
    if (on) $('#npClose').focus({ preventScroll: true }); else { npOpener?.focus?.({ preventScroll: true }); npOpener = null; }
  });
}
OV.close.np = () => setNP(false);
$('#barLike').onclick = (e) => { e.stopPropagation(); if (cur()) like(cur().id, undefined, e.currentTarget); };
$('#nowMini').onclick = (e) => { if (!e.target.closest('.like')) setNP(true); };
$('#nowMini').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNP(true); } };
$('#bar').addEventListener('click', (e) => { if (!desktop() && !e.target.closest('button, input, .now')) setNP(true); });
$('#fullBtn').onclick = () => setNP(true);
$('#npClose').onclick = () => setNP(false);
$('#queueBtn').onclick = () => openDrawer('queue');
$('#lyricsBtn').onclick = () => openDrawer('lyrics');
$('#sleepBtn').onclick = sleepMenu;
$('#newPl').onclick = async () => { const p = await newPlaylist(); if (p) go('playlist', p.id); };
$('#newPl').onkeydown = (e) => { if (e.key === 'Enter') $('#newPl').click(); };
const acts = {
  play: togglePlay, next: () => next(false), prev: () => prev(),
  shuffle: toggleShuffle,
  repeat: () => { S.repeat = { off: 'all', all: 'one', one: 'off' }[S.repeat]; save(); paintControls(); toast({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat this song' }[S.repeat]); },
};
for (const k of Object.keys(acts)) { $('#' + k).onclick = acts[k]; $(`[data-act=${k}]`).onclick = acts[k]; }
$('[data-act=like]').onclick = (e) => cur() && like(cur().id, undefined, e.currentTarget);
$('[data-act=sleep]').onclick = sleepMenu;

// Sidebar collapse
function setSide(min) {
  $('#app').dataset.side = min ? 'min' : 'full'; store.set('sideMin', min);
  const b = $('#sideToggle'); b.setAttribute('aria-pressed', min); b.setAttribute('aria-label', min ? 'Expand sidebar' : 'Collapse sidebar');
}
const toggleSide = () => setSide($('#app').dataset.side !== 'min');
$('#sideToggle').onclick = toggleSide;

// ---------- global search: library (instant) + web (debounced) + commands ----------
const gsIn = $('#gsInput'), gsPanel = $('#gsPanel');
const G = { items: [], active: -1, ctrl: null, timer: 0, err: '' };
const webDone = new Map(), webPending = new Map();
const isUrl = (q) => /^https?:\/\/\S+$/i.test(q);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function webSearch(q, n, signal) {
  const k = `${n}|${q}`;
  if (webDone.has(k)) return Promise.resolve(webDone.get(k));
  if (!webPending.has(k)) {
    webPending.set(k, api(`/api/search?q=${encodeURIComponent(q)}&n=${n}`, undefined, signal)
      .then((r) => { webDone.set(k, r); return r; })
      .finally(() => webPending.delete(k)));
  }
  return webPending.get(k);
}
// Rank: starts with 3, a word starts with 2, contains 1.
function scorer(q) {
  const word = new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  return (text) => { const t = norm(text); return !q || !t.includes(q) ? 0 : t.startsWith(q) ? 3 : word.test(t) ? 2 : 1; };
}
// Wrap the matched part in <mark>, mapping positions back through accent-stripping.
function mark(text, q) {
  text = String(text || ''); if (!q) return esc(text);
  let n = '', map = [];
  for (let i = 0; i < text.length; i++) { const c = norm(text[i]); for (const ch of c) { n += ch; map.push(i); } }
  const at = n.indexOf(q); if (at < 0) return esc(text);
  const a = map[at], b = map[at + q.length - 1] + 1;
  return `${esc(text.slice(0, a))}<mark>${esc(text.slice(a, b))}</mark>${esc(text.slice(b))}`;
}
function libraryMatches(q) {
  const all = allTracks(), score = scorer(q);
  const songs = all.map((t) => ({ t, s: Math.max(score(t.title), score(t.artist), score(t.album)) })).filter((x) => x.s)
    .sort((a, b) => b.s - a.s || b.t.liked - a.t.liked || b.t.plays - a.t.plays);
  const rank = (m) => [...m].map(([k, ts]) => ({ k, ts, s: score(k.split('\u0001')[0]), p: ts.reduce((n, t) => n + t.plays + t.liked, 0) })).filter((x) => x.s).sort((a, b) => b.s - a.s || b.p - a.p);
  const albums = rank(groupBy(all.filter((t) => t.album), albumKey));
  const artists = rank(groupBy(all, mainArtist));
  const pls = lib.playlists.map((p) => ({ p, s: score(p.name) })).filter((x) => x.s).sort((a, b) => b.s - a.s);
  return { songs, albums, artists, pls };
}
const songItem = (t, q, ids, i) => ({ kind: 'track', id: t.id, img: cover(t), title: mark(t.title, q), sub: `${mark(t.artist || 'Unknown artist', q)}${t.album ? ' · ' + mark(t.album, q) : ''}`, badge: 'Song', run: () => playList(ids, i), menu: (e) => trackMenu(e, t.id) });
const albumItem = ({ k, ts }, q) => ({ kind: 'album', id: k, img: cover(ts[0]), title: mark(ts[0].album, q), sub: `Album · ${esc(mainArtist(ts[0]))}`, badge: 'Album', run: () => go('album', k) });
const artistItem = ({ k, ts }, q) => ({ kind: 'artist', id: k, img: cover(ts[0]), round: true, title: mark(k, q), sub: plural(ts.length, 'song'), badge: 'Artist', run: () => go('artist', k) });
const plItem = ({ p }, q) => ({ kind: 'playlist', id: p.id, img: plCover(p), title: mark(p.name, q), sub: `Playlist · ${plural(p.tracks.length, 'song')}`, badge: 'Playlist', run: () => go('playlist', p.id) });
// Catalogue items in the dropdown: a song plays at once (streamed if you don't have it), with Get beside it.
function catSong(s, list, i) {
  const t = T(s.id) || remember(s), have = T(t.id), job = jobFor(t.id);
  return { kind: 'web', id: t.id, img: cover(t), title: esc(t.title), sub: `${esc(t.artist)}${t.album ? ' · ' + esc(t.album) : ''}${t.duration ? ' · ' + fmt(t.duration) : ''}`,
    badge: have ? 'In library' : 'Song', run: () => playSongs(list, i), menu: (e) => trackMenu(e, t.id), r: t,
    acts: have ? '' : job ? '<span class="gs-acts"><span class="got">Getting…</span></span>' : '<span class="gs-acts"><button class="pill sm" data-a="get">Get</button></span>' };
}
const catAlbumItem = (a) => ({ kind: 'album', id: a.id, img: a.cover || blankCover(a.title), title: esc(a.title), sub: esc([a.type || 'Album', a.artist, a.year].filter(Boolean).join(' · ')), badge: a.type || 'Album', run: () => go('album', CAT + a.id) });
const catArtistItem = (a) => ({ kind: 'artist', id: a.id, img: a.photo || blankCover(a.name), round: true, title: esc(a.name), sub: 'Artist', badge: 'Artist', run: () => go('artist', CAT + a.id) });
const catTop = (top, songs) => !top?.item ? null : top.kind === 'album' ? catAlbumItem(top.item) : top.kind === 'artist' ? catArtistItem(top.item) : catSong(top.item, [top.item], 0);
const glyph = (kind, title, sub, glyphName, run, badge = '') => ({ kind, glyph: glyphName, title: esc(title), sub: esc(sub), badge, run });
const JUMPS = [['home', 'Listen now'], ['songs', 'Songs'], ['albums', 'Albums'], ['artists', 'Artists'], ['liked', 'Liked'], ['library', 'Your library'], ['get', 'Add music'], ['downloads', 'Downloads']];
function idleSecs() {
  const rec = store.get('recentSearches', []);
  return [
    rec.length && { sec: 'recent', h: 'Recent searches', clear: true, items: rec.map((q) => glyph('recent', q, '', 'clock', () => { gsIn.value = q; gsInput(); })) },
    { sec: 'jump', h: 'Jump to', items: [...JUMPS.map(([v, l]) => glyph('jump', l, '', 'jump', () => go(v))), glyph('jump', 'Appearance', 'Themes, light or dark, motion', 'tune', openSettings)] },
  ].filter(Boolean);
}
function searchSecs(q) {
  const n = norm(q), { songs, albums, artists, pls } = libraryMatches(n);
  const ids = songs.slice(0, 50).map((x) => x.t.id);
  const best = [artists[0] && { s: artists[0].s + 0.2, it: artistItem(artists[0], n) }, albums[0] && { s: albums[0].s + 0.1, it: albumItem(albums[0], n) },
    pls[0] && { s: pls[0].s, it: plItem(pls[0], n) }, songs[0] && { s: songs[0].s, it: songItem(songs[0].t, n, ids, 0) }].filter(Boolean).sort((a, b) => b.s - a.s)[0];
  const w = webDone.get(`6|${q}`), wsongs = w ? w.songs || w.results || [] : null, web = wsongs?.slice(0, 5).map((x, i) => catSong(x, wsongs, i));
  const calb = (w?.albums || []).map(catAlbumItem), cart = (w?.artists || []).map(catArtistItem);
  const top = (best?.s >= 2 && best.it) || catTop(w?.top, wsongs) || best?.it || web?.[0];
  const albs = [...albums.slice(0, 3).map((x) => albumItem(x, n)), ...calb].slice(0, 4), arts = [...artists.slice(0, 3).map((x) => artistItem(x, n)), ...cart].slice(0, 4);
  return [
    top && { sec: 'top', h: 'Top result', items: [{ ...top, hero: true }] },
    songs.length && { sec: 'songs', h: 'In your library', items: songs.slice(0, 5).map((x, i) => songItem(x.t, n, ids, i)) },
    { sec: 'web', h: 'Songs', items: web || [], body: web ? (web.length ? '' : '<p class="gs-msg">No songs found.</p>') : G.err === q ? `<p class="gs-msg">Can't reach the music catalogue right now</p>` : n.length < 2 ? '<p class="gs-msg">Keep typing to search everything…</p>' : skelRows(3) },
    albs.length && { sec: 'albums', h: 'Albums', items: albs },
    arts.length && { sec: 'artists', h: 'Artists', items: arts },
    pls.length && { sec: 'playlists', h: 'Playlists', items: pls.slice(0, 3).map((x) => plItem(x, n)) },
  ].filter(Boolean);
}
const linkSecs = (q) => [{ sec: 'top', h: 'Top result', items: [{ ...glyph('link', 'Get from this link', q, 'link', () => { saveRecent(q); go('search', q); }, 'Link'), hero: true }] }];
function commandList() {
  const c = (label, key, run) => ({ label, key, run });
  return [
    c('Play or pause', 'Space', togglePlay), c('Next song', 'Shift →', () => next(false)), c('Previous song', 'Shift ←', () => prev(true)),
    c('Like this song', 'L', () => cur() && like(cur().id)), c('Shuffle on or off', 'S', toggleShuffle), c('Repeat: off, all, one', 'R', acts.repeat),
    c('Open Now Playing', 'F', () => setNP(true)), c('Show Up next', 'Q', () => openDrawer('queue')), c('Show lyrics', 'Y', () => openDrawer('lyrics')),
    ...JUMPS.map(([v, l]) => c(`Go to ${l}`, '', () => go(v))),
    ...themes().map((t) => c(`Theme: ${t.name}`, '', () => fx('applySettings', { theme: t.id }))),
    ...['Light', 'Dark', 'Auto'].map((m) => c(`Mode: ${m}`, '', () => fx('applySettings', { mode: m.toLowerCase() }))),
    ...['Full', 'Calm', 'Off'].map((m) => c(`Motion: ${m}`, '', () => fx('applySettings', { motion: m.toLowerCase() }))),
    ...[15, 30, 60].map((n) => c(`Sleep timer: ${n} min`, '', () => setSleep(n))), c('Sleep timer: end of this song', '', () => setSleep('song')), c('Sleep timer: off', '', () => setSleep(0)),
    c('Find my files', '', rescan), c('New playlist', '', async () => { const p = await newPlaylist(); if (p) go('playlist', p.id); }),
    c('Appearance settings', '', openSettings), c('Keyboard shortcuts', '?', openKeys), c('Collapse or expand the sidebar', '', toggleSide),
  ];
}
// Fuzzy: every typed letter in order; runs and word starts score higher.
function fuzzy(label, q) {
  const s = norm(label); let i = 0, sc = 0, last = -2;
  for (const ch of q) { const j = s.indexOf(ch, i); if (j < 0) return 0; sc += (j === last + 1 ? 3 : 1) + (j === 0 || s[j - 1] === ' ' ? 2 : 0); last = j; i = j + 1; }
  return sc;
}
function cmdSecs(q) {
  const n = norm(q).replace(/\s+/g, '');
  const list = commandList().map((c, i) => ({ c, s: n ? fuzzy(c.label, n) : 1, i })).filter((x) => x.s).sort((a, b) => b.s - a.s || a.i - b.i);
  return [{ sec: 'commands', h: 'Commands', items: list.map(({ c }) => ({ ...glyph('command', c.label, '', 'cmd', c.run), badge: c.key ? `<kbd>${esc(c.key)}</kbd>` : 'Command' })),
    body: list.length ? '' : '<p class="gs-msg">No command matches that.</p>' }];
}
function gsItemHTML(it, n) {
  return `<div class="gs-item${it.hero ? ' gs-hero' : ''}" role="option" id="gs-opt-${n}" aria-selected="false" data-kind="${it.kind}" data-n="${n}"${it.id ? ` data-id="${esc(it.id)}"` : ''}>` +
    (it.img ? `<span class="gs-art${it.round ? ' round' : ''}"><img alt="" src="${esc(it.img)}"></span>` : `<span class="gs-art gs-glyph">${svg(it.glyph)}</span>`) +
    `<span class="gs-t"><b>${it.title}</b><span>${it.sub || ''}</span></span><span class="gs-badge">${it.badge || ''}</span>${it.acts || ''}</div>`;
}
function gsRender() {
  const q = gsIn.value.trim(), cmd = q.startsWith('>');
  $('#gsearch').dataset.mode = cmd ? 'cmd' : 'search';
  $('#gsClear').hidden = !gsIn.value;
  const keep = G.items[G.active] && `${G.items[G.active].kind}|${G.items[G.active].id}|${G.items[G.active].title}`;
  const secs = cmd ? cmdSecs(q.slice(1)) : !q ? idleSecs() : isUrl(q) ? linkSecs(q) : searchSecs(q);
  G.items = [];
  gsPanel.innerHTML = secs.map((s) => `<section class="gs-sec" data-sec="${s.sec}"><h6>${s.h}${s.clear ? ' <button class="pill sm" type="button" data-a="clear-recent">Clear</button>' : ''}</h6>` +
    s.items.map((it) => gsItemHTML(it, G.items.push(it) - 1)).join('') + (s.body || '') + '</section>').join('') +
    `<footer class="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span>${q && !cmd ? '<button class="pill sm" type="button" data-a="all">See all results</button>' : ''}</footer>`;
  const again = keep ? G.items.findIndex((it) => `${it.kind}|${it.id}|${it.title}` === keep) : -1;
  setActive(again >= 0 ? again : cmd && G.items.length ? 0 : -1);
}
function setActive(n) {
  G.active = n;
  $$('.gs-item', gsPanel).forEach((el) => { const on = +el.dataset.n === n; el.classList.toggle('is-active', on); el.setAttribute('aria-selected', on); });
  gsIn.setAttribute('aria-activedescendant', n >= 0 ? `gs-opt-${n}` : '');
  if (n >= 0) $(`#gs-opt-${n}`)?.scrollIntoView({ block: 'nearest' });
}
function paintGsWeb() { if (OV.stack.includes('search') && !gsIn.value.trim().startsWith('>')) gsRender(); }
function gsInput() {
  openSearch();
  gsRender();
  const q = gsIn.value.trim();
  clearTimeout(G.timer); G.ctrl?.abort();
  if (q.length < 2 || q.startsWith('>') || isUrl(q) || webDone.has(`6|${q}`)) return;
  G.timer = setTimeout(() => {
    G.ctrl = new AbortController();
    webSearch(q, 6, G.ctrl.signal).then(() => { if (gsIn.value.trim() === q) gsRender(); })
      .catch((e) => { if (e.name === 'AbortError') return; G.err = q; if (gsIn.value.trim() === q) gsRender(); });
  }, 400);
}
function openSearch() {
  if (OV.stack.includes('search')) return;
  $('#gsearch').dataset.open = 'true'; gsPanel.hidden = false; gsIn.setAttribute('aria-expanded', 'true'); H.dataset.gs = 'open';
  ovOpen('search', !desktop());
  gsRender();
}
function closeSearch() {
  if (!OV.stack.includes('search')) return;
  $('#gsearch').dataset.open = 'false'; gsPanel.hidden = true; gsIn.setAttribute('aria-expanded', 'false'); H.dataset.gs = 'closed';
  gsIn.setAttribute('aria-activedescendant', ''); G.active = -1;
  ovClosed('search');
  if (!desktop()) gsIn.blur();
}
OV.close.search = closeSearch;
function saveRecent(q) {
  if (!q || q.startsWith('>')) return;
  store.set('recentSearches', [q, ...store.get('recentSearches', []).filter((x) => x !== q)].slice(0, 8));
}
function runItem(it) {
  const q = gsIn.value.trim();
  if (it.kind !== 'recent') saveRecent(q);
  if (it.kind === 'recent') return it.run();
  closeSearch(); gsIn.blur();
  if (it.kind === 'command') gsIn.value = '';
  it.run();
}
function seeAll() {
  const q = gsIn.value.trim(); if (!q || q.startsWith('>')) return;
  saveRecent(q); gsIn.blur(); go('search', q);
}
gsIn.addEventListener('focus', openSearch);
gsIn.addEventListener('click', openSearch);
gsIn.addEventListener('input', gsInput);
gsIn.addEventListener('keydown', (e) => {
  const n = G.items.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openSearch(); if (n) setActive(e.key === 'ArrowDown' ? (G.active + 1) % n : (G.active <= 0 ? n : G.active) - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (G.items[G.active]) runItem(G.items[G.active]); else if (isUrl(gsIn.value.trim())) G.items[0] && runItem(G.items[0]); else seeAll(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (OV.stack.includes('search')) closeSearch(); else gsIn.blur(); }
});
// Keep focus in the box while clicking results with a mouse.
gsPanel.addEventListener('mousedown', (e) => e.preventDefault());
gsPanel.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a, el = e.target.closest('.gs-item'), it = el && G.items[+el.dataset.n];
  if (a === 'all') return seeAll();
  if (a === 'clear-recent') { store.set('recentSearches', []); return gsRender(); }
  if (a === 'get' || a === 'getplay') { saveRecent(gsIn.value.trim()); getSongs([it.r], a === 'getplay'); return; }
  if (it) runItem(it);
});
gsPanel.addEventListener('contextmenu', (e) => { const el = e.target.closest('.gs-item[data-kind=track], .gs-item[data-kind=web]'); if (el) G.items[+el.dataset.n].menu?.(e); });
gsPanel.addEventListener('mousemove', (e) => { const el = e.target.closest('.gs-item'); if (el && +el.dataset.n !== G.active) setActive(+el.dataset.n); });
document.addEventListener('pointerdown', (e) => { if (desktop() && !e.target.closest('#gsearch, #menu, #sheet, .dlg')) closeSearch(); });
$('#gsClear').onclick = () => { gsIn.value = ''; gsIn.focus(); gsInput(); };
$('#gsCancel').onclick = () => { closeSearch(); gsIn.blur(); };

// Full results view: go('search', q). Library sections instantly, web below.
function renderSearch(m, all) {
  const q = (S.arg || '').trim();
  if (!q) {
    const rec = store.get('recentSearches', []);
    m.innerHTML = hero('search', 'Search', { sub: 'Find songs in your library or on the web.' }) +
      `<div class="actions"><button class="pill" data-empty="get">${svg('get')} Add music</button></div>` +
      (rec.length ? `<section class="shelf"><h2>Recent searches</h2><div class="chips" role="group">${rec.map((r) => `<button class="chip" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div></section>` : '') +
      `<section class="shelf"><h2>Jump to</h2><div class="chips" role="group">${JUMPS.map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join('')}</div></section>` +
      (rec.length ? '' : empty('Tip', 'Type a song, artist or album. Results from your library show at once; songs from the web follow a moment later.', 'Start typing', 'search'));
    m.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => go('search', b.dataset.q)));
    m.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => go(b.dataset.v)));
    return;
  }
  if (isUrl(q)) {
    m.innerHTML = hero('search', 'From this link', { sub: q }) + '<div id="results"></div>';
    if (S.resultsKey === resultsKey()) paintResults(); else doSearch(q);
    return;
  }
  if (document.activeElement !== gsIn) { gsIn.value = q; $('#gsClear').hidden = false; } // a recent-search chip or Back lands here: the field shows what the page shows
  const n = norm(q), { songs, albums, artists, pls } = libraryMatches(n), chip = S.chip;
  const ts = songs.slice(0, 50).map((x) => x.t);
  const showLib = chip !== 'web', showWeb = chip !== 'library';
  const alb = albumCards(albums.slice(0, 12).map((x) => [x.k, x.ts])), art = artistCards(artists.slice(0, 12).map((x) => [x.k, x.ts]));
  const plc = pls.slice(0, 12).map(({ p }) => ({ kind: 'album', id: p.id, title: p.name, sub: plural(p.tracks.length, 'song'), img: plCover(p), open: () => go('playlist', p.id) }));
  const nothing = !ts.length && !alb.length && !art.length && !plc.length;
  m.innerHTML = hero('search', `Results for “${q}”`) +
    `<div class="chips" role="group" aria-label="Show">${['all', 'library', 'web'].map((c) => `<button class="chip" data-chip="${c}" aria-pressed="${chip === c}">${{ all: 'All', library: 'Your library', web: 'More music' }[c]}</button>`).join('')}</div>` +
    (showLib ? (ts.length ? `<section class="shelf" id="srSongs"><h2>Songs</h2>${rowsHTML(ts)}</section>` : '') + shelfHTML('s:alb', 'Your albums', 'albums', alb) + shelfHTML('s:art', 'Your artists', 'artists', art) + shelfHTML('s:pl', 'Playlists', 'albums', plc) +
      (nothing && chip === 'library' ? empty('Nothing in your library', `No songs, albums or artists match “${esc(q)}” yet.`) : '') : '') +
    (showWeb ? `<section class="shelf">${showLib && !nothing ? '<h2 class="group-label">More music</h2>' : ''}<div id="results"></div></section>` : '');
  m.querySelectorAll('[data-chip]').forEach((b) => (b.onclick = () => { S.chip = b.dataset.chip; render(); }));
  if (showLib && ts.length) wireRows($('#srSongs'), ts);
  if (showLib) wireShelves(m);
  if (showWeb) { if (S.resultsKey === resultsKey()) paintResults(); else doSearch(q); }
}

// ---------- gestures (Pointer Events): swipes, long-press, grip reorder ----------
let suppressClick = false;
document.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
const noClickSoon = () => { suppressClick = true; setTimeout(() => (suppressClick = false), 400); };
const vibrate = (ms) => { try { navigator.vibrate?.(ms); } catch { /* not allowed here */ } };

// axis 'x' (mini player) or 'y' (sheets close downwards). start(e) says whether a drag may begin here.
function swipe(el, axis, start, commit) {
  let p = null;
  const set = (dx, dy) => { el.style.setProperty('--dx', `${dx}px`); el.style.setProperty('--dy', `${dy}px`); };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.pointerType === 'mouse' && desktop()) || !start(e)) return;
    p = { id: e.pointerId, x: e.clientX, y: e.clientY, lock: null, d: 0, hist: [[e.timeStamp, 0]], raf: 0 };
  });
  el.addEventListener('pointermove', (e) => {
    if (!p || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.lock) {
      if (Math.hypot(dx, dy) < 8) return;
      p.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (p.lock !== axis || (axis === 'y' && dy < 0)) { p = null; return; }
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone: the drag still works without capture */ }
      el.classList.add('is-dragging');
    }
    p.d = axis === 'x' ? dx : Math.max(0, dy);
    p.hist.push([e.timeStamp, p.d]); if (p.hist.length > 6) p.hist.shift();
    if (!p.raf) p.raf = requestAnimationFrame(() => { if (p) { p.raf = 0; set(axis === 'x' ? p.d : 0, axis === 'y' ? p.d : 0); } });
  });
  const end = (e, cancel) => {
    if (!p || e.pointerId !== p.id) return;
    const { lock, d, hist } = p; cancelAnimationFrame(p.raf); p = null;
    if (!lock) return;
    noClickSoon();
    el.classList.remove('is-dragging'); set(0, 0);
    const [t0, d0] = hist[0], v = Math.abs(d - d0) / Math.max(1, e.timeStamp - t0);
    const far = axis === 'x' ? Math.abs(d) > 72 : d > 120;
    if (!cancel && (far || v > 0.5)) { vibrate(8); commit(axis === 'y' ? 'down' : d < 0 ? 'left' : 'right'); }
  };
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
}
// The mini player, full player and sheet drags live in motion-player.js (springs with velocity).
function closeDown(el, close) {
  if (motionOff()) return close();
  el.classList.add('swipe-commit-down');
  setTimeout(() => { close(); el.classList.remove('swipe-commit-down'); }, 240);
}
swipe($('#drawer'), 'y', (e) => !desktop() && e.target.closest('.drawer-tabs') && !e.target.closest('button'), () => closeDown($('#drawer'), () => openDrawer(null)));

// Long-press (450 ms, < 8 px) opens the item's menu on touch; the OS menu never shows.
let lastPointer = 'mouse', lp = null;
const lpCancel = () => { if (!lp) return; clearTimeout(lp.t); lp.el.classList.remove('is-pressed'); lp = null; };
document.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType;
  if (e.pointerType === 'mouse') return;
  const el = e.target.closest('.row[data-id], .row.pl-row, .qrow, .card, .tile[data-i], .qp, .gs-item[data-kind="track"], .gs-item[data-kind="web"]');
  if (!el || e.target.closest('.ico, .pill, input, .grip, .go')) return;
  lpCancel();
  el.classList.add('is-pressed');
  lp = { el, x: e.clientX, y: e.clientY, t: setTimeout(() => {
    const { el: target, x, y } = lp; lpCancel();
    vibrate(10); noClickSoon();
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, 450) };
}, true);
document.addEventListener('pointermove', (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpCancel(); }, true);
document.addEventListener('pointerup', lpCancel, true);
document.addEventListener('pointercancel', lpCancel, true);
document.addEventListener('contextmenu', (e) => { if (e.isTrusted && lastPointer !== 'mouse') { e.preventDefault(); e.stopPropagation(); } }, true);

// Grip reorder on touch: drag the handle, drop on another row.
function gripDrag(e, row, onDrop) {
  e.preventDefault(); e.stopPropagation();
  const sel = row.classList.contains('qrow') ? '.qrow' : '.row', y0 = e.clientY, g = e.currentTarget;
  g.setPointerCapture(e.pointerId);
  row.classList.add('is-dragging');
  let over = null;
  const move = (ev) => {
    row.style.setProperty('--dy', `${ev.clientY - y0}px`);
    const hit = $$(sel, row.parentElement).find((r) => r !== row && (({ top, bottom }) => ev.clientY >= top && ev.clientY < bottom)(r.getBoundingClientRect()));
    if (hit !== over) { over?.classList.remove('over'); over = hit; over?.classList.add('over'); }
  };
  const up = () => {
    g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
    row.classList.remove('is-dragging'); row.style.setProperty('--dy', '0px'); over?.classList.remove('over');
    noClickSoon();
    if (over) onDrop(+row.dataset.i, +over.dataset.i);
  };
  g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
}

// ---------- keyboard ----------
function trapFocus(e) {
  const box = OV.stack.length && { settings: '#settings', keys: '#keys', ask: '#ask', np: '#np', sheet: '#sheet' }[OV.stack.at(-1)];
  if (!box) return;
  const f = $$(`${box} button:not([disabled]), ${box} input:not([hidden]), ${box} [tabindex="0"]`).filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (i < 0 || (e.shiftKey && i === 0) || (!e.shiftKey && i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
}
function commandMode() { gsIn.value = '> '; gsIn.focus(); gsInput(); }
document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'Tab') return trapFocus(e);
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') { e.preventDefault(); return commandMode(); }
  if (k === 'Escape') { if (closeTop()) e.preventDefault(); else if (e.target.matches('input, textarea')) e.target.blur(); return; }
  if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); return k === 'ArrowLeft' ? history.back() : history.forward(); }
  if (e.target.matches?.('input:not([type=range]), textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches('input[type=range]') && k.startsWith('Arrow')) return;
  if (OV.stack.some((n) => ['settings', 'keys', 'ask', 'menu', 'sheet'].includes(n)) && k !== '?') return;
  const kl = k.toLowerCase();
  if (k === ' ') { if (e.target.matches('button, [role=button], .row, .qrow')) return; e.preventDefault(); togglePlay(); }
  else if (k === 'ArrowRight' && e.shiftKey) next(false);
  else if (k === 'ArrowLeft' && e.shiftKey) prev();
  else if (k === 'ArrowRight') audio.currentTime += 5;
  else if (k === 'ArrowLeft') audio.currentTime -= 5;
  else if (k === 'ArrowUp') { e.preventDefault(); setVol(Math.min(100, +vol.value + 5)); }
  else if (k === 'ArrowDown') { e.preventDefault(); setVol(Math.max(0, +vol.value - 5)); }
  else if (kl === 'l' && cur()) like(cur().id, undefined, $('#barLike'));
  else if (kl === 's') toggleShuffle();
  else if (kl === 'r') acts.repeat();
  else if (kl === 'f') setNP($('#np').hidden);
  else if (kl === 'q') openDrawer('queue');
  else if (kl === 'y') openDrawer('lyrics');
  else if (k === '/') { e.preventDefault(); gsIn.focus(); }
  else if (k === '?') { e.preventDefault(); $('#keys').hidden ? openKeys() : closeDlg('keys'); }
});

// Remote covers sometimes fail (rate limits, odd sizes): retry each one once through the server's image proxy.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.proxied || !/^https?:\/\//.test(img.src) || img.src.startsWith(location.origin)) return;
  img.dataset.proxied = '1';
  img.src = `/api/img?u=${encodeURIComponent(img.src)}`;
}, true);

// ---------- pull to refresh (phone): pills drop into a stack as you pull, then pop into the new content ----------
// Home also rubber-bands (motion-nav.js); these listeners are passive and only read the finger.
const ptr = $('#ptr'), PULL = 72, PULL_VIEWS = ['home', 'library', 'songs', 'albums', 'artists', 'liked', 'downloads'];
let pull = null;
function paintPull(p) {
  const n = Math.min(5, Math.floor(p * 5 + 0.2));
  if (+ptr.dataset.n === n) return;
  ptr.dataset.n = n; [...ptr.children].forEach((i, k) => i.classList.toggle('on', k < n));
}
$('#main').addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  pull = desktop() || H.dataset.layout !== 'phone' || e.touches.length > 1 || $('#main').scrollTop > 0 || !PULL_VIEWS.includes(S.view) || ptr.classList.contains('busy') ? null : { x: t.clientX, y: t.clientY, d: 0 };
}, { passive: true });
$('#main').addEventListener('touchmove', (e) => {
  if (!pull) return;
  const t = e.touches[0], dy = t.clientY - pull.y;
  if (dy < 0 || Math.abs(t.clientX - pull.x) > dy) { pull = null; paintPull(0); return; }
  pull.d = window.Spring ? Spring.rubber(dy, 140) : dy / 2;
  paintPull(pull.d / PULL);
}, { passive: true });
const pullEnd = () => { const p = pull; pull = null; if (p?.d >= PULL) refresh(); else paintPull(0); };
$('#main').addEventListener('touchend', pullEnd);
$('#main').addEventListener('touchcancel', () => { pull = null; paintPull(0); });
async function refresh() {
  ptr.classList.add('busy'); paintPull(1); vibrate(8);
  if (S.view === 'home') delete DISC[region()];
  try { await Promise.all([loadLib(), new Promise((r) => setTimeout(r, motionOff() ? 0 : 500))]); } catch (e) { toast(`Couldn't refresh: ${e.message}`); }
  pollJobs(); render(); fx('enter', $('#main'));
  ptr.classList.replace('busy', 'pop');
  setTimeout(() => { ptr.classList.remove('pop'); paintPull(0); }, motionOff() ? 0 : 380);
}

// ---------- start ----------
function initIcons() {
  const set = (sel, n) => $$(sel).forEach((b) => (b.innerHTML = svg(n)));
  const NAV_ICO = { home: 'home', get: 'get', songs: 'note', albums: 'album', artists: 'artist', liked: 'heart', search: 'search', library: 'library', downloads: 'get' };
  $$('#nav > button[data-view], #tabbar .tab').forEach((b) => b.querySelector('.nv-ico, .tab-ico').insertAdjacentHTML('afterbegin', svg(NAV_ICO[b.dataset.view])));
  set('#next, [data-act=next]', 'next'); set('#prev, [data-act=prev]', 'prev'); set('#shuffle, [data-act=shuffle]', 'shuffle');
  set('#queueBtn', 'queue'); set('#lyricsBtn', 'lyrics'); set('#fullBtn', 'full'); set('#npClose', 'down');
  set('#settingsBtn, #topSettings', 'tune'); set('#sideToggle', 'side'); set('#navBack', 'back'); set('#navFwd', 'fwd');
  set('.gs-ico', 'search'); set('#gsClear, #drawerClose, .dlg-x', 'x'); set('[data-act=sleep]', 'sleep');
  $('#sleepBtn').insertAdjacentHTML('afterbegin', svg('sleep'));
  $('#getAppNav .nv-ico').insertAdjacentHTML('afterbegin', svg('devices'));
}
function onLayoutChange() {
  paintLayout();
  if (!$('#np').hidden) setNPTab(S.npTab);
  render(); paintDrawer();
}
for (const m of Object.values(MQ)) m.addEventListener('change', onLayoutChange);

(async () => {
  // Launch: the pill stack turns into the disc, then opens into Home. Pure CSS; Motion Off never shows it.
  const ln = $('#launch');
  if (ln && motionOff()) ln.remove();
  else if (ln) { ln.addEventListener('animationend', (e) => e.target === ln && ln.remove()); setTimeout(() => ln.remove(), 3000); }
  initIcons();
  setSide(store.get('sideMin', false));
  setVol(store.get('vol', 80));
  paintControls(); paintSleep();
  H.dataset.np = 'closed'; H.dataset.gs = 'closed'; H.dataset.sheet = 'closed';
  const st = history.state; // a reload keeps the page you were on
  if (st?.v) { S.view = st.v; S.arg = st.a ?? null; NAV.p = NAV.len = st.p || 0; }
  history.replaceState({ v: S.view, a: S.arg, p: NAV.p }, '');
  paintNavBtns();
  render(); paintNow();
  try { await loadLib(); } catch (e) { $('#main').innerHTML = empty("Can't reach the app", `${esc(e.message)}. Is server.py running?`); return; }
  render(); fx('enter', $('#main')); paintNow(); paintDrawer();
  fx('trackChanged', cur() ? cover(cur()) : null);
  if (cur()) { // pick up where you left off, paused
    audio.src = srcFor(cur());
    audio.addEventListener('loadedmetadata', () => (audio.currentTime = store.get('pos', 0)), { once: true });
    setMediaSession(cur());
    loadLyrics(cur());
  }
  pollJobs();
  firstRun();
  setTimeout(updateNudge, 6000);
})();
