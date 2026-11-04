// OddlyClever Music — visual effects and appearance (DESIGN_SPEC section 8.4). Classic script in <head>: applies the theme
// before first paint. Works without app.js; app.js calls it defensively through window.FX.
(() => {
  'use strict';
  const root = document.documentElement;
  const KEY = 'ocm.appearance';
  const THEMES = [
    { id: 'night-market', name: 'Night Market', mood: 'Warm graphite with one ember accent. The house look.', modes: ['dark', 'light'], swatch: ['#0d0c0e', '#ff6b3d', '#161518'] },
    { id: 'glasshouse', name: 'Glasshouse', mood: 'Cool, airy and soft, with frosted glass over the music.', modes: ['dark', 'light'], swatch: ['#0a0c11', '#93a9ff', '#1b1f28'] },
    { id: 'vinyl-club', name: 'Vinyl Club', mood: 'A record-shop catalogue: paper, ink and amber.', modes: ['light', 'dark'], swatch: ['#f3efe7', '#a3470c', '#e9e3d8'] },
    { id: 'midnight-ink', name: 'Midnight Ink', mood: 'True black, hairlines and a lime accent. Nothing else.', modes: ['dark'], swatch: ['#000000', '#c6ff3d', '#111113'] },
    { id: 'sunset-tape', name: 'Sunset Tape', mood: 'Soft dusk tones, round shapes and a hot-pink accent.', modes: ['dark', 'light'], swatch: ['#110d13', '#ff5c93', '#241c27'] },
  ];
  // Theme bg per mode (meta theme-color) and the bg used to clamp cover colours for contrast.
  const BG = {
    'night-market': { dark: '#0d0c0e', light: '#eeece9' }, glasshouse: { dark: '#0a0c11', light: '#eceff5' },
    'vinyl-club': { dark: '#131210', light: '#f3efe7' }, 'midnight-ink': { dark: '#000000', light: '#000000' },
    'sunset-tape': { dark: '#110d13', light: '#f6efed' },
  };
  // Palette themes and My theme from theme-studio.js (loaded just before this file); t.bg stays live for My theme edits.
  for (const t of window.OCM_THEMES || []) { THEMES.push(t); BG[t.id] = t.bg; }
  const DEFAULTS = Object.freeze({ v: 1, theme: 'night-market', mode: 'auto', albumColours: true, aurora: false, motion: 'full', webFonts: true });
  const VALID = {
    theme: (v) => THEMES.some((t) => t.id === v), mode: (v) => ['light', 'dark', 'auto'].includes(v),
    motion: (v) => ['full', 'calm', 'off'].includes(v), albumColours: (v) => typeof v === 'boolean',
    aurora: (v) => typeof v === 'boolean', webFonts: (v) => typeof v === 'boolean',
  };
  const mq = (q) => window.matchMedia ? matchMedia(q) : { matches: false, addEventListener() {} };
  const mqDark = mq('(prefers-color-scheme: dark)'), mqReduce = mq('(prefers-reduced-motion: reduce)');
  const mqTouch = mq('(hover: none), (pointer: coarse)');

  const clean = (o) => {
    const s = {};
    if (o && typeof o === 'object') for (const k in VALID) if (k in o && VALID[k](o[k])) s[k] = o[k];
    return s;
  };
  let stored = (() => { try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return {}; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, ...stored })); } catch { /* private window: settings just don't stick */ } };

  const osMotion = () => (mqReduce.matches || mqTouch.matches ? 'calm' : 'full'); // phones default to calm for battery
  const settings = () => ({ ...DEFAULTS, ...stored, motion: stored.motion || osMotion() });
  const theme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
  const resolveMode = (s) => {
    const modes = theme(s.theme).modes, want = s.mode === 'auto' ? (mqDark.matches ? 'dark' : 'light') : s.mode;
    return modes.includes(want) ? want : modes[0];
  };
  let cur = settings(), mode = resolveMode(cur);
  const themeColor = () => BG[cur.theme][mode];

  function setMeta() {
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = themeColor();
  }
  // Inter is bundled in web/fonts (v2), so nothing loads from the web. Removes the old Google Fonts link if one is left.
  function setFonts() { document.getElementById('fxFonts')?.remove(); }
  function writeAttrs() {
    const d = root.dataset;
    d.theme = cur.theme; d.mode = mode; d.modePref = cur.mode; d.motion = cur.motion;
    d.motionSrc = stored.motion ? 'user' : 'os'; d.album = cur.albumColours ? 'on' : 'off';
    d.aurora = cur.aurora ? 'on' : 'off'; d.fonts = cur.webFonts ? 'web' : 'system';
    setMeta(); setFonts();
  }

  function applySettings(patch, o = {}) {
    const p = clean(patch), prevTheme = cur.theme, prevMode = mode;
    stored = { ...stored, ...p };
    if (Object.keys(p).length) save();
    cur = settings(); mode = resolveMode(cur);
    const themeChanged = cur.theme !== prevTheme || mode !== prevMode;
    if (themeChanged && !o.silent) viewTransition(writeAttrs, { kind: 'theme' }).catch(() => {});
    else writeAttrs();
    if (themeChanged && lastPal) applyPalette(lastPal.raw); // re-clamp cover colours for the new bg
    syncMotes();
    if (!o.silent) emit('fx:settings', { ...cur, themeColor: themeColor() });
    return { ...cur };
  }
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  // ---------- colour helpers ----------
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function toHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }
  function fromHsl([h, s, l]) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  // Move lightness until the colour reaches `need` contrast against bg (lighter on dark themes, darker on light).
  function clampFor(hsl, bg, need) {
    let [h, s, l] = hsl; const dark = lum(bg) < 0.2; s = Math.max(s, dark ? 0.45 : 0.62);
    for (let i = 0; i < 40 && contrast(fromHsl([h, s, l]), bg) < need; i++) l += dark ? 0.02 : -0.02;
    return [h, s, Math.max(0, Math.min(1, l))];
  }

  // ---------- palette extraction (off-DOM 24x24 canvas, cached) ----------
  const cache = new Map(), pending = new Map();
  let scratch;
  function extract(url) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (pending.has(url)) return pending.get(url);
    // Remote covers can fail (rate limits) or taint the canvas: retry once through the server's same-origin /api/img proxy.
    const proxy = /^https?:\/\//.test(url) && !url.startsWith(location.origin) ? `/api/img?u=${encodeURIComponent(url)}` : null;
    const load = (src, retry) => new Promise((res) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; img.decoding = 'async';
      const fail = () => res(retry ? load(retry, null) : null);
      img.onload = () => {
        try {
          scratch = scratch || Object.assign(document.createElement('canvas'), { width: 24, height: 24 });
          const cx = scratch.getContext('2d', { willReadFrequently: true });
          cx.clearRect(0, 0, 24, 24); cx.drawImage(img, 0, 0, 24, 24);
          res(analyse(cx.getImageData(0, 0, 24, 24).data));
        } catch { fail(); } // tainted canvas (cross-origin cover)
      };
      img.onerror = fail;
      img.src = src;
    });
    const job = load(url, proxy).then((raw) => {
      pending.delete(url);
      if (raw) { cache.set(url, raw); if (cache.size > 60) cache.delete(cache.keys().next().value); }
      return raw;
    });
    pending.set(url, job);
    return job;
  }
  function analyse(px) {
    const bins = new Map(); let sum = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const rgb = [px[i], px[i + 1], px[i + 2]], [h, s, l] = toHsl(rgb);
      sum += lum(rgb); n++;
      const key = s < 0.12 ? 'g' + Math.round(l * 4) : Math.round(h / 24) + ':' + Math.round(l * 3);
      const b = bins.get(key) || { r: 0, g: 0, b: 0, n: 0, score: 0 };
      b.r += rgb[0]; b.g += rgb[1]; b.b += rgb[2]; b.n++;
      b.score += s * (1 - Math.abs(l - 0.5) * 1.4) + 0.05;
      bins.set(key, b);
    }
    if (!n) return null;
    const ranked = [...bins.values()].sort((a, b) => b.score - a.score).map((b) => toHsl([b.r / b.n, b.g / b.n, b.b / b.n]));
    const picks = [];
    for (const c of ranked) {
      if (picks.every((p) => Math.min(Math.abs(p[0] - c[0]), 360 - Math.abs(p[0] - c[0])) > 28 || Math.abs(p[2] - c[2]) > 0.3)) picks.push(c);
      if (picks.length === 3) break;
    }
    while (picks.length < 3) picks.push(picks.length ? [(picks[0][0] + 40 * picks.length) % 360, picks[0][1], picks[0][2]] : [24, 0.6, 0.55]);
    return { picks, dark: sum / n < 0.25 };
  }
  // Turn a raw extraction into a Palette clamped for the current mode.
  function derive(raw) {
    const bg = rgbOf(BG[cur.theme][mode]), dark = mode === 'dark';
    const [p1, p2, p3] = raw.picks;
    const a1 = fromHsl(clampFor(p1, bg, 4.5)), a2 = fromHsl(clampFor(p2, bg, 3));
    const ink = contrast(a1, [0, 0, 0]) >= contrast(a1, [255, 255, 255]) ? '#0b0b0f' : '#ffffff';
    const tint = (p, l) => hex(...fromHsl([p[0], Math.min(p[1], dark ? 0.5 : 0.7), l]));
    return {
      accent: hex(...a1), accent2: hex(...a2), accentInk: ink,
      bg: tint(p1, dark ? 0.11 : 0.93), bg2: tint(p2, dark ? 0.2 : 0.86), c3: hex(...fromHsl([p3[0], Math.max(p3[1], 0.4), dark ? 0.5 : 0.75])),
      ink: dark ? '#f6f2ee' : '#1d1720', dark: raw.dark,
      // backdrop tints: vivid on dark themes, pastel on light ones (the clamped accents are for text, not washes)
      au: raw.picks.map((q) => hex(...fromHsl([q[0], Math.max(q[1], dark ? 0.6 : 0.7), dark ? 0.56 : 0.76]))),
      swatches: raw.picks.map((p) => hex(...fromHsl(p))),
    };
  }
  const pubPalette = (p) => p && { accent: p.accent, accent2: p.accent2, bg: p.bg, bg2: p.bg2, ink: p.ink, dark: p.dark, swatches: p.swatches };
  async function palette(url) {
    if (!url) return null;
    const raw = await extract(url);
    return raw ? pubPalette(derive(raw)) : null;
  }
  // Shared colour helpers: a cover's three main colours as [h, s, l], and a dark-to-light ramp of hex colours built from them.
  const coverHsl = (url) => (url ? extract(url).then((raw) => raw && raw.picks.map((p) => p.map((v) => +v.toFixed(3)))) : Promise.resolve(null));
  function ramp(picks, n = 6) {
    const [a, b = a] = picks, drift = (((b[0] - a[0]) % 360) + 540) % 360 - 180; // shortest way round to the second colour
    const s = a[1] < 0.12 ? a[1] : Math.min(0.85, Math.max(a[1], 0.38));
    return Array.from({ length: n }, (_, i) => { const k = i / (n - 1); return hex(...fromHsl([(a[0] + drift * k * 0.35 + 360) % 360, s, 0.14 + k * 0.68])); });
  }

  // ---------- track change: --album-* vars and the Now Playing backdrop ----------
  let trackSeq = 0, lastPal = null;
  const ALBUM_VARS = ['--album-accent', '--album-accent-2', '--album-accent-ink', '--album-bg', '--album-bg-2', '--album-c3', '--album-au-1', '--album-au-2', '--album-au-3'];
  function applyPalette(raw) {
    const p = derive(raw), st = root.style;
    st.setProperty('--album-accent', p.accent); st.setProperty('--album-accent-2', p.accent2);
    st.setProperty('--album-accent-ink', p.accentInk); st.setProperty('--album-bg', p.bg);
    st.setProperty('--album-bg-2', p.bg2); st.setProperty('--album-c3', p.c3);
    p.au.forEach((c, i) => st.setProperty(`--album-au-${i + 1}`, c));
    return p;
  }
  function clearPalette() { ALBUM_VARS.forEach((v) => root.style.removeProperty(v)); }
  // Track-change motion: the new cover deals in from the side you skipped to and the title follows.
  let lastPrev = 0, seenTrack = false;
  document.addEventListener('pointerdown', (e) => { if (e.target.closest?.('#prev, [data-act="prev"]')) lastPrev = performance.now(); }, true);
  function trackMotion() {
    if (!seenTrack) { seenTrack = true; return; } // not on first load
    if (cur.motion === 'off' || document.hidden) return;
    const dir = performance.now() - lastPrev < 1500 ? -1 : 1, calm = cur.motion === 'calm';
    lastPrev = 0;
    if (window.MotionPlayer) return MotionPlayer.trackMotion(dir); // springs (motion-player.js)
    const deal = (el, dx, delay = 0) => el?.animate(calm ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: `translate3d(${dx}, 0, 0) scale(.94)` }, { opacity: 1, transform: 'none' }],
      { duration: calm ? 150 : 460, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    if (root.dataset.np === 'open') {
      deal(document.querySelector('#np .cover-wrap'), `${dir * 22}%`);
      document.querySelectorAll('#np .np-meta > :not([hidden])').forEach((m, i) => deal(m, `${dir * 28}px`, 70 + i * 45));
    }
    requestAnimationFrame(() => { // a swipe on the mini player already animates it (swipe-enter-*)
      const bar = document.getElementById('bar');
      if (bar && !/swipe-enter/.test(bar.className)) bar.querySelectorAll('.now .cover-wrap, .now .meta').forEach((m, i) => deal(m, `${dir * 16}px`, i * 40));
    });
  }
  async function trackChanged(url, o) {
    const seq = ++trackSeq;
    if (url) trackMotion();
    if (!url) { lastPal = null; clearPalette(); root.style.removeProperty('--cover-url'); npLayer(null, null); setMeta(); emit('fx:palette', null); return null; }
    const raw = await extract(url);
    if (seq !== trackSeq) return null; // a newer track won
    root.style.setProperty('--cover-url', `url("${String(url).replace(/["\\\n]/g, encodeURIComponent)}")`);
    if (!raw) { lastPal = null; clearPalette(); npLayer(null, url); setMeta(); emit('fx:palette', null); return null; }
    lastPal = { raw, url };
    const p = applyPalette(raw);
    npLayer(p, url); setMeta();
    const out = pubPalette(p);
    emit('fx:palette', out);
    return out;
  }
  // A13: one layer = 3 palette gradients + a small blurred cover scaled up. New layers fade in over old ones.
  function npLayer(p, url) {
    const bg = document.getElementById('npBg');
    if (!bg) return;
    const layer = document.createElement('div');
    layer.className = 'fx-layer';
    if (p) { layer.style.setProperty('--g1', p.accent); layer.style.setProperty('--g2', p.c3); layer.style.setProperty('--g3', p.bg2); layer.style.setProperty('--g0', p.bg); }
    if (url) {
      const i = document.createElement('i');
      i.className = 'fx-layer';
      i.style.backgroundImage = `url("${String(url).replace(/["\\\n]/g, encodeURIComponent)}")`;
      layer.appendChild(i);
    }
    bg.appendChild(layer);
    const old = [...bg.children].filter((c) => c !== layer && c.classList.contains('fx-layer'));
    const done = () => old.forEach((c) => c.remove());
    if (cur.motion === 'off' || document.hidden) return done();
    layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' }).finished.then(done, done);
  }

  // ---------- view transitions ----------
  let vt = null, vtPending = null, lastTap = { el: null, t: 0 };
  document.addEventListener('click', (e) => {
    const tile = e.target.closest?.('.tile, .card');
    if (!tile || e.target.closest('.tile-play, .go')) return;
    const art = tile.querySelector('.tile-art, .cv');
    lastTap = { el: tile, t: performance.now() };
    flipFrom = art && cur.motion === 'full' ? { rect: art.getBoundingClientRect(), t: lastTap.t } : null;
  }, true);
  // FLIP fallback: a catalogue page renders its hero after a fetch, outside the page transition. When that hero
  // art appears, it grows out of the tile that was clicked.
  let flipFrom = null;
  function flipHero(node) {
    if (!flipFrom || performance.now() - flipFrom.t > 2500 || node.nodeType !== 1) return;
    const h = node.matches('.hero-art, .hero-banner') ? node : node.querySelector('.hero-art, .hero-banner');
    if (!h || !h.closest('#main')) return;
    const from = flipFrom.rect;
    flipFrom = null;
    requestAnimationFrame(() => {
      if (h.style.viewTransitionName || !h.isConnected) return; // the view transition is already morphing it
      const r = h.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const k = `translate(${from.left - r.left}px, ${from.top - r.top}px) scale(${from.width / r.width}, ${from.height / r.height})`;
      h.animate([{ transform: k, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }],
        { duration: 520, easing: 'cubic-bezier(.2,.9,.25,1)' });
    });
  }
  function viewTransition(fn, o = {}) {
    const kind = o.kind || 'page';
    // Phones skip the theme/mode wipe: snapshotting and re-rastering the whole recoloured page froze Android WebView
    // for ~0.7 s on stale, half-drawn frames. Without it the new look swaps in at once, when its tiles are ready.
    if (!document.startViewTransition || cur.motion === 'off' || document.hidden || vt || (kind === 'theme' && mqTouch.matches)) {
      return new Promise((res) => res(fn())).then(() => {
        if (kind === 'page' && cur.motion !== 'off') {
          const m = document.getElementById('main');
          if (m) { m.classList.remove('fx-page-in'); void m.offsetWidth; m.classList.add('fx-page-in'); }
        }
      });
    }
    root.dataset.vt = kind;
    // Shared-element morph: the tile you opened grows into the new page's hero art.
    const art = kind === 'page' && cur.motion === 'full' && performance.now() - lastTap.t < 900 && lastTap.el?.isConnected
      ? lastTap.el.querySelector('.tile-art, .cv') : null;
    let hero = null;
    if (art) art.style.viewTransitionName = 'hero-art';
    lastTap = { el: null, t: 0 };
    const update = async () => {
      vtPending = null;
      await fn();
      if (!art) return;
      art.style.viewTransitionName = '';
      hero = document.querySelector('#main .hero-art, #main .hero-banner');
      if (hero) { hero.style.viewTransitionName = 'hero-art'; flipFrom = null; }
    };
    let t;
    try { t = document.startViewTransition(update); } catch {
      if (art) art.style.viewTransitionName = '';
      delete root.dataset.vt; return new Promise((res) => res(fn()));
    }
    vt = t; vtPending = t;
    t.ready.catch(() => {});
    t.finished.catch(() => {}).finally(() => {
      if (hero) hero.style.viewTransitionName = '';
      if (vt === t) { vt = null; delete root.dataset.vt; } if (vtPending === t) vtPending = null; });
    return t.updateCallbackDone.then(() => {});
  }

  // ---------- A4 staggered entrance ----------
  const ENTER_SEL = '.hero, .home-greet, .shelf-head, section.shelf > h2, .qp, .tile, .card, .row, .qrow, .gs-item';
  function enter(el, o = {}) {
    if (vtPending) { vtPending.updateCallbackDone.then(() => enter(el, o), () => {}); return; } // DOM not swapped yet
    const box = el || document.getElementById('main');
    if (!box || cur.motion === 'off') return;
    const items = [...box.querySelectorAll(o.selector || ENTER_SEL)].slice(0, 24);
    items.forEach((it, i) => {
      if (cur.motion === 'calm') it.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out', fill: 'backwards' });
      else it.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 340, delay: Math.min(i * 28, 500), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
  }

  // ---------- A8 heart burst ----------
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3z"/></svg>';
  let bursts = 0;
  function burst(el, o = {}) {
    if (!el || cur.motion === 'off' || !el.getBoundingClientRect) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (cur.motion !== 'full' || bursts >= 3) return;
    bursts++;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const wrap = document.createElement('div');
    wrap.className = 'fx-burst'; wrap.setAttribute('aria-hidden', 'true');
    wrap.style.left = cx + 'px'; wrap.style.top = cy + 'px';
    const anims = [];
    for (let k = 0; k < 8; k++) {
      const p = document.createElement('i');
      if (o.kind !== 'spark' && k % 2 === 0) p.innerHTML = HEART; else p.className = 'dot';
      wrap.appendChild(p);
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.5, d = 28 + Math.random() * 18;
      anims.push(p.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).finished);
    }
    document.body.appendChild(wrap);
    Promise.all(anims).catch(() => {}).finally(() => { wrap.remove(); bursts--; });
  }

  // ---------- A20 ambient motes (the one canvas) ----------
  let canvas, ctx2, motes = [], sprite, rafId = 0, lastT = 0;
  function motesWanted() {
    return canvas && cur.aurora && cur.motion === 'full' && !document.hidden && root.dataset.np === 'open' && document.body?.classList.contains('playing');
  }
  function syncMotes() {
    if (motesWanted()) { if (!rafId) { canvas.classList.add('on'); sizeCanvas(); rafId = requestAnimationFrame(tick); } }
    else if (rafId || canvas?.classList.contains('on')) { cancelAnimationFrame(rafId); rafId = 0; canvas?.classList.remove('on'); }
  }
  function sizeCanvas() {
    const w = innerWidth, h = innerHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (!motes.length) motes = Array.from({ length: 28 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 18 + Math.random() * 54,
      vx: (Math.random() - 0.5) * 0.25, vy: -0.08 - Math.random() * 0.22, a: 0.05 + Math.random() * 0.12, c: Math.random() < 0.5 }));
  }
  function makeSprite(color) {
    const s = document.createElement('canvas'); s.width = s.height = 64;
    const c = s.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); return s;
  }
  function tick(t) {
    rafId = requestAnimationFrame(tick);
    if (t - lastT < 33) return; // 30 fps cap
    lastT = t;
    if (!sprite || ++sprite.age > 30) { // re-read the accent about once a second (it morphs with the cover)
      const cs = getComputedStyle(root), a = cs.getPropertyValue('--accent').trim(), b = cs.getPropertyValue('--accent-2').trim();
      sprite = sprite?.key === a + b ? { ...sprite, age: 0 } : { key: a + b, age: 0, a: makeSprite(a || '#fff'), b: makeSprite(b || '#fff') };
    }
    const w = canvas.width, h = canvas.height;
    ctx2.clearRect(0, 0, w, h);
    ctx2.globalCompositeOperation = mode === 'dark' ? 'lighter' : 'source-over';
    for (const m of motes) {
      m.x += m.vx; m.y += m.vy;
      if (m.y < -m.r) { m.y = h + m.r; m.x = Math.random() * w; }
      if (m.x < -m.r) m.x = w + m.r; else if (m.x > w + m.r) m.x = -m.r;
      ctx2.globalAlpha = m.a;
      ctx2.drawImage(m.c ? sprite.a : sprite.b, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
  }

  // ---------- data-cover-src: per-element cover colours ----------
  const coverQ = [];
  let coverBusy = 0;
  function queueCover(el) { if (!coverQ.includes(el)) coverQ.push(el); pumpCovers(); }
  function pumpCovers() {
    while (coverBusy < 2 && coverQ.length) {
      const el = coverQ.shift(), url = el.getAttribute('data-cover-src');
      if (!url || !el.isConnected) continue;
      coverBusy++;
      extract(url).then((raw) => raw && derive(raw)).then((p) => {
        if (p && el.isConnected && el.getAttribute('data-cover-src') === url) {
          el.style.setProperty('--cv-a', p.au[0]); el.style.setProperty('--cv-b', p.au[1]);
          el.style.setProperty('--cv-c', p.bg2); el.style.setProperty('--cv-ink', p.ink);
        }
      }).finally(() => { coverBusy--; pumpCovers(); });
    }
  }
  function scanCovers(node) {
    if (node.nodeType !== 1) return;
    if (node.hasAttribute('data-cover-src')) queueCover(node);
    node.querySelectorAll?.('[data-cover-src]').forEach(queueCover);
  }

  // ---------- startup ----------
  writeAttrs();
  const onScheme = () => { const m = resolveMode(cur); if (m !== mode) { mode = m; viewTransition(writeAttrs, { kind: 'theme' }).catch(() => {}); if (lastPal) applyPalette(lastPal.raw); emit('fx:settings', { ...cur, themeColor: themeColor() }); } };
  mqDark.addEventListener?.('change', onScheme);
  const onMotion = () => { if (!stored.motion) { cur = settings(); writeAttrs(); syncMotes(); emit('fx:settings', { ...cur, themeColor: themeColor() }); } };
  mqReduce.addEventListener?.('change', onMotion);
  mqTouch.addEventListener?.('change', onMotion);
  document.addEventListener('visibilitychange', () => { root.classList.toggle('fx-hidden', document.hidden); syncMotes(); });

  let readyRes;
  const ready = new Promise((r) => { readyRes = r; });
  function boot() {
    const body = document.body;
    if (!document.getElementById('fxAurora')) {
      const a = document.createElement('div');
      a.id = 'fxAurora'; a.setAttribute('aria-hidden', 'true'); a.innerHTML = '<i></i><i></i><i></i>';
      body.prepend(a);
    }
    canvas = document.getElementById('fxCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fxCanvas'; canvas.setAttribute('aria-hidden', 'true');
      const firstScript = [...body.children].find((c) => c.tagName === 'SCRIPT' || c.tagName === 'AUDIO');
      body.insertBefore(canvas, firstScript || null);
    }
    ctx2 = canvas.getContext('2d');
    addEventListener('resize', () => { if (rafId) sizeCanvas(); });
    scanCovers(body);
    new MutationObserver((list) => {
      for (const m of list) { if (m.type === 'attributes') queueCover(m.target); else m.addedNodes.forEach((n) => { scanCovers(n); flipHero(n); }); }
    }).observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-cover-src'] });
    new MutationObserver(syncMotes).observe(body, { attributes: true, attributeFilter: ['class'] }); // body.playing
    new MutationObserver(syncMotes).observe(root, { attributes: true, attributeFilter: ['data-np'] });
    syncMotes();
    readyRes();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();

  window.FX = {
    version: 1,
    themes: THEMES.map((t) => ({ ...t, modes: [...t.modes], swatch: [...t.swatch] })),
    defaults: DEFAULTS,
    ready,
    getSettings: () => ({ ...cur }),
    applySettings,
    get mode() { return mode; },
    get motion() { return cur.motion; },
    get themeColor() { return themeColor(); },
    trackChanged, palette, coverHsl, ramp, viewTransition, enter, burst,
  };
})();
