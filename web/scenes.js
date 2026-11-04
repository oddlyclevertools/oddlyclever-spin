// Capsule scenes and live backgrounds (window.Scenes). Our own layered landscapes in procedural SVG: sky, 2-3 depth layers,
// one hero, details (stars, glow, aurora, reflection) and grain. Every scene wears a colour ramp (dark -> light), so it can take
// any theme or album palette. Classic script, loaded after fx.js; it owns the live background layer and the settings picker.
(() => {
  const root = document.documentElement;
  const H = 600;  // design height; width follows the box's aspect so wide screens get more land, not stretched art
  const KEY = 'ocm.scene';
  let uid = 0;

  // ---------- small helpers ----------
  const f1 = (v) => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rng = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };

  // ---------- colour ----------
  const parseHex = (h) => { h = h.replace('#', ''); if (h.length < 6) h = h.replace(/./g, '$&$&'); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const light = (c) => Math.cbrt(0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]));  // ~perceived lightness 0..1
  let probe, pctx;
  function cssRGB(v) {  // any CSS colour (hex, rgb, color-mix, oklch) -> [r, g, b]
    v = String(v || '').trim();
    if (!v) return null;
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return parseHex(v);
    if (!probe) { probe = document.createElement('i'); probe.style.display = 'none'; document.body.appendChild(probe); }
    probe.style.color = ''; probe.style.color = v;
    if (!probe.style.color) return null;
    const got = getComputedStyle(probe).color;
    if (got.startsWith('rgb')) return got.match(/[\d.]+/g).slice(0, 3).map(Number);
    if (!pctx) pctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    pctx.clearRect(0, 0, 1, 1); pctx.fillStyle = got; pctx.fillRect(0, 0, 1, 1);
    return [...pctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }
  // A ramp becomes c(t): the colour at lightness t (0 = deepest, 1 = lightest). Stops sit at their own lightness, and a deep
  // and a light end are added when the ramp lacks them, so silhouettes stay dark and stars stay bright on any palette.
  function makeRamp(list) {
    if (typeof list === 'string') list = RAMPS[list];
    let cols = (Array.isArray(list) ? list : []).map((c) => (Array.isArray(c) ? c : cssRGB(c))).filter(Boolean);
    if (cols.length < 2) cols = themeRamp().map(cssRGB);
    cols.sort((a, b) => light(a) - light(b));
    if (light(cols[0]) > 0.24) cols.unshift(mix(cols[0], [4, 4, 10], 0.78));
    if (light(cols.at(-1)) < 0.86) cols.push(mix(cols.at(-1), [255, 255, 255], 0.62));
    const L = cols.map(light), lo = L[0], span = L.at(-1) - lo || 1;
    const stops = cols.map((c, i) => ({ c, p: (L[i] - lo) / span }));
    const c = (t) => {
      t = clamp(t, 0, 1);
      for (let i = 1; i < stops.length; i++) if (t <= stops[i].p) { const s = stops[i - 1], e = stops[i]; return hex(mix(s.c, e.c, (t - s.p) / (e.p - s.p || 1))); }
      return hex(stops.at(-1).c);
    };
    c.key = cols.map(hex).join();
    return c;
  }
  // Ramps from VISUAL_V4.md (dark -> light), used by forSeed and available to everyone as Scenes.RAMPS.
  const RAMPS = {
    'deep-sea': ['#001233', '#001845', '#002855', '#023E7D', '#0353A4', '#0466C8', '#33415C', '#5C677D', '#7D8597', '#979DAC'],
    'sunset-tape': ['#FF7B00', '#FF8800', '#FF9500', '#FFA200', '#FFAA00', '#FFB700', '#FFC300', '#FFD000', '#FFDD00', '#FFEA00'],
    raindrop: ['#F72585', '#B5179E', '#7209B7', '#560BAD', '#480CA8', '#3A0CA3', '#3F37C9', '#4361EE', '#4895EF', '#4CC9F0'],
    'plum-velvet': ['#190019', '#2B124C', '#522B5B', '#854F6C', '#DFB6B2', '#FBE4DB'],
    'pine-mist': ['#061418', '#11212D', '#253745', '#4A5C6A', '#9BA8AB', '#CCD0CE'],
    'garnet-sand': ['#561C24', '#6D2932', '#C7B7A3', '#E8D8C4'],
    ultraviolet: ['#34117E', '#491AB1', '#6631D8', '#7B45F0', '#A081FF', '#B7A1FF', '#D0BCFC'],
    'coral-dusk': ['#4C1D3D', '#852E4E', '#A33757', '#DC586D', '#FB9590', '#FFB8A4'],
    prism: ['#F04770', '#F78C6A', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'],
    lagoon: ['#05161A', '#072E33', '#0C7075', '#0F969C', '#6DA5C0', '#294D61'],
    'emerald-champagne': ['#013220', '#046A38', '#C9A227', '#F7E7CE'],
    'navy-sapphire': ['#000926', '#0F52BA', '#A6C5D8', '#D6E6F3'],
    'bordeaux-silk': ['#3F0E13', '#9B101D', '#D82639', '#FBE5E3'],
    'rose-lavender': ['#8B4A5A', '#B76E79', '#F4C2C2', '#E6D8FF'],
  };
  // The current theme as a ramp: A's --ramp-1..10 when a theme sets them, else a ramp grown from --accent / --accent-2.
  function themeRamp() {
    const cs = getComputedStyle(root), v = (n) => cs.getPropertyValue(n).trim();
    const own = Array.from({ length: 10 }, (_, i) => v(`--ramp-${i + 1}`)).filter(Boolean);
    if (own.length >= 3) return own;
    const a = cssRGB(v('--accent')) || [147, 169, 255], a2 = cssRGB(v('--accent-2')) || a, deep = [6, 6, 14];
    return [mix(a, deep, 0.92), mix(a2, deep, 0.74), mix(a, deep, 0.5), a2, a, mix(a, [255, 255, 255], 0.55)].map(hex);
  }

  // ---------- drawing kit ----------
  function ridge(k, base, amp, waves = 1.5, floor = H * 2, step = 6) {
    const ph = [k.r() * 6.3, k.r() * 6.3, k.r() * 6.3];
    const at = (x) => { const u = (x / H) * waves; return base - amp * (0.6 * Math.sin(u * 3.1 + ph[0]) + 0.28 * Math.sin(u * 7.3 + ph[1]) + 0.12 * Math.sin(u * 17 + ph[2])); };
    let top = '';
    for (let x = -60; x <= k.W + 60; x += step) top += `${top ? 'L' : 'M'}${f1(x)} ${f1(at(x))}`;
    return { at, top, d: `M-60 ${floor}L${top.slice(1)}L${k.W + 60} ${floor}Z` };
  }
  function peaks(k, base, hMin, hMax, gap, floor = H * 2) {
    const pts = []; let x = -80 - k.r() * gap, up = k.r() < 0.5;
    while (x < k.W + 80 + gap) { pts.push([x, base - (up ? hMin + k.r() * (hMax - hMin) : hMin * (0.15 + k.r() * 0.35))]); up = !up; x += gap * (0.55 + k.r() * 0.7); }
    return { pts, d: `M${f1(pts[0][0])} ${floor}` + pts.map(([px, py]) => `L${f1(px)} ${f1(py)}`).join('') + `L${f1(pts.at(-1)[0])} ${floor}Z` };
  }
  function caps(pts, t) {  // snow caps: the top part of every peak with a zigzag lower edge
    let d = '';
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], L = pts[i - 1], R = pts[i + 1];
      if (y > L[1] || y > R[1]) continue;
      const at = (p, s) => [x + (p[0] - x) * s, y + (p[1] - y) * s];
      const a = at(L, t), b = at(R, t), m1 = at(L, t * 0.55), m2 = at(R, t * 0.7);
      d += `M${f1(x)} ${f1(y)}L${f1(a[0])} ${f1(a[1])}L${f1((a[0] + m1[0]) / 2 + 4)} ${f1(m1[1] + 6)}L${f1(x - 2)} ${f1((a[1] + y) / 2 + 2)}L${f1(m2[0])} ${f1(m2[1] + 7)}L${f1(b[0])} ${f1(b[1])}Z`;
    }
    return d;
  }
  function pine(x, y, h) {
    const w = h * 0.4;
    let d = `M${f1(x - h * 0.025)} ${f1(y)}h${f1(h * 0.05)}v${f1(-h * 0.12)}h${f1(-h * 0.05)}Z`;
    for (let i = 0; i < 3; i++) { const b = y - h * (0.08 + 0.22 * i), ww = w * (1 - 0.24 * i); d += `M${f1(x - ww / 2)} ${f1(b)}L${f1(x)} ${f1(b - h * 0.48)}L${f1(x + ww / 2)} ${f1(b)}Z`; }
    return d;
  }
  function forest(k, at, gap, hMin, hMax, x0 = -30, x1 = k.W + 30) {
    let d = ''; const n = Math.max(1, Math.ceil((x1 - x0) / gap));
    for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + k.r() * 0.8) / n; d += pine(x, at(x) + 6, hMin + k.r() * (hMax - hMin)); }
    return d;
  }
  function stars(k, density, yMax, col, rMax = 1.6) {
    const n = Math.round((density * k.W) / 100); let a = '', b = '';
    for (let i = 0; i < n; i++) {
      const x = k.r() * k.W, y = k.r() ** 1.4 * yMax, r = 0.5 + k.r() ** 3 * rMax;
      const s = r > 1.5 ? `<path d="M${f1(x)} ${f1(y - r * 3)}L${f1(x + r * 0.5)} ${f1(y)}L${f1(x)} ${f1(y + r * 3)}L${f1(x - r * 0.5)} ${f1(y)}ZM${f1(x - r * 3)} ${f1(y)}L${f1(x)} ${f1(y - r * 0.5)}L${f1(x + r * 3)} ${f1(y)}L${f1(x)} ${f1(y + r * 0.5)}Z"/>` : `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>`;
      if (i % 2) a += s; else b += s;
    }
    return [`<g fill="${col}">${a}</g>`, `<g fill="${col}">${b}</g>`];
  }
  function dashes(k, n, x0, x1, y0, y1, len, col, op = 0.5) {
    let d = '';
    for (let i = 0; i < n; i++) { const y = y0 + k.r() * (y1 - y0), x = x0 + k.r() * (x1 - x0), l = len * (0.4 + k.r()); d += `M${f1(x - l / 2)} ${f1(y)}h${f1(l)}`; }
    return `<path d="${d}" stroke="${col}" stroke-width="1.3" stroke-linecap="round" opacity="${op}"/>`;
  }
  const rect = (W, fill) => `<rect x="-60" y="-60" width="${W + 120}" height="${H + 120}" fill="${fill}"/>`;
  const mirror = (y, op, svg) => `<g transform="translate(0 ${f1(2 * y)}) scale(1 -1)" opacity="${op}">${svg}</g>`;
  const glow = (x, y, rx, ry, fill) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"/>`;

  // A layer: depth for parallax (0 = sky, 1 = nearest), an optional animation and its pivot in scene units.
  const L = (d, svg, a = '', o = null, tall = false) => ({ d, svg, a, o, tall });

  // ---------- the scenes ----------
  const SCENES = {
    aurora: { name: 'Aurora lake', draw(k) {
      const { W, c } = k, hz = H * 0.64, hx = k.hx(0.7);
      const [s1, s2] = stars(k, 24, hz - 50, c(1));
      // aurora curtains: one rect per ray on a wavy foot line, so each ray gets its own foot-to-tip fade
      const curtain = (yc, len, amp, w, fill) => {
        const ph = k.r() * 6, ph2 = k.r() * 6; let s = '';
        for (let x = -80; x <= W + 80; x += 4) {
          const y = yc + amp * Math.sin((x / H) * w + ph), l = len * (0.5 + 0.3 * Math.sin((x / H) * w * 2.3 + ph2) + 0.2 * k.r());
          s += `<rect x="${f1(x)}" y="${f1(y - l)}" width="5" height="${f1(l)}"/>`;
        }
        return `<g fill="${fill}">${s}</g>`;
      };
      const g = (col) => k.lin([[0, col, 0], [0.5, col, 0.25], [0.88, col, 0.85], [1, col, 0.1]]);
      const ribbons = curtain(H * 0.34, 130, 46, 4.6, g(c(0.9))) + curtain(H * 0.44, 80, 26, 6.2, g(c(0.72)));
      const mtn = peaks(k, hz, 40, 120, 90, hz), shore = ridge(k, H * 0.9, 14, 1.2);
      const ty = shore.at(hx) + 3;
      const edge = forest(k, shore.at, 22, 70, 130, -30, W * 0.26) + forest(k, shore.at, 22, 70, 130, W * 0.8, W + 30);
      return [
        L(0.03, rect(W, k.lin([[0, c(0.02)], [0.635, c(0.24)], [0.64, c(0.15)], [1, c(0.03)]])) + glow(W / 2, hz, W * 0.8, H * 0.16, k.rad(c(0.6), 0.35))),
        L(0.03, s1, 'tw1'), L(0.03, s2, 'tw2'),
        L(0.06, `<g filter="${k.blur(2.5)}">${ribbons}${mirror(hz, 0.26, ribbons)}</g>`, 'aur', [W / 2, hz]),
        L(0.16, `<path d="${mtn.d}" fill="${c(0.1)}"/>` + mirror(hz, 0.5, `<path d="${mtn.d}" fill="${c(0.1)}"/>`)),
        L(0.22, dashes(k, Math.round(W / 9), 0, W, hz + 6, H * 0.86, 22, c(0.88), 0.45), 'shim'),
        L(0.5, glow(hx, ty - 10, 70, 34, k.rad(c(0.95), 0.55)), 'pulse', [hx, ty - 10]),
        L(0.5, `<path d="${shore.d}${edge}" fill="${c(0.03)}"/><path d="M${f1(hx - 36)} ${f1(ty)}L${f1(hx)} ${f1(ty - 46)}L${f1(hx + 36)} ${f1(ty)}Z" fill="${c(0.08)}"/><path d="M${f1(hx - 10)} ${f1(ty)}L${f1(hx)} ${f1(ty - 30)}L${f1(hx + 10)} ${f1(ty)}Z" fill="${c(0.96)}"/><path d="M${f1(hx)} ${f1(ty - 46)}l-4 -8M${f1(hx)} ${f1(ty - 46)}l4 -8" stroke="${c(0.08)}" stroke-width="2"/>`),
      ];
    } },

    lighthouse: { name: 'Night beacon', draw(k) {
      const { W, c } = k, hz = H * 0.62, hx = k.hx(0.68);
      const [s1, s2] = stars(k, 18, hz - 40, c(1));
      const mx = W > H * 0.8 ? W * 0.2 : W * 0.24, my = H * 0.13;
      const top = hz - 36, base = top, th = 150, hw = (t) => 18 - 6 * t;
      const trap = (t0, t1, fill) => `<path d="M${f1(hx - hw(t0))} ${f1(base - th * t0)}L${f1(hx - hw(t1))} ${f1(base - th * t1)}L${f1(hx + hw(t1))} ${f1(base - th * t1)}L${f1(hx + hw(t0))} ${f1(base - th * t0)}Z" fill="${fill}"/>`;
      const tt = base - th, lx = hx, ly = tt - 15, Lb = Math.max(W, H) * 0.9;
      const rock = `<path d="M${f1(hx - 120)} ${f1(hz + 40)}C${f1(hx - 96)} ${f1(hz - 8)} ${f1(hx - 64)} ${f1(top - 4)} ${f1(hx - 30)} ${f1(top)}L${f1(hx + 34)} ${f1(top)}C${f1(hx + 62)} ${f1(top + 2)} ${f1(hx + 84)} ${f1(hz - 8)} ${f1(hx + 128)} ${f1(hz + 40)}Z" fill="${c(0.07)}"/>`;
      const tower = trap(0, 1, c(0.84)) + trap(0.2, 0.4, c(0.3)) + trap(0.6, 0.8, c(0.3))
        + `<rect x="${f1(hx - 17)}" y="${f1(tt - 6)}" width="34" height="6" fill="${c(0.1)}"/><rect x="${f1(hx - 9)}" y="${f1(tt - 24)}" width="18" height="18" fill="${c(1)}"/>`
        + `<path d="M${f1(hx - 3)} ${f1(tt - 24)}v18M${f1(hx + 3)} ${f1(tt - 24)}v18" stroke="${c(0.2)}" stroke-width="1.2"/><path d="M${f1(hx - 11)} ${f1(tt - 24)}Q${f1(hx)} ${f1(tt - 40)} ${f1(hx + 11)} ${f1(tt - 24)}Z" fill="${c(0.1)}"/>`
        + `<rect x="${f1(hx - 4)}" y="${f1(base - 18)}" width="8" height="18" rx="4" fill="${c(0.12)}"/>`;
      const beam = `<path d="M${f1(lx)} ${f1(ly - 3)}L${f1(lx - Lb)} ${f1(ly - 50)}L${f1(lx - Lb)} ${f1(ly + 42)}L${f1(lx)} ${f1(ly + 3)}Z" fill="${k.lin([[0, c(1), 0.5], [1, c(1), 0]], 1, 0, 0, 0)}"/><path d="M${f1(lx)} ${f1(ly - 3)}L${f1(lx + Lb)} ${f1(ly - 38)}L${f1(lx + Lb)} ${f1(ly + 30)}L${f1(lx)} ${f1(ly + 3)}Z" fill="${k.lin([[0, c(1), 0.35], [1, c(1), 0]], 0, 0, 1, 0)}"/>`;
      const w1 = ridge(k, H * 0.9, 7, 7), w2 = ridge(k, H * 0.965, 6, 9);
      return [
        L(0.03, rect(W, k.lin([[0, c(0.03)], [0.615, c(0.3)], [0.62, c(0.15)], [1, c(0.04)]])) + glow(mx, my, 90, 90, k.rad(c(0.9), 0.45)) + `<circle cx="${f1(mx)}" cy="${f1(my)}" r="20" fill="${c(0.98)}"/>`),
        L(0.03, s1, 'tw1'), L(0.03, s2, 'tw2'),
        L(0.2, dashes(k, Math.round(W / 10), 0, W, hz + 6, H * 0.88, 18, c(0.8), 0.35) + dashes(k, 26, lx - 30, lx + 30, hz + 40, H * 0.9, 26, c(0.95), 0.55) + dashes(k, 14, mx - 18, mx + 18, hz + 6, H * 0.8, 20, c(0.95), 0.4), 'shim'),
        L(0.4, beam, 'beam', [lx, ly]),
        L(0.4, rock + tower),
        L(0.4, glow(lx, ly, 70, 70, k.rad(c(1), 0.75)), 'pulse', [lx, ly]),
        L(0.7, `<path d="${w1.d}" fill="${c(0.05)}"/><path d="${w1.top}" fill="none" stroke="${c(0.3)}" stroke-width="1.2" opacity=".5"/><path d="${w2.d}" fill="${c(0.02)}"/>`),
      ];
    } },

    watchtower: { name: 'Ember watch', draw(k) {
      const { W, c } = k, hz = H * 0.6, hx = k.hx(0.72), sx = W > H * 0.8 ? W * 0.52 : W * 0.5;
      const r1 = ridge(k, hz + 10, 26, 1.4), r2 = ridge(k, hz + 52, 34, 1.8), r3 = ridge(k, H * 0.8, 18, 2), hill = ridge(k, H * 0.88, 26, 0.9);
      const gy = hill.at(hx) + 4, ink = c(0.08);
      const ln = (x1, y1, x2, y2, w) => `<path d="M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}" stroke="${ink}" stroke-width="${w}" stroke-linecap="round"/>`;
      const tower = ln(hx - 28, gy, hx - 16, gy - 120, 5) + ln(hx + 28, gy, hx + 16, gy - 120, 5)
        + ln(hx - 26, gy - 10, hx + 18, gy - 60, 2.4) + ln(hx + 26, gy - 10, hx - 18, gy - 60, 2.4) + ln(hx - 18, gy - 60, hx + 17, gy - 112, 2.4) + ln(hx + 18, gy - 60, hx - 17, gy - 112, 2.4)
        + ln(hx - 20, gy - 60, hx + 20, gy - 60, 3)
        + `<rect x="${f1(hx - 27)}" y="${f1(gy - 152)}" width="54" height="34" fill="${ink}"/><rect x="${f1(hx - 15)}" y="${f1(gy - 145)}" width="30" height="14" fill="${c(0.97)}"/>`
        + `<path d="M${f1(hx - 36)} ${f1(gy - 150)}L${f1(hx)} ${f1(gy - 178)}L${f1(hx + 36)} ${f1(gy - 150)}Z" fill="${c(0.05)}"/>` + ln(hx - 32, gy - 120, hx + 32, gy - 120, 3);
      let birds = '';
      for (let i = 0; i < 5; i++) { const x = W * (0.2 + k.r() * 0.6), y = H * (0.18 + k.r() * 0.2), s = 0.6 + k.r() * 0.6; birds += `M${f1(x)} ${f1(y)}q${f1(4 * s)} ${f1(-4 * s)} ${f1(8 * s)} 0q${f1(4 * s)} ${f1(-4 * s)} ${f1(8 * s)} 0`; }
      let edge = '';
      [[-10, 210], [W * 0.06, 160], [W * 0.92, 190], [W + 8, 230]].forEach(([x, h]) => { edge += pine(x, H + 8, h); });
      return [
        L(0.03, rect(W, k.lin([[0, c(0.28)], [0.42, c(0.55)], [0.62, c(0.86)], [1, c(0.95)]])) + `<circle cx="${f1(sx)}" cy="${f1(hz - 8)}" r="38" fill="${c(1)}"/>`),
        L(0.03, glow(sx, hz - 8, 190, 150, k.rad(c(1), 0.6)), 'pulse', [sx, hz - 8]),
        L(0.1, `<path d="${birds}" fill="none" stroke="${c(0.15)}" stroke-width="1.6" stroke-linecap="round"/>`, 'drift'),
        L(0.12, `<path d="${r1.d}" fill="${c(0.66)}"/><path d="${r2.d}" fill="${c(0.46)}"/>`),
        L(0.25, `<path d="${r3.d}${forest(k, r3.at, 14, 34, 70)}" fill="${c(0.24)}"/>`),
        L(0.45, `<path d="${hill.d}" fill="${c(0.1)}"/>` + tower),
        L(0.7, `<path d="${edge}" fill="${c(0.03)}"/>`),
      ];
    } },

    windmill: { name: 'Mill hill', draw(k) {
      const { W, c } = k, hz = H * 0.62, hx = k.hx(0.66);
      const [s1, s2] = stars(k, 8, H * 0.32, c(1), 1);
      const h1 = ridge(k, hz + 20, 22, 1.1), h2 = ridge(k, H * 0.74, 26, 0.8), h3 = ridge(k, H * 0.86, 18, 1.3), h4 = ridge(k, H * 0.96, 10, 1.7);
      const gy = h2.at(hx) + 8, hub = [hx, gy - 118], ink = c(0.11);
      const cloud = (x, y, s) => [[0, 0, 40, 12], [-22, 4, 26, 9], [24, 3, 30, 10], [6, -9, 24, 11]].map(([dx, dy, rx, ry]) => `<ellipse cx="${f1(x + dx * s)}" cy="${f1(y + dy * s)}" rx="${f1(rx * s)}" ry="${f1(ry * s)}"/>`).join('');
      let clouds = '';
      for (let i = 0; i < Math.ceil(W / 160) + 1; i++) clouds += cloud(W * (i + k.r() * 0.6) / Math.ceil(W / 160 + 0.5), H * (0.14 + k.r() * 0.22), 0.8 + k.r() * 0.9);
      const body = `<path d="M${f1(hx - 22)} ${f1(gy)}L${f1(hx - 13)} ${f1(gy - 110)}L${f1(hx + 13)} ${f1(gy - 110)}L${f1(hx + 22)} ${f1(gy)}Z" fill="${ink}"/><path d="M${f1(hx - 17)} ${f1(gy - 108)}Q${f1(hx)} ${f1(gy - 142)} ${f1(hx + 17)} ${f1(gy - 108)}Z" fill="${c(0.07)}"/>`
        + `<rect x="${f1(hx - 6)}" y="${f1(gy - 22)}" width="12" height="22" rx="6" fill="${c(0.92)}"/><circle cx="${f1(hx)}" cy="${f1(gy - 72)}" r="5" fill="${c(0.95)}"/>`;
      let blades = '';
      for (const a of [20, 110, 200, 290]) {
        blades += `<g transform="rotate(${a} ${f1(hub[0])} ${f1(hub[1])})"><rect x="${f1(hub[0] - 1.6)}" y="${f1(hub[1] - 96)}" width="3.2" height="96" fill="${ink}"/><rect x="${f1(hub[0] + 2)}" y="${f1(hub[1] - 92)}" width="15" height="68" fill="${c(0.3)}" fill-opacity=".35" stroke="${ink}" stroke-width="1.6"/>`
          + `<path d="M${f1(hub[0] + 2)} ${f1(hub[1] - 75)}h15M${f1(hub[0] + 2)} ${f1(hub[1] - 58)}h15M${f1(hub[0] + 2)} ${f1(hub[1] - 41)}h15" stroke="${ink}" stroke-width="1"/></g>`;
      }
      blades += `<circle cx="${f1(hub[0])}" cy="${f1(hub[1])}" r="5" fill="${c(0.05)}"/>`;
      let posts = '';
      for (let x = W * 0.05; x < W; x += 26) posts += `M${f1(x)} ${f1(h3.at(x) + 2)}v-14`;
      return [
        L(0.03, rect(W, k.lin([[0, c(0.1)], [0.5, c(0.36)], [0.68, c(0.66)], [1, c(0.62)]])) + glow(W * 0.5, hz, W * 0.7, H * 0.2, k.rad(c(0.9), 0.4))),
        L(0.03, s1, 'tw1'), L(0.03, s2, 'tw2'),
        L(0.08, `<g fill="${c(0.78)}" opacity=".32">${clouds}</g>`, 'drift'),
        L(0.12, `<path d="${h1.d}" fill="${c(0.46)}"/>`),
        L(0.25, `<path d="${h2.d}" fill="${c(0.28)}"/>` + body),
        L(0.25, blades, 'spin', hub),
        L(0.45, `<path d="${h3.d}" fill="${c(0.15)}"/><path d="${posts}M${f1(W * 0.05)} ${f1(h3.at(W * 0.05) - 8)}" stroke="${c(0.08)}" stroke-width="2"/>`),
        L(0.7, `<path d="${h4.d}" fill="${c(0.05)}"/>`),
      ];
    } },

    deer: { name: 'Mist wood', draw(k) {
      const { W, c } = k, hx = k.hx(0.64);
      const row = (base, gap, hMin, hMax) => { let d = ''; const n = Math.ceil((W + 60) / gap); for (let i = 0; i < n; i++) d += pine(-30 + (W + 60) * (i + k.r() * 0.8) / n, base + k.r() * 12, hMin + k.r() * (hMax - hMin)); return d; };
      const mist = (y, op) => { let s = ''; for (let x = -80; x < W + 120; x += 150) s += glow(x + k.r() * 60, y + k.r() * 16 - 8, 130, 22, k.rad(c(0.92), op)); return s; };
      const mound = ridge(k, H * 0.86, 16, 0.8), gy = mound.at(hx) + 4, s = 1.3;
      const deer = `<g transform="translate(${f1(hx - 54 * s)} ${f1(gy - 95 * s)}) scale(${s})" fill="${c(0.05)}"><path d="M22 50C22 42 35 40 50 41C58 41 63 40 66 36L72 20C73 17 76 16 79 18L90 25C92 27 91 30 88 30L80 29L74 44C72 52 70 58 66 62L65 94H61L60 64C52 66 40 66 32 64L31 94H27L26 63C22 60 20 56 22 50ZM24 50L19 54L22 46Z"/><path d="M56 64L55 93H52L51 64ZM38 65L37 93H34L33 64Z"/><path d="M76 18L72 6M73 10L67 4M74 12L79 3M78 18L81 8L85 2M81 10L88 8" fill="none" stroke="${c(0.05)}" stroke-width="2.2" stroke-linecap="round"/><path d="M71 22L64 16L70 19Z"/></g>`;
      const flies = (n) => { let a = '', b = ''; for (let i = 0; i < n; i++) { const t = `<circle cx="${f1(k.r() * W)}" cy="${f1(H * (0.52 + k.r() * 0.38))}" r="${f1(1 + k.r() * 1.2)}"/>`; if (i % 2) a += t; else b += t; } return [`<g fill="${c(1)}">${a}</g>`, `<g fill="${c(1)}">${b}</g>`]; };
      const [f1a, f1b] = flies(Math.round(W / 18));
      let edge = '';
      [[-6, 560], [W * 0.1, 420], [W * 0.9, 480], [W + 6, 600]].forEach(([x, h]) => { edge += pine(x, H + 10, h); });
      return [
        L(0.03, rect(W, k.lin([[0, c(0.36)], [0.5, c(0.62)], [1, c(0.48)]])) + glow(hx, H * 0.5, 240, 220, k.rad(c(0.98), 0.7))),
        L(0.08, `<path d="${row(H * 0.76, 22, 200, 300)}" fill="${c(0.54)}"/>`),
        L(0.1, mist(H * 0.7, 0.4), 'drift'),
        L(0.2, `<path d="${row(H * 0.84, 46, 260, 380)}" fill="${c(0.34)}"/>`),
        L(0.22, mist(H * 0.82, 0.35), 'drift2'),
        L(0.35, `<path d="${mound.d}" fill="${c(0.12)}"/>` + deer),
        L(0.35, f1a, 'tw1'), L(0.35, f1b, 'tw2'),
        L(0.65, `<path d="${edge}" fill="${c(0.05)}"/>`),
      ];
    } },

    desert: { name: 'Dune moon', draw(k) {
      const { W, c } = k, hz = H * 0.64, mx = W > H * 0.8 ? W * 0.7 : W * 0.64, my = H * 0.2, cx = W > H * 0.8 ? W * 0.3 : W * 0.34;
      const [s1, s2] = stars(k, 32, hz - 20, c(1));
      const d1 = ridge(k, hz + 6, 16, 0.9), d2 = ridge(k, H * 0.76, 26, 0.8), d3 = ridge(k, H * 0.9, 34, 0.7);
      const gy = d3.at(cx) + 6, ink = c(0.04);
      const cactus = `<g fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round"><path d="M${f1(cx)} ${f1(gy)}V${f1(gy - 118)}" stroke-width="18"/><path d="M${f1(cx)} ${f1(gy - 50)}H${f1(cx - 24)}V${f1(gy - 86)}M${f1(cx)} ${f1(gy - 68)}H${f1(cx + 22)}V${f1(gy - 100)}" stroke-width="12"/></g>`;
      const sx = W * 0.62, sy = H * 0.08;
      return [
        L(0.03, rect(W, k.lin([[0, c(0.03)], [0.55, c(0.16)], [0.64, c(0.34)], [1, c(0.3)]])) + `<circle cx="${f1(mx)}" cy="${f1(my)}" r="34" fill="${c(1)}"/><g fill="${c(0.86)}" opacity=".7"><circle cx="${f1(mx - 10)}" cy="${f1(my - 8)}" r="6"/><circle cx="${f1(mx + 12)}" cy="${f1(my + 6)}" r="4"/><circle cx="${f1(mx - 4)}" cy="${f1(my + 14)}" r="3"/></g>`),
        L(0.03, glow(mx, my, 150, 150, k.rad(c(0.92), 0.45)), 'pulse', [mx, my]),
        L(0.03, s1, 'tw1'), L(0.03, s2, 'tw2'),
        L(0.03, `<path d="M${f1(sx)} ${f1(sy)}l70 -38" stroke="${k.lin([[0, c(1), 1], [1, c(1), 0]], 0, 1, 1, 0)}" stroke-width="2" stroke-linecap="round"/>`, 'shoot'),
        L(0.12, `<path d="${d1.d}" fill="${c(0.3)}"/><path d="${d1.top}" fill="none" stroke="${c(0.5)}" stroke-width="1.2" opacity=".5"/>`),
        L(0.25, `<path d="${d2.d}" fill="${c(0.17)}"/><path d="${d2.top}" fill="none" stroke="${c(0.38)}" stroke-width="1.4" opacity=".6"/>`),
        L(0.5, `<path d="${d3.d}" fill="${c(0.06)}"/><path d="${d3.top}" fill="none" stroke="${c(0.22)}" stroke-width="1.6" opacity=".6"/>` + cactus + `<ellipse cx="${f1(cx + 46)}" cy="${f1(d3.at(cx + 46) + 4)}" rx="10" ry="6" fill="${ink}"/>`),
      ];
    } },

    peaks: { name: 'Snow cabin', draw(k) {
      const { W, c } = k, hz = H * 0.6, hx = k.hx(0.66);
      const [s1, s2] = stars(k, 10, H * 0.3, c(1), 1);
      const p1 = peaks(k, hz + 30, 120, 220, 110), p2 = peaks(k, H * 0.72, 70, 150, 90), rf = ridge(k, H * 0.8, 10, 1.5), snow = ridge(k, H * 0.86, 14, 0.8), bank = ridge(k, H * 0.97, 8, 1);
      const gy = snow.at(hx) + 4, chim = [hx + 23, gy - 76];
      const cabin = `<rect x="${f1(hx - 36)}" y="${f1(gy - 40)}" width="72" height="40" fill="${c(0.16)}"/><rect x="${f1(hx + 18)}" y="${f1(gy - 74)}" width="10" height="24" fill="${c(0.12)}"/><path d="M${f1(hx - 46)} ${f1(gy - 38)}L${f1(hx)} ${f1(gy - 74)}L${f1(hx + 46)} ${f1(gy - 38)}Z" fill="${c(0.1)}"/>`
        + `<path d="M${f1(hx - 49)} ${f1(gy - 39)}L${f1(hx)} ${f1(gy - 79)}L${f1(hx + 49)} ${f1(gy - 39)}L${f1(hx + 44)} ${f1(gy - 35)}L${f1(hx)} ${f1(gy - 70)}L${f1(hx - 44)} ${f1(gy - 35)}Z" fill="${c(0.97)}"/>`
        + `<rect x="${f1(hx - 24)}" y="${f1(gy - 30)}" width="15" height="15" fill="${c(1)}"/><rect x="${f1(hx + 6)}" y="${f1(gy - 30)}" width="14" height="30" fill="${c(0.07)}"/>`;
      let flakes = '';
      for (let i = 0; i < Math.round(W / 5); i++) { const x = k.r() * W, y = k.r() * H, r = f1(0.7 + k.r() * 1.4); flakes += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}"/><circle cx="${f1(x)}" cy="${f1(y + H)}" r="${r}"/>`; }
      let edge = '';
      [[-8, 220], [W * 0.07, 150], [W * 0.93, 180], [W + 8, 240]].forEach(([x, h]) => { edge += pine(x, H + 6, h); });
      return [
        L(0.03, rect(W, k.lin([[0, c(0.18)], [0.6, c(0.5)], [1, c(0.7)]]))),
        L(0.03, s1, 'tw1'), L(0.03, s2, 'tw2'),
        L(0.08, `<path d="${p1.d}" fill="${c(0.52)}"/><path d="${caps(p1.pts, 0.34)}" fill="${c(0.95)}"/>`),
        L(0.16, `<path d="${p2.d}" fill="${c(0.34)}"/><path d="${caps(p2.pts, 0.3)}" fill="${c(0.86)}"/>`),
        L(0.3, `<path d="${rf.d}${forest(k, rf.at, 12, 40, 80)}" fill="${c(0.17)}"/>`),
        L(0.45, `<path d="${snow.d}" fill="${c(0.88)}"/>` + cabin),
        L(0.45, glow(hx - 16, gy - 22, 52, 40, k.rad(c(1), 0.6)), 'pulse', [hx - 16, gy - 22]),
        L(0.45, `<g fill="${c(0.84)}" opacity=".5"><circle cx="${f1(chim[0])}" cy="${f1(chim[1] - 6)}" r="5"/><circle cx="${f1(chim[0] + 6)}" cy="${f1(chim[1] - 20)}" r="7"/><circle cx="${f1(chim[0] + 14)}" cy="${f1(chim[1] - 37)}" r="9"/></g>`, 'smoke', chim),
        L(0.5, `<g fill="${c(1)}" opacity=".85">${flakes}</g>`, 'snow', null, true),
        L(0.7, `<path d="${edge}" fill="${c(0.06)}"/><path d="${bank.d}" fill="${c(0.8)}"/>`),
      ];
    } },

    city: { name: 'Dusk city', draw(k) {
      const { W, c } = k, hz = H * 0.68, hx = k.hx(0.7), sunX = W > H * 0.8 ? W * 0.42 : W * 0.5;
      const [s1, s2] = stars(k, 10, H * 0.3, c(1), 1);
      const blocks = (gapMin, gapMax, hMin, hMax, skip) => { const out = []; for (let x = -30; x < W + 30;) { const w = gapMin + k.r() * (gapMax - gapMin); if (!skip || Math.abs(x + w / 2 - hx) > 26) out.push([x, w, hMin + k.r() ** 1.6 * (hMax - hMin)]); x += w + 2; } return out; };
      const far = blocks(14, 34, 20, 90).map(([x, w, h]) => `M${f1(x)} ${f1(hz)}v${f1(-h)}h${f1(w)}v${f1(h)}Z`).join('');
      const near = blocks(24, 56, 40, 170, true);
      let nd = near.map(([x, w, h]) => `M${f1(x)} ${f1(hz)}v${f1(-h)}h${f1(w)}v${f1(h)}Z`).join('');
      const tt = hz - 290;
      nd += `M${f1(hx - 22)} ${f1(hz)}V${f1(hz - 200)}H${f1(hx + 22)}V${f1(hz)}ZM${f1(hx - 14)} ${f1(hz - 199)}V${f1(hz - 250)}H${f1(hx + 14)}V${f1(hz - 199)}ZM${f1(hx - 7)} ${f1(hz - 249)}L${f1(hx)} ${f1(tt + 10)}L${f1(hx + 7)} ${f1(hz - 249)}Z`;
      let wa = '', wb = '';
      for (const [x, w, h] of [...near, [hx - 22, 44, 200]]) for (let yy = hz - h + 8; yy < hz - 8; yy += 10) for (let xx = x + 5; xx < x + w - 5; xx += 7) {
        if (k.r() < 0.22) { const s = `<rect x="${f1(xx)}" y="${f1(yy)}" width="2.6" height="3.6"/>`; if (k.r() < 0.5) wa += s; else wb += s; }
      }
      const bank = `<rect x="-60" y="${f1(H * 0.95)}" width="${W + 120}" height="${H}" fill="${c(0.02)}"/>`;
      let lamps = '';
      for (let x = 20; x < W; x += 70) lamps += `<path d="M${f1(x)} ${f1(H * 0.95)}v-26" stroke="${c(0.02)}" stroke-width="2"/><circle cx="${f1(x)}" cy="${f1(H * 0.95 - 27)}" r="2.6" fill="${c(1)}"/>` + glow(x, H * 0.95 - 27, 14, 14, k.rad(c(1), 0.5));
      return [
        L(0.03, rect(W, k.lin([[0, c(0.16)], [0.45, c(0.44)], [0.68, c(0.82)], [1, c(0.82)]])) + glow(sunX, hz, 230, 140, k.rad(c(1), 0.65)) + `<circle cx="${f1(sunX)}" cy="${f1(hz + 6)}" r="42" fill="${c(0.99)}"/><rect x="-60" y="${f1(hz)}" width="${W + 120}" height="${H}" fill="${k.lin([[0, c(0.22)], [1, c(0.05)]])}"/>`),
        L(0.03, s1, 'tw1'), L(0.03, s2, 'tw2'),
        L(0.1, `<path d="${far}" fill="${c(0.4)}"/>` + mirror(hz, 0.3, `<path d="${far}" fill="${c(0.4)}"/>`)),
        L(0.2, dashes(k, Math.round(W / 8), 0, W, hz + 6, H * 0.93, 22, c(0.9), 0.4) + dashes(k, 18, sunX - 26, sunX + 26, hz + 6, H * 0.9, 30, c(1), 0.55), 'shim'),
        L(0.3, `<path d="${nd}" fill="${c(0.13)}"/>` + mirror(hz, 0.45, `<path d="${nd}" fill="${c(0.1)}"/>`) + `<path d="M${f1(hx)} ${f1(tt + 10)}V${f1(tt - 10)}" stroke="${c(0.13)}" stroke-width="2"/>`),
        L(0.3, `<g fill="${c(0.97)}">${wa}</g>`, 'tw1'), L(0.3, `<g fill="${c(0.97)}">${wb}</g>`, 'tw2'),
        L(0.3, `<circle cx="${f1(hx)}" cy="${f1(tt - 11)}" r="2.6" fill="${c(1)}"/>` + glow(hx, tt - 11, 16, 16, k.rad(c(1), 0.8)), 'blink', [hx, tt - 11]),
        L(0.6, bank + lamps),
      ];
    } },
  };
  const IDS = Object.keys(SCENES);

  // ---------- build: scene -> defs + layers ----------
  function build(scene, c, ar, seed) {
    const W = Math.round(H * ar), p = `scn${++uid}`, defs = []; let n = 0;
    const id = () => `${p}-${++n}`;
    const stopsOf = (stops) => stops.map(([o, col, a = 1]) => `<stop offset="${o}" stop-color="${col}" stop-opacity="${a}"/>`).join('');
    const k = {
      W, c, r: rng(seed), hx: (f) => (W > H * 0.8 ? W * f : W / 2),
      lin(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { const i = id(); defs.push(`<linearGradient id="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsOf(stops)}</linearGradient>`); return `url(#${i})`; },
      rad(col, a) { const i = id(); defs.push(`<radialGradient id="${i}">${stopsOf([[0, col, a], [0.45, col, a * 0.45], [1, col, 0]])}</radialGradient>`); return `url(#${i})`; },
      blur(sd) { const i = id(); defs.push(`<filter id="${i}" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="${sd}"/></filter>`); return `url(#${i})`; },
    };
    const layers = SCENES[scene].draw(k);
    // merge neighbouring still layers at the same depth into one SVG: fewer composited layers on phones
    const out = [];
    for (const l of layers) { const prev = out.at(-1); if (prev && !prev.a && !l.a && prev.d === l.d) prev.svg += l.svg; else out.push({ ...l }); }
    return { W, defs: defs.join(''), layers: out, p };
  }

  let grainURL = '';
  function grain() {  // one 128 px noise tile, made once; about 3% grain over every scene
    if (grainURL) return grainURL;
    const cv = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), x = cv.getContext('2d'), img = x.createImageData(128, 128), r = rng(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = r() * 30; }
    x.putImageData(img, 0, 0);
    grainURL = cv.toDataURL();
    const st = document.createElement('style'); st.textContent = `.scn-grain { background-image: url(${grainURL}); }`; document.head.appendChild(st);
    return grainURL;
  }

  function markup(b) {
    let html = `<svg class="scn-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${b.defs}</defs></svg>`;
    let group = null;
    for (const l of b.layers) {
      const vh = l.tall ? H * 2 : H;
      const origin = l.o ? ` style="transform-origin:${f1((l.o[0] / b.W) * 100)}% ${f1((l.o[1] / vh) * 100)}%"` : '';
      const layer = `<div class="scn-l${l.a ? ` scn-a-${l.a}` : ''}${l.tall ? ' scn-tall' : ''}"${origin}><svg viewBox="0 0 ${b.W} ${vh}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${l.svg}</svg></div>`;
      if (group && group.d === l.d) group.html += layer; else { if (group) html += `<div class="scn-p" data-d="${group.d}">${group.html}</div>`; group = { d: l.d, html: layer }; }
    }
    if (group) html += `<div class="scn-p" data-d="${group.d}">${group.html}</div>`;
    return html + '<div class="scn-grain"></div>';
  }

  // ---------- public: render / svg / list / forSeed ----------
  const paused = { on: false };
  const touch = matchMedia('(hover: none), (pointer: coarse)');
  function render(el, o = {}) {
    const shape = o.shape === 'full' ? 'full' : 'capsule';
    const scene = SCENES[o.scene] ? o.scene : IDS[0], seed = o.seed ?? hash(scene);
    let ramp = o.ramp, cur = null, ar = 0, ro = null, t = 0, dead = false;
    grain();
    // || 1: a page loaded hidden or minimised has a 0x0 viewport, and 0/0 made every scene throw; the observer redraws later
    const size = () => (shape === 'capsule' ? [1, 2] : [el.clientWidth || innerWidth || 1, el.clientHeight || innerHeight || 1]);
    function draw(fade) {
      const [w, h] = size(); ar = w / h;
      const node = document.createElement('div');
      node.className = `scn scn-${shape}${o.live ? ' scn-live' : ''}${o.live && paused.on ? ' scn-paused' : ''}`;
      node.innerHTML = markup(build(scene, makeRamp(ramp), ar, seed));
      const old = cur; cur = node;
      // A fresh scene goes in UNDER the old one: on top (or alone) it flashed at full strength over the scrim for one
      // frame in Android WebView. Phones then drop the old one two frames later instead of a crossfade, which kept two
      // full scenes of GPU layers alive while the page re-rastered (theme, mode, song colours) and ran out of tile memory.
      if (old && (fade || touch.matches)) {
        el.insertBefore(node, old);
        if (fade && !touch.matches) { old.classList.add('scn-in'); setTimeout(() => old.remove(), 1000); }
        else requestAnimationFrame(() => requestAnimationFrame(() => old.remove()));
      } else { old?.remove(); el.appendChild(node); }
    }
    draw(false);
    if (shape === 'full' && window.ResizeObserver) {
      ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { const [w, h] = size(); if (!dead && Math.abs(w / h - ar) / ar > 0.12) draw(false); }, 250); });
      ro.observe(el);
    }
    return {
      scene,
      get node() { return cur; },
      update(r) { ramp = r; if (!dead) draw(true); },
      destroy() { dead = true; ro?.disconnect(); clearTimeout(t); cur?.remove(); cur = null; },
    };
  }
  // One self-contained SVG string (for <img src> or CSS backgrounds), with grain and the capsule clip baked in.
  function svg(o = {}) {
    const w = o.w || 240, h = o.h || 480, scene = SCENES[o.scene] ? o.scene : IDS[0];
    const b = build(scene, makeRamp(o.ramp), w / h, o.seed ?? hash(scene)), W = b.W;
    const clip = o.shape === 'full' ? '' : `<clipPath id="${b.p}-cl"><rect width="${W}" height="${H}" rx="${W / 2}"/></clipPath>`;
    const grainF = `<filter id="${b.p}-gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1"/></filter>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><defs>${b.defs}${clip}${grainF}</defs>`
      + `<g${clip ? ` clip-path="url(#${b.p}-cl)"` : ''}>${b.layers.map((l) => l.svg).join('')}<rect width="${W}" height="${H}" filter="url(#${b.p}-gr)" opacity=".05"/></g></svg>`;
  }
  const list = () => IDS.map((id) => ({ id, name: SCENES[id].name }));
  const RAMP_IDS = Object.keys(RAMPS);
  function forSeed(str) {
    const h = hash(str || '');
    const rampName = RAMP_IDS[(h >>> 8) % RAMP_IDS.length];
    return { scene: IDS[h % IDS.length], ramp: RAMPS[rampName], rampName, seed: h };
  }

  // ---------- live background ----------
  const live = { id: (() => { try { return localStorage.getItem(KEY) || 'off'; } catch { return 'off'; } })(), host: null, stage: null, handle: null, key: '' };
  const motion = () => root.dataset.motion || 'full';
  function albumRamp() {
    const s = root.style;
    const v = ['--album-bg', '--album-bg-2', '--album-au-1', '--album-au-2', '--album-au-3', '--album-c3', '--album-accent'].map((n) => s.getPropertyValue(n).trim()).filter(Boolean);
    return v.length >= 3 ? v : null;
  }
  function syncLive() {
    if (!SCENES[live.id]) {
      live.handle?.destroy(); live.handle = null; live.host?.remove(); live.host = null; live.key = '';
      delete root.dataset.scene; syncNP();
      return;
    }
    if (!live.host) {
      live.host = document.createElement('div'); live.host.className = 'scn-bg'; live.host.setAttribute('aria-hidden', 'true');
      live.host.innerHTML = '<div class="scn-stage"></div>';
      live.stage = live.host.firstChild;
      document.body.prepend(live.host);
    }
    root.dataset.scene = live.id;
    const ramp = themeRamp(), key = makeRamp(ramp).key;
    if (!live.handle || live.handle.scene !== live.id) { live.handle?.destroy(); live.handle = render(live.stage, { scene: live.id, ramp, shape: 'full', live: true }); par.x = par.y = 0; }
    else if (key !== live.key) live.handle.update(ramp);
    live.key = key;
    syncNP();
  }
  // Now Playing wears its own copy of the scene inside #npBg, so it rides the sheet. (Lifting the page's layer above
  // the app on open hid the page behind the sliding sheet at once and recoloured it on every open and close.)
  const np = { host: null, handle: null, key: '' };
  function syncNP() {
    const bg = document.getElementById('npBg');
    if (!bg || !SCENES[live.id]) { np.handle?.destroy(); np.host?.remove(); np.host = np.handle = null; np.key = ''; return; }
    // Kept up to date while the player is closed (#np is display:none, so it costs no layout or GPU): building it as the
    // player opened, after a background or song change, stuttered the open drag.
    if (!np.host) {
      np.host = document.createElement('div'); np.host.className = 'scn-np';
      np.host.innerHTML = '<div class="scn-stage"></div>';
      bg.prepend(np.host);
    }
    const ramp = (root.dataset.album !== 'off' && albumRamp()) || themeRamp(), key = makeRamp(ramp).key;
    if (!np.handle || np.handle.scene !== live.id) { np.handle?.destroy(); np.handle = render(np.host.firstChild, { scene: live.id, ramp, shape: 'full', live: true }); }
    else if (key !== np.key) np.handle.update(ramp);
    np.key = key;
  }
  function setLive(id) {
    live.id = SCENES[id] ? id : 'off';
    try { localStorage.setItem(KEY, live.id); } catch { /* private window: the choice just won't stick */ }
    syncLive(); syncPicker();
  }

  // Parallax: scroll and phone tilt move the depth layers a little (Motion Full only). Transforms only, one rAF while moving.
  const MAX = 34;  // px at depth 1; the stage overscans by 48 px so edges never show
  const par = { x: 0, y: 0, sy: 0, gx: 0, gy: 0, raf: 0, g0: null };
  const canMove = () => live.host && motion() === 'full' && !paused.on && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function step() {
    par.raf = 0;
    const tx = canMove() ? par.gx : 0, ty = canMove() ? par.sy + par.gy : 0;
    par.x += (tx - par.x) * 0.14; par.y += (ty - par.y) * 0.14;
    const done = Math.abs(tx - par.x) < 0.05 && Math.abs(ty - par.y) < 0.05;
    if (done) { par.x = tx; par.y = ty; }
    live.stage?.querySelectorAll('.scn-p').forEach((p) => { const d = +p.dataset.d; p.style.transform = par.x || par.y ? `translate3d(${f1(par.x * d)}px,${f1(par.y * d)}px,0)` : ''; });
    if (!done) kick();
  }
  const kick = () => { if (!par.raf && live.host) par.raf = requestAnimationFrame(step); };
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (!live.host || !(t instanceof Element) || t.tagName !== 'MAIN') return;
    par.sy = -(Math.min(t.scrollTop, 900) / 900) * MAX; kick();
  }, { capture: true, passive: true });
  if (matchMedia('(pointer: coarse)').matches) addEventListener('deviceorientation', (e) => {
    if (!live.host || e.gamma == null || motion() !== 'full') return;
    if (!par.g0) par.g0 = [e.gamma, e.beta];
    par.g0[0] += (e.gamma - par.g0[0]) * 0.01; par.g0[1] += (e.beta - par.g0[1]) * 0.01;  // slowly re-centre on how the phone is held
    const gx = (clamp(e.gamma - par.g0[0], -25, 25) / 25) * MAX * 0.7, gy = (clamp(e.beta - par.g0[1], -25, 25) / 25) * MAX * 0.5;
    if (Math.abs(gx - par.gx) + Math.abs(gy - par.gy) > 0.4) { par.gx = gx; par.gy = gy; kick(); }
  });

  // Pause when the tab is hidden, or after the window has been in the background for 20 s.
  let blurT = 0;
  const setPaused = (on) => { paused.on = on; document.querySelectorAll('.scn-live').forEach((n) => n.classList.toggle('scn-paused', on)); if (!on) kick(); };
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));
  addEventListener('blur', () => { clearTimeout(blurT); blurT = setTimeout(() => setPaused(true), 20000); });
  addEventListener('focus', () => { clearTimeout(blurT); setPaused(document.hidden); });

  // Theme, album colours (Now Playing), mode and motion changes recolour the live scene.
  let syncT = 0;
  new MutationObserver(() => { if (!live.host) return; clearTimeout(syncT); syncT = setTimeout(() => { syncLive(); kick(); }, 60); })
    .observe(root, { attributes: true, attributeFilter: ['style', 'data-np', 'data-album', 'data-theme', 'data-mode', 'data-motion'] });

  // ---------- settings picker (injected into the Background slot of #settings) ----------
  let pickRamp = '';
  function syncPicker() {
    document.querySelectorAll('[data-scene-pick]').forEach((b) => { const on = b.dataset.scenePick === live.id; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    const now = document.getElementById('scnNow');
    if (now) now.textContent = live.id === 'off' ? 'Off' : (list().find((s) => s.id === live.id) || {}).name || '';
  }
  function picker() {
    const dlg = document.getElementById('settings'), card = dlg?.querySelector('.dlg-card');
    if (!card) return;
    let sec = document.getElementById('scnPick');
    if (!sec) {
      sec = document.createElement('section');
      sec.className = 'scn-pick'; sec.id = 'scnPick';
      sec.innerHTML = '<div class="set-pref-head"><span class="set-lbl" id="scnPickTitle">Live background</span><span class="set-now" id="scnNow"></span></div>' +
        '<div class="scn-grid" role="radiogroup" aria-labelledby="scnPickTitle"></div><p class="hint">A slow landscape behind everything. In Now Playing it takes the song’s colours.</p>';
      const grid = sec.querySelector('.scn-grid');
      for (const it of [{ id: 'off', name: 'Off' }, ...list()]) {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.scenePick = it.id;
        b.innerHTML = `<span class="scn-thumb${it.id === 'off' ? ' scn-thumb-off' : ''}"></span><span class="scn-name">${it.name}</span>`;
        b.onclick = () => setLive(it.id);
        grid.appendChild(b);
      }
      grid.addEventListener('keydown', (e) => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!dir) return;
        const bs = [...grid.children], i = (bs.indexOf(document.activeElement) + dir + bs.length) % bs.length;
        e.preventDefault(); bs[i].focus(); bs[i].click();
      });
      (document.getElementById('setBgSlot') || card).appendChild(sec);
      pickRamp = '';
    }
    const ramp = themeRamp(), key = ramp.join();
    if (key !== pickRamp) {  // previews wear the current theme
      pickRamp = key;
      sec.querySelectorAll('[data-scene-pick]').forEach((b) => {
        if (b.dataset.scenePick === 'off') return;
        const th = b.querySelector('.scn-thumb'); th.textContent = '';
        render(th, { scene: b.dataset.scenePick, ramp, shape: 'capsule' });
      });
    }
    syncPicker();
  }
  function wirePicker() {
    const dlg = document.getElementById('settings');
    if (!dlg) return;
    picker();
    new MutationObserver(() => { if (!dlg.hidden) picker(); }).observe(dlg, { attributes: true, attributeFilter: ['hidden'] });
  }

  window.Scenes = { render, svg, list, forSeed, ramp: makeRamp, themeRamp, RAMPS, setLive, get live() { return live.id; } };
  const start = () => { syncLive(); wirePicker(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
