// Contrast check for the palette themes in web/theme-studio.js: body text (ink, dim, mute, accent) must reach 4.5:1 on
// every surface it can sit on, in both modes, and the accent's own ink must reach 4.5:1 on the accent.
// Run: node tools/theme_contrast.js   (exits 1 on any failure)
const path = require('path');
const { PALETTES, MINE_DEFAULT, tokens, contrast, rgbOf } = require(path.join(__dirname, '..', 'web', 'theme-studio.js'));
let fails = 0, worst = Infinity;
const all = [...PALETTES.map(([id, , , ramp]) => [id, ramp]), ['mine-default', MINE_DEFAULT],
  ['random-grey', ['#111111', '#555555', '#999999', '#eeeeee']], ['random-neon', ['#00ff00', '#ff00ff', '#ffff00']]];
for (const [id, ramp] of all) for (const mode of ['dark', 'light']) {
  const t = tokens(ramp, mode), bad = [];
  for (const k of ['ink', 'dim', 'mute', 'accent']) for (const s of t.surfaces) {
    const c = contrast(rgbOf(t[k]), s); worst = Math.min(worst, c);
    if (c < 4.5) bad.push(`${k} ${c.toFixed(2)}`);
  }
  const ai = contrast(rgbOf(t.accent), rgbOf(t.accentInk));
  if (ai < 4.5) bad.push(`accent-ink ${ai.toFixed(2)}`);
  if (bad.length) { fails++; console.log(`FAIL ${id} ${mode}: ${[...new Set(bad)].slice(0, 4).join(', ')}`); }
}
console.log(`${all.length * 2} theme/mode pairs checked, ${fails} failing, lowest text contrast ${worst.toFixed(2)}:1`);
process.exit(fails ? 1 : 0);
