// OddlyClever Music: palette themes and the theme studio (VISUAL_V4 ideas 1-6). Classic script in <head>, loaded right
// before fx.js: it writes every palette theme's tokens before first paint and hands the list to fx.js (window.OCM_THEMES),
// so fx.js keeps owning the settings, storage and mode. The picker, photo/cover palettes and Shuffle wire up on load.
// Also runs under Node (tools/theme_contrast.js) for the contrast check: then it only exports the colour maths.
(() => {
  'use strict';
  // Ramps dark -> light (Raindrop and Prism run hue-wise). Names are ours.
  const PALETTES = [
    ['deep-sea', 'Deep Sea', 'Midnight navy fading up into steel blue.', ['#001233', '#001845', '#002855', '#023e7d', '#0353a4', '#0466c8', '#33415c', '#5c677d', '#7d8597', '#979dac']],
    ['marigold', 'Marigold', 'Ten steps of orange into lemon. Loud and sunny.', ['#ff7b00', '#ff8800', '#ff9500', '#ffa200', '#ffaa00', '#ffb700', '#ffc300', '#ffd000', '#ffdd00', '#ffea00']],
    ['raindrop', 'Raindrop', 'Hot pink through violet to sky blue.', ['#f72585', '#b5179e', '#7209b7', '#560bad', '#480ca8', '#3a0ca3', '#3f37c9', '#4361ee', '#4895ef', '#4cc9f0']],
    ['plum-velvet', 'Plum Velvet', 'Deep plum, dusty mauve and blush.', ['#190019', '#2b124c', '#522b5b', '#854f6c', '#dfb6b2', '#fbe4db']],
    ['pine-mist', 'Pine Mist', 'Cold slate and fog, very quiet.', ['#061418', '#11212d', '#253745', '#4a5c6a', '#9ba8ab', '#ccd0ce']],
    ['garnet-sand', 'Garnet Sand', 'Dark garnet on warm sand.', ['#561c24', '#6d2932', '#c7b7a3', '#e8d8c4']],
    ['ultraviolet', 'Ultraviolet', 'Electric violet all the way up to lilac.', ['#34117e', '#491ab1', '#6631d8', '#7b45f0', '#a081ff', '#b7a1ff', '#d0bcfc']],
    ['coral-dusk', 'Coral Dusk', 'Wine, rose and soft coral.', ['#4c1d3d', '#852e4e', '#a33757', '#dc586d', '#fb9590', '#ffb8a4']],
    ['prism', 'Prism', 'Six bright colours that all get along.', ['#f04770', '#f78c6a', '#ffd166', '#06d6a0', '#118ab2', '#073b4c']],
    ['lagoon', 'Lagoon', 'Deep teal water with a bright shallow edge.', ['#05161a', '#072e33', '#0c7075', '#0f969c', '#6da5c0', '#294d61']],
    ['emerald-champagne', 'Emerald Champagne', 'Racing green, old gold and champagne.', ['#013220', '#046a38', '#c9a227', '#f7e7ce']],
    ['navy-sapphire', 'Navy Sapphire', 'Ink navy, a sapphire flash, pale ice.', ['#000926', '#0f52ba', '#a6c5d8', '#d6e6f3']],
    ['bordeaux-silk', 'Bordeaux Silk', 'Bordeaux, scarlet and a pale silk pink.', ['#3f0e13', '#9b101d', '#d82639', '#fbe5e3']],
    ['rose-lavender', 'Rose Lavender', 'Old rose, pink and lavender haze.', ['#8b4a5a', '#b76e79', '#f4c2c2', '#e6d8ff']],
  ];
  const MINE_KEY = 'ocm.mytheme';
  const MINE_DEFAULT = ['#1b1035', '#3b1f6b', '#6a3fa0', '#b061c4', '#f08bb4', '#ffc9a8', '#fff1d6'];
  // Picker pills for the five original themes (their own tokens, dark to light). They keep their hand-made CSS.
  const CLASSIC = {
    'night-market': ['#0d0c0e', '#161518', '#2b292e', '#7d7874', '#c2410c', '#ff6b3d', '#f4f1ee'],
    glasshouse: ['#0a0c11', '#1b1f28', '#3b5bdb', '#697185', '#93a9ff', '#d6dbe6', '#eef1f7'],
    'vinyl-club': ['#131210', '#2d2924', '#a3470c', '#7a7265', '#e9a050', '#d9d1c3', '#f3efe7'],
    'midnight-ink': ['#000000', '#111113', '#202023', '#75757e', '#a1a1aa', '#c6ff3d', '#f5f5f7'],
    'sunset-tape': ['#110d13', '#241c27', '#c81e5b', '#8a798d', '#ff5c93', '#e9dcd8', '#fbf3f6'],
  };

  // ---------- colour maths ----------
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
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
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  const hsl = (h) => toHsl(rgbOf(h));
  const hx = (c) => hex(fromHsl(c));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); // rgb, t = share of b
  const chroma = ([, s, l]) => s * (1 - Math.abs(2 * l - 1));
  const hueGap = (a, b) => Math.min(Math.abs(a[0] - b[0]), 360 - Math.abs(a[0] - b[0]));
  // Step lightness (up on dark, down on light) until the colour reaches `need` against every surface.
  function reach(c, surfaces, need, up, extra = () => true) {
    let [h, s, l] = c;
    for (let i = 0; i < 100; i++) {
      const rgb = rgbOf(hx([h, s, l])); // test the rounded colour we actually ship
      if (surfaces.every((x) => contrast(rgb, x) >= need) && extra(rgb)) break;
      l = Math.max(0, Math.min(1, l + (up ? 0.01 : -0.01)));
    }
    return hx([h, s, l]);
  }

  // A full token set for one ramp in one mode. Every text colour is clamped to 4.5:1 on every surface it can sit on.
  const TINT_A = 0.86; // Home's scroll tint is this opaque over the ramp background (idea 5)
  function tokens(ramp, mode) {
    const dark = mode === 'dark', H = ramp.map(hsl);
    const byLum = [...H].sort((a, b) => lum(fromHsl(a)) - lum(fromHsl(b)));
    const base = dark ? byLum[0] : byLum[byLum.length - 1];
    const vivid = [...H].sort((a, b) => chroma(b) - chroma(a)), a1 = vivid[0];
    const a2 = vivid.find((c) => hueGap(c, a1) > 30) || vivid[1] || a1;
    const sh = base[0], ss = Math.min(base[1], dark ? 0.5 : 0.36);
    const surf = (l) => hx([sh, ss, l]);
    const L = dark ? { bg: 0.07, bg2: 0.09, panel: 0.105, raise: 0.15, line: 0.21 } : { bg: 0.94, bg2: 0.91, panel: 0.975, raise: 0.955, line: 0.86 };
    const t = {}; for (const k in L) t[k] = surf(L[k]);
    // washes: the ramp kept dark (or pale) enough to sit behind text
    const wash = (c) => hx([c[0], Math.min(c[1], 0.7), dark ? Math.min(Math.max(c[2], 0.14), 0.26) : Math.min(Math.max(c[2], 0.85), 0.92)]);
    const washes = H.map(wash), pick = (f) => washes[Math.round(f * (washes.length - 1))];
    t.top = washes[0]; t.mid = pick(0.5);
    const bgRgb = rgbOf(t.bg), panelRgb = rgbOf(t.panel);
    // Home scroll tints: panel leaning toward 5 points along the ramp, slightly see-through
    t.tints = [0, 0.25, 0.5, 0.75, 1].map((f) => mix(panelRgb, rgbOf(pick(f)), 0.35));
    const under = [bgRgb, rgbOf(t.top), rgbOf(t.mid)]; // what a see-through tint can sit on
    const surfaces = [t.bg, t.bg2, t.panel, t.raise, ...washes].map(rgbOf)
      .concat(t.tints.flatMap((c) => under.map((u) => mix(u, c, TINT_A))));
    t.ink = reach([sh, 0.25, dark ? 0.96 : 0.1], surfaces, 7, dark);
    t.dim = reach([sh, 0.16, dark ? 0.75 : 0.32], surfaces, 4.5, dark);
    t.mute = reach([sh, 0.12, dark ? 0.64 : 0.42], surfaces, 4.5, dark);
    t.accent = reach([a1[0], Math.max(a1[1], 0.55), a1[2]], surfaces, 4.5, dark, (rgb) => Math.max(contrast(rgb, [0, 0, 0]), contrast(rgb, [255, 255, 255])) >= 4.5);
    const acc = rgbOf(t.accent);
    t.accentInk = contrast(acc, [0, 0, 0]) >= contrast(acc, [255, 255, 255]) ? '#0b0a0d' : '#ffffff';
    t.accent2 = reach([a2[0], Math.max(a2[1], 0.5), a2[2]], [t.bg, t.panel].map(rgbOf), 3, dark);
    t.surfaces = surfaces; t.washes = washes;
    t.tintCss = t.tints.map((c) => `rgb(${c.map(Math.round).join(' ')} / ${TINT_A})`);
    const sd = fromHsl([byLum[0][0], byLum[0][1], 0.2]).map(Math.round); // light-mode shadows take the ramp's deep hue
    t.css = `color-scheme: ${mode};--bg:${t.bg};--bg-2:${t.bg2};--panel:${t.panel};--raise:${t.raise};--line:${t.line};` +
      `--ink:${t.ink};--dim:${t.dim};--mute:${t.mute};--t-accent:${t.accent};--t-accent-ink:${t.accentInk};--like:${t.accent};` +
      `--glass:rgb(${panelRgb.join(' ')} / .94);--sh:${dark ? '0 0 0' : sd.join(' ')};--sh-a:${dark ? 0.5 : 0.14};` +
      `--scrim:${dark ? 'rgb(0 0 0 / .6)' : `rgb(${rgbOf(t.ink).join(' ')} / .36)`};--accent-2:${t.accent2};` +
      `--ramp-top:${t.top};--ramp-mid:${t.mid};` + t.tintCss.map((c, i) => `--tint-${i}:${c};`).join('');
    return t;
  }
  const MATH = { PALETTES, MINE_DEFAULT, tokens, contrast, rgbOf, hsl, hx };
  if (typeof document === 'undefined') { module.exports = MATH; return; }

  // ---------- head: register the themes and write their CSS ----------
  const root = document.documentElement;
  const readMine = () => {
    try { const r = JSON.parse(localStorage.getItem(MINE_KEY)); if (Array.isArray(r) && r.length >= 3 && r.every((c) => /^#[0-9a-f]{6}$/i.test(c))) return r; } catch { /* no saved theme */ }
    return null;
  };
  const RAMPS = { ...CLASSIC };
  let varCache = null; // the picker's token lookup, dropped whenever the theme CSS is rewritten
  const list = PALETTES.map(([id, name, mood, ramp]) => { RAMPS[id] = ramp; return { id, name, mood, modes: ['dark', 'light'], swatch: [], bg: {} }; });
  const mine = { id: 'mine', name: 'My theme', mood: 'Made from a photo, a cover or a shuffle.', modes: ['dark', 'light'], swatch: [], bg: {} };
  list.push(mine);
  RAMPS.mine = readMine() || MINE_DEFAULT;
  const style = document.createElement('style');
  style.id = 'tsThemes';
  function writeCss() {
    varCache = null;
    style.textContent = list.map((t) => ['dark', 'light'].map((m) => {
      const k = tokens(RAMPS[t.id], m);
      t.bg[m] = k.bg; // fx.js reads this same object for meta theme-color and cover clamping
      if (m === 'dark') t.swatch = [k.bg, k.accent, k.raise];
      return `html[data-theme="${t.id}"][data-mode="${m}"]{${k.css}}`;
    }).join('\n')).join('\n') + `\nhtml:is(${list.map((t) => `[data-theme="${t.id}"]`).join(',')}){--r:16px;--r-sm:10px;--r-tile:10px}`;
  }
  writeCss();
  document.head.append(style);
  window.OCM_THEMES = list;
  const isPalette = (id) => list.some((t) => t.id === id);
  const markPalette = () => { if (isPalette(root.dataset.theme)) root.dataset.palette = ''; else delete root.dataset.palette; };
  new MutationObserver(markPalette).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- page: picker + studio ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  // A theme's tokens in one mode, read back from the stylesheets (classics live in themes.css, palettes in #tsThemes).
  const SEL = /^html\[data-theme="([\w-]+)"\](?:\[data-mode="(\w+)"\])?$/;
  function themeVars(id, mode) {
    if (!varCache) {
      varCache = {};
      for (const sh of document.styleSheets) {
        let rules; try { rules = sh.cssRules; } catch { continue; } // a cross-origin sheet can't be read; ours are all local
        for (const r of rules) {
          const m = r.selectorText && SEL.exec(r.selectorText);
          if (m && r.style.getPropertyValue('--bg')) (varCache[m[1]] ||= {})[m[2] || 'any'] = r.style;
        }
      }
    }
    const v = varCache[id] || {}, st = v[mode] || v.any || v.dark;
    if (!st) return '';
    return ['bg', 'panel', 'raise', 'line', 'ink', 'mute', 't-accent'].map((k) => `--m-${k}:${st.getPropertyValue('--' + k).trim()}`).join(';');
  }
  const GROUPS = [['classic', 'Classic'], ['palettes', 'Palettes'], ['yours', 'Yours']];
  const groupOf = (id) => (id === 'mine' ? 'yours' : CLASSIC[id] ? 'classic' : 'palettes');
  let shownMode = '';
  // A tiny app in the theme's own colours: a cover (the ramp), a title line and a player with the accent play button. Name only below;
  // the picked theme's mood line sits once above the rows (#tsNow), so the cards stay quiet.
  function card(t, cur, mode) {
    const ramp = RAMPS[t.id] || [], hero = CLASSIC[t.id] ? 'var(--m-t-accent), var(--m-raise)' : ramp.join(',');
    return `<button class="ts-card" type="button" role="radio" aria-checked="${t.id === cur}" tabindex="-1" data-ts-pick="${t.id}">` +
      `<span class="ts-mock" style="${themeVars(t.id, mode)};--hero:linear-gradient(135deg,${hero})" aria-hidden="true">` +
      '<i class="m-hero"></i><i class="m-l1"></i><i class="m-bar"><i class="m-play"></i></i></span>' +
      `<span class="ts-name">${esc(t.name)}</span></button>`;
  }
  function renderPicker() {
    const box = $('#tsPicker'); if (!box || !window.FX) return;
    const cur = FX.getSettings().theme, saved = !!readMine(), mode = root.dataset.mode || 'dark', hadFocus = box.contains(document.activeElement);
    shownMode = mode;
    const all = FX.themes.filter((t) => t.id !== 'mine' || saved || cur === 'mine');
    box.innerHTML = GROUPS.map(([g, name]) => {
      const items = all.filter((t) => groupOf(t.id) === g);
      const more = g === 'yours' ? '' : `<span class="ts-gcount">${items.length}</span>`;
      const make = g !== 'yours' ? '' : '<button class="ts-card ts-make" type="button" aria-expanded="false" aria-controls="tsStudio" data-ts-make>' +
        '<span class="ts-mock" aria-hidden="true"><i class="m-plus"></i></span><span class="ts-name">Make your own</span></button>';
      return `<div class="ts-group" role="group" aria-labelledby="tsGroup-${g}">` +
        `<div class="ts-ghead"><span class="ts-gname" id="tsGroup-${g}">${name}</span>${more}</div>` +
        `<div class="ts-row" id="tsRow-${g}">${items.map((t) => card(t, cur, mode)).join('')}${make}</div></div>`;
    }).join('');
    $('[data-ts-make]', box).setAttribute('aria-expanded', !$('#tsStudio').hidden);
    markPicked();
    if (hadFocus) $('[tabindex="0"]', box)?.focus({ preventScroll: true }); // the old cards are gone, keep keyboard users in place
    // a sideways row starts at its picked card, so the tick is on screen
    const on = $('[aria-checked="true"]', box), row = on?.parentElement;
    if (row && row.scrollWidth > row.clientWidth) row.scrollLeft += on.getBoundingClientRect().left - row.getBoundingClientRect().left - parseFloat(getComputedStyle(row).paddingLeft);
  }
  // Only the picked card is in the tab order; the arrow keys walk the rest (radio group pattern).
  function markPicked() {
    const cur = FX.getSettings().theme, cards = [...document.querySelectorAll('#tsPicker [data-ts-pick]')];
    const on = cards.find((b) => b.dataset.tsPick === cur) || cards[0];
    cards.forEach((b) => { b.setAttribute('aria-checked', b === on && b.dataset.tsPick === cur); b.tabIndex = b === on ? 0 : -1; });
    const now = $('#tsNow'), t = FX.themes.find((x) => x.id === cur);
    if (now) now.innerHTML = t ? `<b>${esc(t.name)}</b> <span>${esc(t.mood)}</span>` : '';
  }

  // Palette from an image: bucket the pixels, keep the commonest distinct colours, sort dark -> light.
  function rampFrom(img) {
    const c = document.createElement('canvas'), n = 48;
    c.width = c.height = n;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data, bins = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const b = bins.get(k) || bins.set(k, [0, 0, 0, 0]).get(k);
      b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
    }
    const cols = [...bins.values()].sort((a, b) => b[3] - a[3]).map((b) => toHsl([b[0] / b[3], b[1] / b[3], b[2] / b[3]]));
    const picks = [];
    for (const c2 of cols) {
      if (picks.every((p) => hueGap(p, c2) > 20 || Math.abs(p[2] - c2[2]) > 0.13)) picks.push(c2);
      if (picks.length === 8) break;
    }
    while (picks.length < 5) { const p = picks[0] || [260, 0.5, 0.4]; picks.push([p[0] + 12 * picks.length, p[1], 0.15 + 0.15 * picks.length]); }
    return picks.sort((a, b) => lum(fromHsl(a)) - lum(fromHsl(b))).map(hx);
  }
  // Shuffle: a random hue family, dark -> light.
  function shuffleRamp() {
    const h = Math.random() * 360, kind = Math.floor(Math.random() * 3), s = 0.55 + Math.random() * 0.35;
    const off = [(i) => i * 9, (i) => (i < 4 ? i * 6 : 180 + i * 6), (i) => (i % 3) * 120 + i * 4][kind];
    return Array.from({ length: 8 }, (_, i) => hx([h + off(i), s, 0.12 + i * 0.11]));
  }
  const loadImg = (src) => new Promise((ok, fail) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = fail; im.src = src; });
  async function rampFromUrl(url) {
    try { return rampFrom(await loadImg(url)); } catch (e) {
      // remote covers can taint the canvas: retry once through the server's same-origin proxy (as fx.js does)
      if (!/^https?:\/\//.test(url) || url.startsWith(location.origin)) throw e;
      return rampFrom(await loadImg(`/api/img?u=${encodeURIComponent(url)}`));
    }
  }

  let draft = null;
  function showDraft(ramp, msg) {
    draft = ramp;
    $('#tsPreview').hidden = false;
    $('#tsChips').innerHTML = ramp.map((c, i) => `<span class="ts-chip" style="--c:${c};--i:${i}"><code>${c.slice(1).toUpperCase()}</code></span>`).join('');
    say(msg);
  }
  const say = (msg) => { $('#tsMsg').textContent = msg || ''; };
  function saveDraft() {
    if (!draft) return;
    try { localStorage.setItem(MINE_KEY, JSON.stringify(draft)); } catch { say("Couldn't save it here (private window?), but it's on for now."); }
    RAMPS.mine = draft;
    if (FX.getSettings().theme === 'mine') FX.viewTransition(() => { writeCss(); renderPicker(); }, { kind: 'theme' });
    else { writeCss(); FX.applySettings({ theme: 'mine' }); }
    renderPicker();
    say('Saved as My theme.');
  }

  function wire() {
    const box = $('#tsPicker'); if (!box) return;
    renderPicker();
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ts-pick], [data-ts-make]');
      if (b?.dataset.tsPick) FX.applySettings({ theme: b.dataset.tsPick });
      else if (b) {
        const st = $('#tsStudio');
        st.hidden = !st.hidden;
        b.setAttribute('aria-expanded', !st.hidden);
        if (!st.hidden) st.scrollIntoView({ block: 'nearest', behavior: smooth() });
      }
    });
    box.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], b = e.target.closest('[data-ts-pick]');
      if (!dir || !b) return;
      const all = [...box.querySelectorAll('[data-ts-pick]')], n = all[(all.indexOf(b) + dir + all.length) % all.length];
      e.preventDefault(); n.focus(); n.click();
    });
    // the previews wear the current mode, so a mode change repaints them (fx.js sets data-mode inside the view transition,
    // after fx:settings has fired); anything else only moves the tick
    new MutationObserver(() => { if ((root.dataset.mode || 'dark') !== shownMode) renderPicker(); }).observe(root, { attributes: true, attributeFilter: ['data-mode'] });
    document.addEventListener('fx:settings', markPicked);

    $('#tsPhoto').addEventListener('click', () => $('#tsFile').click());
    $('#tsFile').addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; e.target.value = '';
      if (!f) return;
      const url = URL.createObjectURL(f);
      try { showDraft(rampFrom(await loadImg(url)), 'Here’s what I found in your photo.'); } catch { say("That photo didn't open. Try a JPG or PNG."); } finally { URL.revokeObjectURL(url); }
    });
    $('#tsCover').addEventListener('click', async () => {
      const src = $('#npCover')?.currentSrc || $('#barCover')?.currentSrc;
      if (!src) { say('Play a song first, then I can use its cover.'); return; }
      try { showDraft(await rampFromUrl(src), 'Pulled from the cover that’s playing.'); } catch { say("I couldn't read that cover. Try another song."); }
    });
    $('#tsShuffle').addEventListener('click', () => showDraft(shuffleRamp(), 'A fresh shuffle. Press again for another.'));
    $('#tsSave').addEventListener('click', saveDraft);
    wireSheet();
  }

  // ---------- the settings sheet: section tabs, arrow keys on the segmented controls, drag down to close ----------
  const smooth = () => (root.dataset.motion === 'full' && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto');
  function wireSheet() {
    const dlg = $('#settings'), card = $('.set-card', dlg || document), head = card && $('.set-head', card);
    if (!head) return;
    const links = [...head.querySelectorAll('.set-nav a')], secs = links.map((a) => $(a.getAttribute('href')));
    const top = (s) => s.offsetTop - head.offsetHeight - 8;
    head.querySelector('.set-nav').addEventListener('click', (e) => {
      const a = e.target.closest('a'); if (!a) return;
      e.preventDefault();
      card.scrollTo({ top: top($(a.getAttribute('href'))), behavior: smooth() });
    });
    function markTab() {
      let i = 0;
      secs.forEach((s, k) => { if (top(s) <= card.scrollTop + 24) i = k; });
      if (card.scrollTop + card.clientHeight >= card.scrollHeight - 4) i = secs.length - 1;
      links.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      card.classList.toggle('set-scrolled', card.scrollTop > 4);
    }
    let raf = 0;
    card.addEventListener('scroll', () => { raf ||= requestAnimationFrame(() => { raf = 0; markTab(); }); }, { passive: true });

    dlg.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], b = e.target.closest('.seg [role=radio]');
      if (!dir || !b) return;
      const bs = [...b.parentElement.querySelectorAll('[role=radio]:not(:disabled)')], n = bs[(bs.indexOf(b) + dir + bs.length) % bs.length];
      e.preventDefault(); n.focus(); n.click();
    });
    $('#setKeys')?.addEventListener('click', () => {
      $('.dlg-x', dlg).click();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });

    // Drag the header down to close (phone sheet only). Past 120 px, or a quick flick, closes; otherwise it springs back.
    let drag = null, anim = null, coverT = 0;
    const put = (y) => { // the scrim fades with the drag, so it doesn't vanish in one jump after the sheet has gone
      card.style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
      dlg.style.setProperty('--k', y ? (1 - Math.min(1, y / card.offsetHeight)).toFixed(3) : '');
    };
    // While the sheet sits open it hides the page behind (CSS: html.ts-covered), so a theme or mode change re-rasters
    // only the sheet; with the page and live scene too, phones ran out of tile memory and drew half-blank frames.
    const cover = (on) => { clearTimeout(coverT); if (!on) root.classList.remove('ts-covered'); else coverT = setTimeout(() => root.classList.add('ts-covered'), 450); };
    head.addEventListener('pointerdown', (e) => {
      if (e.button || !matchMedia('(max-width: 1024px)').matches || e.target.closest('button, a, input, select')) return;
      anim?.stop(); cover(false);
      card.style.animation = 'none'; // the open animation's fill would otherwise win over the drag transform
      drag = { y0: e.clientY, y: 0, t: e.timeStamp, v: 0 };
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const y = Math.max(0, e.clientY - drag.y0), dt = e.timeStamp - drag.t;
      if (dt > 0) drag.v = (y - drag.y) / dt;
      drag.y = y; drag.t = e.timeStamp; put(y);
    });
    const release = () => {
      if (!drag) return;
      const { y, v } = drag; drag = null;
      if (!y) return;
      const close = y > 120 || v > 0.6;
      let shut = false;
      const finish = () => { if (shut) return; shut = true; if (close) $('.dlg-x', dlg).click(); else cover(true); };
      // closes as soon as the sheet is off screen, not after the spring's long settling tail
      anim = window.Spring.animate({ from: y, to: close ? card.offsetHeight : 0, velocity: v * 1000, preset: 'sheet',
        onUpdate: (p) => { put(p); if (close && p >= card.offsetHeight - 2) { anim?.stop(); finish(); } }, onDone: finish });
    };
    head.addEventListener('pointerup', release);
    head.addEventListener('pointercancel', release);

    // each time the sheet opens: fresh picker (a theme saved elsewhere shows up), top tab marked, no leftover drag
    new MutationObserver(() => {
      anim?.stop(); put(0); card.style.animation = ''; cover(!dlg.hidden);
      if (!dlg.hidden) { renderPicker(); requestAnimationFrame(markTab); }
    }).observe(dlg, { attributes: true, attributeFilter: ['hidden'] });
  }
  addEventListener('DOMContentLoaded', () => { markPalette(); wire(); }, { once: true });
})();
