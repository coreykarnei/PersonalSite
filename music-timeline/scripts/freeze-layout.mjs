// Freeze the arrangement: run the exact layout the arrange page runs (same
// constants, same overrides) and bake final x/y/size per album into
// public/timeline-frozen.json. After freezing, the layout is data — no
// algorithm at runtime, nothing shifts when the data pipeline reruns.
//
// Usage: node scripts/freeze-layout.mjs [stageHeight=860]

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const albums = JSON.parse(readFileSync(new URL('../public/timeline-data.json', import.meta.url), 'utf8'));
const ovrAll = JSON.parse(readFileSync(join(homedir(), 'music-catalog', 'data', 'layout-overrides.json'), 'utf8'));
const yearScale = ovrAll._years || {};
const ovr = Object.fromEntries(Object.entries(ovrAll).filter(([k]) => !k.startsWith('_')));
const stageH = +process.argv[2] || 860;

// ---- mirror of src/arrange/Arrange.jsx layout (keep in sync) ----
const PAD_L = 235, PAD_R = 320, GAP_W = 8, MAX_GAP_RUN = 36, RIVER = 0.45;
const MIN_MONTH_W = 46, MAX_MONTH_W = 900, FILL = 0.62;
const CANVAS_TOP = 84, AXIS_GAP = 96, MIN_GAP = 6;
const SIZE_CEIL = 210, SIZE_FLOOR = 52, SOLID_FLOOR = 72, RAMP_GAMMA = 2.1, RANK_WIN = 0.45;
const TIERS = { '-2': 0.5, '-1': 0.72, 0: 1, 1: 1.4, 2: 1.9 };
const BAND = { electronic: -2.5, rock: -1.85, rnb: -1.15, hiphop: -0.55, other: 0.1, indie: 0.75, pop: 1.45, folk: 2.15, jazz: 2.7, latin: 3.0 };
const BAND_SPACING = 90;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CANDS = (() => {
  const xs = [0, -24, 24, -48, 48, -76, 76, -108, 108, -144, 144, -184, 184, -230, 230, -280, 280, -340, 340, -410, 410];
  const out = [];
  for (const xk of xs) for (let k = 0; k < 48; k++) {
    const yk = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 24;
    out.push([xk, yk, Math.hypot(xk * 1.5, yk)]);
  }
  out.sort((a, b) => a[2] - b[2]);
  return out;
})();

const axisY = stageH - AXIS_GAP;
const usableH = axisY - 60 - CANVAS_TOP;
const centerY = CANVAS_TOP + usableH / 2 + 14;

const scoreSorted = [...albums].sort((x, y) => x.score - y.score);
const p30 = scoreSorted[Math.floor(scoreSorted.length * 0.3)]?.score ?? 0;
const nodes = albums.map(a => {
  const near = albums.filter(b => Math.abs(b.t - a.t) <= RANK_WIN);
  const rank = near.filter(b => b.score > a.score || (b.score === a.score && b.id < a.id)).length;
  const pct = near.length > 1 ? rank / (near.length - 1) : 0;
  const damp = Math.min(1, (near.length - 1) / 8);
  const floor = a.score < p30 ? SIZE_FLOOR : SOLID_FLOOR;
  const base = Math.max(floor, SIZE_FLOOR + (SIZE_CEIL - SIZE_FLOOR) * Math.pow(1 - pct * damp, RAMP_GAMMA));
  const o = ovr[a.id];
  return { ...a, size: clamp(o?.size ?? base * (TIERS[o?.tier ?? 0] ?? 1), 48, 330), baseSize: clamp(base, 48, 330) };
});

const mIdx = t => Math.floor(t * 12 + 1e-9);
const mMin = mIdx(nodes[0].t), mMax = mIdx(nodes[nodes.length - 1].t);
const areas = new Array(mMax - mMin + 1).fill(0);
for (const n of nodes) areas[mIdx(n.t) - mMin] += n.baseSize * n.baseSize;
const widths = areas.map(a => a ? clamp(a / (usableH * FILL), MIN_MONTH_W, MAX_MONTH_W) : GAP_W);
for (let i = 0; i < widths.length; i++) {
  if (areas[i]) continue;
  let j = i;
  while (j < widths.length && !areas[j]) j++;
  if ((j - i) * GAP_W > MAX_GAP_RUN) for (let k = i; k < j; k++) widths[k] = MAX_GAP_RUN / (j - i);
  i = j;
}
for (let i = 0; i < widths.length; i++) {
  const s = yearScale[Math.floor((mMin + i) / 12)];
  if (s) widths[i] *= s;
}
const cum = [0];
for (const w of widths) cum.push(cum[cum.length - 1] + w);
const totalTimeW = cum[cum.length - 1];
const xOf = t => {
  const m = clamp(mIdx(t), mMin, mMax);
  return PAD_L + cum[m - mMin] + (t * 12 - m) * widths[m - mMin];
};
const flowW = nodes.map(n => (n.baseSize * n.baseSize) / (usableH * FILL) + 2);
const totalFlow = flowW.reduce((a, b) => a + b, 0);
let flowRun = 0;
nodes.forEach((n, i) => {
  flowRun += flowW[i] / 2;
  const fx = PAD_L + (flowRun / totalFlow) * totalTimeW;
  flowRun += flowW[i] / 2;
  n.ax = xOf(n.t) * (1 - RIVER) + fx * RIVER;
});

const yMin = n => CANVAS_TOP + n.size / 2;
const yMax = n => axisY - 52 - n.size / 2;
const yPrefOf = n => clamp(centerY + (BAND[n.fam] ?? 0) * BAND_SPACING, yMin(n), yMax(n));
const obstacles = [];
const pinnedIds = new Set();
for (const n of nodes) {
  const o = ovr[n.id];
  if (o && (o.dx || o.dy)) {
    n.ay = yPrefOf(n);
    n.fx = n.ax + (o.dx || 0); n.fy = n.ay + (o.dy || 0);
    obstacles.push({ x: n.fx, y: n.fy, size: n.size });
    pinnedIds.add(n.id);
  }
}
for (const n of nodes.filter(n => !pinnedIds.has(n.id)).sort((x, y) => y.size - x.size)) {
  const yPref = yPrefOf(n);
  const overlapAt = (x, y) => {
    let ov = 0;
    for (const p of obstacles) {
      const reach = (n.size + p.size) / 2 + MIN_GAP;
      if (Math.abs(p.x - x) >= reach) continue;
      const oy = reach - Math.abs(y - p.y);
      if (oy > 0) ov += Math.min(reach - Math.abs(p.x - x), oy);
    }
    return ov;
  };
  let best = [n.ax, yPref], bestOverlap = Infinity;
  for (const [xk, yk] of CANDS) {
    const y = clamp(yPref + yk, yMin(n), yMax(n));
    const ov = overlapAt(n.ax + xk, y);
    if (ov === 0) { best = [n.ax + xk, y]; bestOverlap = 0; break; }
    if (ov < bestOverlap) { bestOverlap = ov; best = [n.ax + xk, y]; }
  }
  [n.fx, n.fy] = best;
  obstacles.push({ x: n.fx, y: n.fy, size: n.size });
}

const years = [];
const seenYears = new Set();
for (const n of nodes) {
  if (seenYears.has(n.year)) continue;
  seenYears.add(n.year);
  years.push({ y: n.year, x: n.ax - 14 });
}

const frozen = {
  frozenAt: new Date().toISOString(),
  stageH, axisY,
  totalW: PAD_L + cum[cum.length - 1] + PAD_R,
  years,
  albums: nodes.map(n => ({
    id: n.id, artist: n.artist, album: n.album, song: ovr[n.id]?.song || n.song,
    clip: ovr[n.id]?.clip || null,
    year: n.year, month: n.month, fam: n.fam, hue: n.hue, cover: n.cover,
    x: +n.fx.toFixed(1), y: +n.fy.toFixed(1), size: +n.size.toFixed(1),
    ax: +n.ax.toFixed(1), // true time position, for the date guide line
  })),
};
writeFileSync(new URL('../public/timeline-frozen.json', import.meta.url), JSON.stringify(frozen));
console.log(`froze ${frozen.albums.length} albums · stage ${Math.round(frozen.totalW)}px wide · ${new Date().toISOString().slice(0, 16)}`);
