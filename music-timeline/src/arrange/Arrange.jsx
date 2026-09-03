import React, { useEffect, useMemo, useRef, useState } from 'react';

// ---- constants -------------------------------------------------------------

const PAD_L = 235, PAD_R = 320;
const GAP_W = 8;           // width of an empty month
const MAX_GAP_RUN = 36;    // a run of empty months never exceeds this total width
const RIVER = 0.45;        // 0 = strict time, 1 = pure continuous flow; the blend
                           // smooths seams between quarters at slight cost to timeline truth
const MIN_MONTH_W = 46, MAX_MONTH_W = 900;
const FILL = 0.62;         // packing density — higher = tighter, narrower months
// progressive size ramp: every album's base size comes from its score-rank among
// temporal neighbors — top of a stretch ≈ SIZE_CEIL, tail ≈ SIZE_FLOOR, smooth
// in between; sparse stretches damp toward all-large (the origin-era look)
// wider spread: a few even-bigger tops, more small tail — but the very smallest
// sizes are reserved for borderline keeps (bottom ~30% by absolute score)
const SIZE_CEIL = 210, SIZE_FLOOR = 52, SOLID_FLOOR = 72, RAMP_GAMMA = 2.1, RANK_WIN = 0.45;
const CANVAS_TOP = 84;
const AXIS_GAP = 96;
const DENSITY_WIN = 0.5;

// absolute size ladder — XL means the same thing in a sparse year and a packed one
const SIZES = [42, 60, 84, 118, 165, 230, 275, 320];
const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXL+', 'MAX'];
const TIERS = { '-2': 0.5, '-1': 0.72, 0: 1, 1: 1.4, 2: 1.9 }; // legacy tier overrides

// offsets balanced by family population so the canvas fills top to bottom
const BAND = { electronic: -2.5, rock: -1.85, rnb: -1.15, hiphop: -0.55, other: 0.1, indie: 0.75, pop: 1.45, folk: 2.15, jazz: 2.7, latin: 3.0 };
const BAND_SPACING = 90;
const FAM_LABEL = { hiphop: 'hip-hop', rnb: 'r&b/soul', electronic: 'electronic', rock: 'rock', folk: 'folk/country', pop: 'pop', jazz: 'jazz', indie: 'indie', latin: 'latin', other: 'unsorted' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sizeOf = (base, o) => clamp(o?.size ?? base * (TIERS[o?.tier ?? 0] ?? 1), 48, 330);
const MIN_GAP = 6; // minimum edge-to-edge distance between any two auto-placed covers

// ---- auto layout -----------------------------------------------------------

const DEFAULT_CLIP = [0, 30]; // default: the whole preview span
const MIN_CLIP = 1.5;

// placement candidates ordered NEAREST-FIRST (previously all of a column was
// tried before any sideways step, so a blocked cover could teleport 500px
// vertically instead of moving 24px over). Horizontal cost is weighted heavier
// because sideways drift bends time-truth.
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

function autoLayout(albums, stageH, ovr, yearScale, seeds = {}) {
  if (!albums.length) return { nodes: [], years: [], totalW: 0 };
  const axisY = stageH - AXIS_GAP;
  const usableH = axisY - 60 - CANVAS_TOP;
  const centerY = CANVAS_TOP + usableH / 2 + 14; // slight down-bias; header owns the top

  // sizes: hand overrides apply to rendering/collision, but the AXIS is built
  // from base ramp sizes only — resizing an album must never slide the timeline
  const nodes = albums.map(a => ({ ...a, size: sizeOf(a.base, ovr[a.id]), baseSize: clamp(a.base, 48, 330) }));

  // adaptive month widths: width follows the cover area each month holds;
  // empty months collapse; the per-year scale (drag a year label) multiplies in
  const mIdx = t => Math.floor(t * 12 + 1e-9);
  const mMin = mIdx(nodes[0].t), mMax = mIdx(nodes[nodes.length - 1].t);
  const areas = new Array(mMax - mMin + 1).fill(0);
  for (const n of nodes) areas[mIdx(n.t) - mMin] += n.baseSize * n.baseSize;
  const widths = areas.map(area =>
    area ? clamp(area / (usableH * FILL), MIN_MONTH_W, MAX_MONTH_W) : GAP_W);
  for (let i = 0; i < widths.length; i++) { // cap long silences
    if (areas[i]) continue;
    let j = i;
    while (j < widths.length && !areas[j]) j++;
    if ((j - i) * GAP_W > MAX_GAP_RUN) for (let k = i; k < j; k++) widths[k] = MAX_GAP_RUN / (j - i);
    i = j;
  }
  for (let i = 0; i < widths.length; i++) {
    const scale = yearScale[Math.floor((mMin + i) / 12)];
    if (scale) widths[i] *= scale;
  }
  const cum = [0];
  for (const w of widths) cum.push(cum[cum.length - 1] + w);
  const totalTimeW = cum[cum.length - 1];
  const xOf = t => {
    const m = clamp(mIdx(t), mMin, mMax);
    return PAD_L + cum[m - mMin] + (t * 12 - m) * widths[m - mMin];
  };
  // river blend: strict-time x mixed with a gapless equal-area flow position,
  // so clusters bleed into each other instead of leaving seams between quarters
  const flowW = nodes.map(n => (n.baseSize * n.baseSize) / (usableH * FILL) + 2);
  const totalFlow = flowW.reduce((a, b) => a + b, 0);
  let run = 0;
  nodes.forEach((n, i) => {
    run += flowW[i] / 2;
    const fx = PAD_L + (run / totalFlow) * totalTimeW;
    run += flowW[i] / 2;
    n.ax = xOf(n.t) * (1 - RIVER) + fx * RIVER;
  });

  // vertical placement. Hand-placed covers are immovable obstacles at their
  // FINAL (dragged) position — so dragging or growing one re-flows everything
  // near it. Everything else places biggest-first, min-gap enforced, drifting
  // sideways when its column is full (a small time-drift beats being buried).
  const yMin = n => CANVAS_TOP + n.size / 2;
  const yMax = n => axisY - 52 - n.size / 2;
  const yPrefOf = n => clamp(centerY + (BAND[n.fam] ?? 0) * BAND_SPACING, yMin(n), yMax(n));
  const obstacles = [];
  const pinnedIds = new Set();
  for (const n of nodes) { n.ax0 = n.ax; n.yPref = yPrefOf(n); } // pre-drift anchors
  for (const n of nodes) {
    const o = ovr[n.id];
    if (o && (o.dx || o.dy)) {
      n.ay = n.yPref; // pins: anchor + saved offset (offset captured at pin time)
      obstacles.push({ x: n.ax + (o.dx || 0), y: n.ay + (o.dy || 0), size: n.size });
      pinnedIds.add(n.id);
    }
  }
  // seeded covers keep their exact on-screen spot; only fresh (never-placed)
  // covers get a greedy nearest-first placement around them
  const unpinned = nodes.filter(n => !pinnedIds.has(n.id));
  const fresh = [];
  for (const n of unpinned) {
    const seed = seeds[n.id];
    if (seed) {
      n.ax = clamp(seed.x, n.ax0 - 260, n.ax0 + 260);
      n.ay = clamp(seed.y, yMin(n), yMax(n));
      obstacles.push({ x: n.ax, y: n.ay, size: n.size });
    } else fresh.push(n);
  }
  for (const n of fresh.sort((x, y) => y.size - x.size)) {
    const yPref = yPrefOf(n);
    const overlapAt = (x, y) => {
      let overlap = 0;
      for (const p of obstacles) {
        const reach = (n.size + p.size) / 2 + MIN_GAP;
        if (Math.abs(p.x - x) >= reach) continue;
        const oy = reach - Math.abs(y - p.y);
        if (oy > 0) overlap += Math.min(reach - Math.abs(p.x - x), oy);
      }
      return overlap;
    };
    let best = [n.ax, yPref], bestOverlap = Infinity;
    for (const [xk, yk] of CANDS) {
      const y = clamp(yPref + yk, yMin(n), yMax(n));
      const ov = overlapAt(n.ax + xk, y);
      if (ov === 0) { best = [n.ax + xk, y]; bestOverlap = 0; break; }
      if (ov < bestOverlap) { bestOverlap = ov; best = [n.ax + xk, y]; }
    }
    [n.ax, n.ay] = best;
    obstacles.push({ x: n.ax, y: n.ay, size: n.size });
  }

  // ripple relaxation: resolve residual overlaps as many SMALL mutual pushes
  // (smaller covers yield more; pins never move) — the settle behaves like the
  // drag physics did, so nothing ever teleports to a distant vacancy
  {
    const finalPos = n => {
      const o = ovr[n.id];
      return pinnedIds.has(n.id) ? { x: n.ax + (o.dx || 0), y: n.ay + (o.dy || 0) } : { x: n.ax, y: n.ay };
    };
    // each cover may ripple at most RIPPLE_MAX from where this settle found it;
    // past that the region shows compression (small overlaps) instead of
    // teleporting covers to distant vacancies — tightness stays visible & local
    const RIPPLE_MAX = 140;
    const startPos = new Map(nodes.map(n => [n.id, { x: n.ax, y: n.ay }]));
    const order = [...nodes].sort((a, b) => finalPos(a).x - finalPos(b).x);
    for (let it = 0; it < 60; it++) {
      let movedAny = false;
      for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const a = order[i], b = order[j];
          const pa = finalPos(a), pb = finalPos(b);
          if (pb.x - pa.x > 420) break;
          const reach = (a.size + b.size) / 2 + MIN_GAP;
          const dx = pb.x - pa.x, dy = pb.y - pa.y;
          if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) continue;
          const penX = reach - Math.abs(dx), penY = reach - Math.abs(dy);
          const alongY = penY <= penX;
          const pen = Math.min(alongY ? penY : penX, 13) + 0.4; // small steps, ripples spread
          const dir = (alongY ? dy : dx) >= 0 ? 1 : -1;
          const wa = pinnedIds.has(a.id) ? 0 : b.size * b.size;
          const wb = pinnedIds.has(b.id) ? 0 : a.size * a.size;
          const tot = wa + wb;
          if (!tot) continue;
          const move = (n, amt) => {
            const s0 = startPos.get(n.id);
            if (alongY) n.ay = clamp(clamp(n.ay + amt, s0.y - RIPPLE_MAX, s0.y + RIPPLE_MAX), yMin(n), yMax(n));
            else n.ax = clamp(clamp(n.ax + amt, s0.x - RIPPLE_MAX, s0.x + RIPPLE_MAX), n.ax0 - 300, n.ax0 + 300);
          };
          if (wa) move(a, -dir * pen * (wa / tot));
          if (wb) move(b, dir * pen * (wb / tot));
          movedAny = true;
        }
      }
      if (!movedAny) break;
      order.sort((a, b) => finalPos(a).x - finalPos(b).x);
    }
  }

  // year ticks sit where each year's first album actually landed in the flow
  const years = [];
  const seen = new Set();
  for (const n of nodes) {
    if (seen.has(n.year)) continue;
    seen.add(n.year);
    years.push({ y: n.year, x: n.ax - 14 });
  }
  return { nodes, years, totalW: PAD_L + totalTimeW + PAD_R };
}

// ---- component -------------------------------------------------------------

// ?view — read-only presentation: same layout + overrides, zero editing chrome
const VIEW_ONLY = new URLSearchParams(window.location.search).has('view');

export default function Arrange() {
  const [albums, setAlbums] = useState(null);
  const [ovr, setOvr] = useState({});   // { id: {dx,dy,size?,tier?,p?}, _years: {2024: 1.4} }
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [playing, setPlaying] = useState(null); // click (view) / HUD ▶ (arrange) = play snippet
  const [playErr, setPlayErr] = useState(null); // album id whose preview failed
  const [pos, setPos] = useState(0);            // playhead seconds, for the snippet picker
  const clipRef = useRef(DEFAULT_CLIP);         // loop window of the currently playing album
  const [physTick, setPhysTick] = useState(0);  // bumps when drag-physics displaces covers
  const dispRef = useRef({});                   // transient physics displacement {id: {x,y}}
  const dragPosRef = useRef(null);              // dragged cover's live position (render source during drag)
  const resizeRef = useRef(null);               // {id, size} while corner-resizing
  const [albumTracks, setAlbumTracks] = useState({}); // {id: [full tracklist]}
  const [localMap, setLocalMap] = useState({});       // albums with a full-length owned file
  const seedsRef = useRef({});                  // last on-screen y per unpinned cover
  const nodesRef = useRef([]);
  const [query, setQuery] = useState('');
  const [fams, setFams] = useState([]);         // active genre filters
  const audioRef = useRef(null);
  const [dragId, setDragId] = useState(null); // cover being dragged — no transition on it
  const [ready, setReady] = useState(false);  // gate transitions until after first paint
  const [stageH, setStageH] = useState(window.innerHeight);
  const scrollRef = useRef(null);
  const drag = useRef(null);
  const saveTimer = useRef(null);
  const ovrRef = useRef(ovr);
  ovrRef.current = ovr;

  useEffect(() => {
    fetch('/timeline-data.json').then(r => r.json()).then(raw => {
      // precompute each album's base size once (layout re-runs live during drags):
      // rank by score among temporal neighbors → smooth big-to-small ramp.
      // Solid keeps (top ~70% by absolute score) never drop below SOLID_FLOOR;
      // only borderline albums may render at the very smallest sizes.
      const sorted = [...raw].sort((x, y) => x.score - y.score);
      const p30 = sorted[Math.floor(sorted.length * 0.3)]?.score ?? 0;
      setAlbums(raw.map(a => {
        const near = raw.filter(b => Math.abs(b.t - a.t) <= RANK_WIN);
        const rank = near.filter(b => b.score > a.score || (b.score === a.score && b.id < a.id)).length;
        const pct = near.length > 1 ? rank / (near.length - 1) : 0;
        const damp = Math.min(1, (near.length - 1) / 8); // sparse stretches skew large
        const floor = a.score < p30 ? SIZE_FLOOR : SOLID_FLOOR;
        const base = Math.max(floor, SIZE_FLOOR + (SIZE_CEIL - SIZE_FLOOR) * Math.pow(1 - pct * damp, RAMP_GAMMA));
        return { ...a, base };
      }));
    });
    fetch('/api/layout').then(r => r.ok ? r.json() : {}).then(v => setOvr(v || {})).catch(() => {});
    fetch('/local/manifest.json').then(r => r.ok ? r.json() : {}).then(setLocalMap).catch(() => {});
    const onResize = () => setStageH(window.innerHeight);
    window.addEventListener('resize', onResize);
    const t = setTimeout(() => setReady(true), 600);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);

  // merge-save: only keys THIS session touched are written over the server copy,
  // so a stale tab can never resurrect old state for albums it didn't edit
  const touched = useRef(new Set());
  const scheduleSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const server = await fetch('/api/layout').then(r => r.ok ? r.json() : {});
        const merged = { ...server };
        for (const id of touched.current) {
          if (ovrRef.current[id] !== undefined) merged[id] = ovrRef.current[id];
          else delete merged[id];
        }
        await fetch('/api/layout', { method: 'POST', body: JSON.stringify(merged) });
      } catch {}
    }, 600);
  };
  const patch = (id, delta) => {
    touched.current.add(id);
    setOvr(prev => {
      const cur = { dx: 0, dy: 0, ...prev[id], ...delta };
      delete cur.p; // touching a proposal makes it a hand edit
      delete cur.tier; // legacy tiers replaced by absolute size on first touch
      if (delta.tier !== undefined) cur.tier = delta.tier;
      if ('song' in delta && delta.song === undefined) delete cur.song;
      const next = { ...prev };
      if (!cur.dx && !cur.dy && cur.size === undefined && !cur.tier && cur.song === undefined && cur.clip === undefined) delete next[id];
      else next[id] = cur;
      return next;
    });
    scheduleSave();
  };
  const patchYear = (year, scale) => {
    touched.current.add('_years');
    setOvr(prev => {
      const years = { ...(prev._years || {}) };
      if (Math.abs(scale - 1) < 0.05) delete years[year]; else years[year] = +scale.toFixed(2);
      return { ...prev, _years: years };
    });
    scheduleSave();
  };

  const yearScale = ovr._years || {};
  const albumOvr = useMemo(() =>
    Object.fromEntries(Object.entries(ovr).filter(([k]) => !k.startsWith('_'))), [ovr]);
  const layoutKey = JSON.stringify([
    Object.fromEntries(Object.entries(albumOvr).filter(([, o]) => o.size !== undefined || o.tier).map(([id, o]) => [id, [o.size, o.tier]])),
    Object.fromEntries(Object.entries(albumOvr).filter(([, o]) => o.dx || o.dy).map(([id, o]) => [id, [Math.round(o.dx / 8), Math.round(o.dy / 8)]])),
    yearScale,
  ]);
  // layout is FROZEN while a cover is being dragged — local push-physics moves
  // neighbors instead; one seeded recompute settles everything on release
  const layoutRef = useRef(null);
  const layout = useMemo(() => {
    if (dragId && layoutRef.current) return layoutRef.current;
    const l = albums ? autoLayout(albums, stageH, albumOvr, yearScale, seedsRef.current) : null;
    layoutRef.current = l;
    return l;
  }, [albums, stageH, layoutKey, dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo(() => {
    if (!layout) return [];
    return layout.nodes.map(n => {
      const o = albumOvr[n.id] || {};
      return { ...n, o, pinned: !!(o.dx || o.dy), x: n.ax + (o.dx || 0), y: n.ay + (o.dy || 0) };
    });
  }, [layout, albumOvr]);
  nodesRef.current = nodes;
  // remember where every unpinned cover currently sits — the seed for the next recompute
  useEffect(() => {
    if (!layout) return;
    seedsRef.current = Object.fromEntries(
      nodes.filter(n => !n.pinned).map(n => [n.id, {
        x: n.x + (dispRef.current[n.id]?.x || 0),
        y: n.y + (dispRef.current[n.id]?.y || 0),
      }]));
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const selNode = sel ? byId[sel] : null;
  const hoverNode = hover && hover !== sel && !dragId ? byId[hover] : null;
  // fetch the full album tracklist when an album is selected (once, cached)
  useEffect(() => {
    if (VIEW_ONLY || !selNode || albumTracks[selNode.id]) return;
    const { id, artist, album } = selNode;
    fetch(`/api/tracks?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`)
      .then(r => r.json())
      .then(j => setAlbumTracks(prev => ({ ...prev, [id]: j.tracks || [] })))
      .catch(() => setAlbumTracks(prev => ({ ...prev, [id]: [] })));
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const guideNode = selNode || hoverNode;

  // audio: loops an 8–20s window of the Deezer 30s preview. Works in both modes
  // (click a cover in view; HUD ▶ or `p` in arrange). If a different song was
  // picked for an album, its preview is resolved server-side and cached.
  const songOf = n => n?.o?.song || n?.song;
  const isLocalSong = n => !!(n && localMap[n.id] && songOf(n) === `local:${n.id}`);
  const spanOf = n => isLocalSong(n) ? localMap[n.id].duration : 30;
  const clipOf = n => n?.o?.clip || [0, spanOf(n)];
  const togglePlay = async (id) => {
    const n = byId[id];
    if (!audioRef.current) {
      const a = new Audio();
      a.ontimeupdate = () => {
        const [ci, co] = clipRef.current;
        if (a.currentTime >= co || a.currentTime < ci - 0.2) a.currentTime = ci;
        setPos(a.currentTime);
      };
      a.onended = () => { a.currentTime = clipRef.current[0]; a.play().catch(() => {}); }; // loop even if the file runs out
      audioRef.current = a;
      window.__arAudio = a; // test hook
    }
    const a = audioRef.current;
    if (playing === id || !n) { a.pause(); setPlaying(null); return; }
    clipRef.current = clipOf(n);
    // local full-length file when chosen; else Deezer, resolved fresh (URLs expire)
    const url = isLocalSong(n)
      ? `/local/${localMap[n.id].file}`
      : await fetch(`/api/preview?artist=${encodeURIComponent(n.artist)}&track=${encodeURIComponent(songOf(n))}&album=${encodeURIComponent(n.album)}`)
          .then(r => r.json()).then(j => j.preview).catch(() => null);
    if (!url) { a.pause(); setPlaying(null); setPlayErr(id); setTimeout(() => setPlayErr(null), 2500); return; }
    a.src = url;
    a.onloadedmetadata = () => { a.currentTime = clipRef.current[0]; a.play().catch(() => {}); };
    setPlaying(id);
    setPlayErr(null);
  };

  // drag-physics: covers near the dragged one get pushed from where they ARE
  // (pins move too, weighted heavier); nothing jumps to a fresh solution mid-drag
  const stepPhysics = (did, px, py) => {
    const ns = nodesRef.current;
    const disp = dispRef.current;
    const dragged = ns.find(n => n.id === did);
    if (!dragged) return;
    const posOf = n => n.id === did
      ? { x: px, y: py }
      : { x: n.x + (disp[n.id]?.x || 0), y: n.y + (disp[n.id]?.y || 0) };
    // elastic: existing displacement decays toward home every step, so covers
    // spring back the moment the pressure moves away — chains stay short-lived
    for (const [id, d] of Object.entries(disp)) {
      d.x *= 0.86; d.y *= 0.86;
      if (Math.abs(d.x) < 0.6 && Math.abs(d.y) < 0.6) delete disp[id];
    }
    const local = ns.filter(n => n.id !== did && Math.abs(posOf(n).x - px) < 560 && Math.abs(posOf(n).y - py) < 560);
    const all = [dragged, ...local];
    const weight = n => n.id === did ? 0 : n.pinned ? 0.4 : 1;
    const sz = n => resizeRef.current?.id === n.id ? resizeRef.current.size : n.size;
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const pa = posOf(a), pb = posOf(b);
        const reach = (sz(a) + sz(b)) / 2 + MIN_GAP;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) continue;
        const penX = reach - Math.abs(dx), penY = reach - Math.abs(dy);
        const alongY = penY <= penX;
        const pen = alongY ? penY : penX;
        const dir = (alongY ? dy : dx) >= 0 ? 1 : -1;
        const wa = weight(a), wb = weight(b), tot = wa + wb;
        if (!tot) continue;
        const push = (n, amt) => {
          const d = disp[n.id] || (disp[n.id] = { x: 0, y: 0 });
          if (alongY) d.y += amt; else d.x += amt;
        };
        if (wa) push(a, -dir * pen * (wa / tot));
        if (wb) push(b, dir * pen * (wb / tot));
      }
    }
    setPhysTick(t => t + 1);
  };

  // search + genre filters: non-matching covers fade back instead of vanishing
  const filterOn = query.trim() !== '' || fams.length > 0;
  const matches = (n) => {
    if (fams.length && !fams.includes(n.fam)) return false;
    const q = query.trim().toLowerCase();
    if (q && !(`${n.artist} ${n.album} ${songOf(n) || ''}`.toLowerCase().includes(q))) return false;
    return true;
  };

  // ---- pointer interactions ----
  const momentum = useRef(null); // active inertia animation frame
  const stopMomentum = () => { if (momentum.current) cancelAnimationFrame(momentum.current); momentum.current = null; };
  const onStageDown = (e) => {
    stopMomentum();
    const viewCover = VIEW_ONLY ? e.target.closest('.ar-cover') : null;
    const coverEl = VIEW_ONLY ? null : e.target.closest('.ar-cover');
    const tickEl = VIEW_ONLY ? null : e.target.closest('.ar-year');
    if (coverEl) setDragId(coverEl.dataset.id);
    const dragNode = coverEl ? nodesRef.current.find(n => n.id === coverEl.dataset.id) : null;
    // first pin captures the cover exactly where it visually sits — offsets are
    // measured against the layout anchors so release causes zero jump
    const dragOvr = dragNode
      ? (dragNode.pinned
        ? { dx: ovrRef.current[dragNode.id].dx || 0, dy: ovrRef.current[dragNode.id].dy || 0 }
        : { dx: dragNode.x - dragNode.ax0, dy: dragNode.y - dragNode.yPref })
      : null;
    const onCorner = coverEl && (() => {
      const r = coverEl.getBoundingClientRect();
      return e.clientX > r.right - 18 && e.clientY > r.bottom - 18;
    })();
    drag.current = {
      vx: 0, lastX: e.clientX, lastT: performance.now(),
      startNode: dragNode ? { x: dragNode.x, y: dragNode.y } : null,
      startSize: dragNode?.size,
      viewClickId: viewCover?.dataset.id || null,
      mode: coverEl ? (onCorner ? 'resize' : 'move') : tickEl ? 'year' : 'pan',
      id: coverEl?.dataset.id,
      year: tickEl ? +tickEl.dataset.year : null,
      startScale: tickEl ? (ovrRef.current._years?.[+tickEl.dataset.year] || 1) : null,
      startX: e.clientX, startY: e.clientY,
      startScroll: scrollRef.current.scrollLeft,
      startOvr: dragOvr,
      moved: false,
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.startX, my = e.clientY - d.startY;
    if (Math.abs(mx) > 4 || Math.abs(my) > 4) d.moved = true;
    const now = performance.now(), dt = now - d.lastT;
    if (dt > 0) { // smoothed px/ms, for release momentum
      d.vx = 0.75 * d.vx + 0.25 * ((e.clientX - d.lastX) / dt);
      d.lastX = e.clientX; d.lastT = now;
    }
    if (!d.moved) return;
    if (d.mode === 'pan') scrollRef.current.scrollLeft = d.startScroll - mx;
    else if (d.mode === 'year') patchYear(d.year, clamp(d.startScale + mx / 240, 0.4, 3.5));
    else if (d.mode === 'resize') {
      const ns = Math.round(clamp(d.startSize + Math.max(mx, my), 48, 330));
      resizeRef.current = { id: d.id, size: ns };
      patch(d.id, { size: ns });
      if (d.startNode) stepPhysics(d.id, d.startNode.x, d.startNode.y);
    }
    else {
      patch(d.id, { dx: (d.startOvr.dx || 0) + mx, dy: (d.startOvr.dy || 0) + my });
      if (d.startNode) {
        dragPosRef.current = { x: d.startNode.x + mx, y: d.startNode.y + my };
        stepPhysics(d.id, d.startNode.x + mx, d.startNode.y + my);
      }
    }
  };
  const onUp = () => {
    const d = drag.current;
    if (d && !d.moved && (d.mode === 'move' || d.mode === 'resize')) {
      setSel(prev => {
        const next = prev === d.id ? null : d.id;
        if (next) togglePlay(d.id);            // selecting an album starts its snippet
        else if (playing) togglePlay(playing); // deselect stops
        return next;
      });
    }
    if (d && !d.moved && d.mode === 'pan') {
      setSel(null);
      if (d.viewClickId) togglePlay(d.viewClickId);
      else if (playing) togglePlay(playing); // background click stops
    }
    if (d && d.moved && (d.mode === 'move' || d.mode === 'resize')) {
      // settle the physics: pushed pins keep their new stored position; pushed
      // unpinned covers seed the recompute so nothing jumps on release
      for (const [id, dsp] of Object.entries(dispRef.current)) {
        const o = ovrRef.current[id];
        if (o && (o.dx || o.dy) && (Math.abs(dsp.x) > 1 || Math.abs(dsp.y) > 1)) {
          patch(id, { dx: o.dx + dsp.x, dy: o.dy + dsp.y });
        }
      }
      for (const n of nodesRef.current) {
        if (!n.pinned && dispRef.current[n.id]) {
          seedsRef.current[n.id] = { x: n.x + dispRef.current[n.id].x, y: n.y + dispRef.current[n.id].y };
        }
      }
      dispRef.current = {};
      dragPosRef.current = null;
      resizeRef.current = null;
    }
    if (d && d.moved && d.mode === 'pan' && Math.abs(d.vx) > 0.08) {
      // glide with the release velocity, decaying
      let v = d.vx, last = performance.now();
      const step = (now) => {
        const dt = now - last; last = now;
        scrollRef.current.scrollLeft -= v * dt;
        v *= Math.pow(0.94, dt / 16);
        if (Math.abs(v) > 0.02) momentum.current = requestAnimationFrame(step);
        else momentum.current = null;
      };
      momentum.current = requestAnimationFrame(step);
    }
    drag.current = null;
    setDragId(null);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      // no selection: keys pan the timeline
      if (!selNode || VIEW_ONLY) {
        const pan = { ArrowLeft: -220, ArrowRight: 220, PageUp: -1200, PageDown: 1200 }[e.key];
        if (pan) { e.preventDefault(); scrollRef.current.scrollBy({ left: pan, behavior: 'smooth' }); }
        else if (e.key === 'Escape' && playing) togglePlay(playing);
        return;
      }
      if (e.key === 'p') { togglePlay(selNode.id); return; }
      const cur = selNode.size;
      if (e.key === '[' || e.key === ']') {
        const dir = e.key === ']' ? 1 : -1;
        // walk the ladder from the nearest step
        let idx = 0;
        for (let i = 0; i < SIZES.length; i++) if (Math.abs(SIZES[i] - cur) < Math.abs(SIZES[idx] - cur)) idx = i;
        const next = SIZES[clamp(idx + dir, 0, SIZES.length - 1)];
        patch(selNode.id, { size: next });
      }
      else if (e.key === 'Escape') setSel(null);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10;
        const o = ovrRef.current[selNode.id];
        // first nudge of an unpinned cover anchors it where it visually sits
        const base = o && (o.dx || o.dy)
          ? { dx: o.dx || 0, dy: o.dy || 0 }
          : { dx: selNode.x - selNode.ax0, dy: selNode.y - selNode.yPref };
        const dv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        patch(selNode.id, { dx: base.dx + dv[0], dy: base.dy + dv[1] });
      } else if (e.key === 'r') { touched.current.add(selNode.id); setOvr(prev => { const n = { ...prev }; delete n[selNode.id]; return n; }); scheduleSave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!layout) return <div className="ar-root ar-loading">loading timeline…</div>;
  const axisY = stageH - AXIS_GAP;
  const handEdits = Object.entries(albumOvr).filter(([, o]) => !o.p).length;

  return (
    <div className={`ar-root ${ready ? 'is-ready' : ''} ${dragId ? 'is-phys' : ''}`} data-phys={physTick}>
      <header className="ar-header">
        <h1>A Life in Music</h1>
        <p>{VIEW_ONLY
          ? `${nodes.length} albums · ${layout.years[0]?.y ?? ''} → now`
          : `arrange mode · ${nodes.length} albums · ${handEdits} hand-placed`}</p>
      </header>

      <div className="ar-controls">
        <input
          className="ar-search"
          placeholder="search artist / album / song…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="ar-chips">
          {Object.entries(FAM_LABEL).filter(([fam]) => nodes.some(n => n.fam === fam)).map(([fam, label]) => (
            <button
              key={fam}
              className={`ar-chip ${fams.includes(fam) ? 'on' : ''}`}
              style={{ '--accent': nodes.find(n => n.fam === fam)?.hue || '#8b93a7' }}
              onClick={() => setFams(prev => prev.includes(fam) ? prev.filter(f => f !== fam) : [...prev, fam])}
            ><i />{label}</button>
          ))}
          {filterOn && <button className="ar-chip ar-chip-clear" onClick={() => { setQuery(''); setFams([]); }}>clear</button>}
        </div>
      </div>

      <div
        className="ar-scroll" ref={scrollRef} onPointerDown={onStageDown}
        onPointerOver={e => setHover(e.target.closest('.ar-cover')?.dataset.id || null)}
        onWheel={e => { stopMomentum(); scrollRef.current.scrollLeft += e.deltaY + e.deltaX; }}
      >
        <div className="ar-stage" style={{ width: layout.totalW, height: stageH }}>
          {guideNode && (
            <svg className="ar-guide" width={layout.totalW} height={stageH} style={{ color: guideNode.hue }}>
              <line className="ar-guide-line" x1={guideNode.x} y1={guideNode.y + guideNode.size / 2} x2={guideNode.ax} y2={axisY} />
              <circle className="ar-guide-dot" cx={guideNode.ax} cy={axisY} r="3.5" />
            </svg>
          )}

          {nodes.map(n => {
            const s = resizeRef.current?.id === n.id ? resizeRef.current.size : n.size;
            return (
              <div
                key={n.id}
                data-id={n.id}
                className={`ar-cover ${sel === n.id ? 'is-sel' : ''} ${playing === n.id ? 'is-playing' : ''} ${dragId === n.id ? 'is-dragging' : ''} ${filterOn && !matches(n) ? 'is-off' : ''} ${!VIEW_ONLY && (n.o.dx || n.o.dy || n.o.size !== undefined || n.o.tier) ? (n.o.p ? 'is-proposed' : 'is-edited') : ''}`}
                style={{
                  left: (dragId === n.id && dragPosRef.current ? dragPosRef.current.x : n.x + (dispRef.current[n.id]?.x || 0)) - s / 2,
                  top: (dragId === n.id && dragPosRef.current ? dragPosRef.current.y : n.y + (dispRef.current[n.id]?.y || 0)) - s / 2,
                  width: s, height: s,
                  zIndex: sel === n.id ? 9000 : Math.round(s),
                  '--accent': n.hue,
                }}
              >
                {n.cover ? <img src={n.cover} alt="" loading="lazy" draggable="false" /> : <span className="ar-noart">{n.album}</span>}
                {sel === n.id && !VIEW_ONLY && <span className="ar-grip" />}
              </div>
            );
          })}

          {hoverNode && (
            <div
              className="ar-tip"
              style={{ left: hoverNode.x, top: hoverNode.y - hoverNode.size / 2 - 12, '--accent': hoverNode.hue }}
            >
              {hoverNode.song && <div className="ar-tip-song">{hoverNode.song}</div>}
              <div className="ar-tip-meta">{hoverNode.artist} · <span className="ar-tip-album">{hoverNode.album}</span></div>
              <div className="ar-tip-genre">{FAM_LABEL[hoverNode.fam]} · {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][hoverNode.month - 1]} {hoverNode.year}</div>
            </div>
          )}

          <div className="ar-axis" style={{ top: axisY, width: layout.totalW }}>
            <div className="ar-axis-line" style={{ width: layout.totalW - 60 }} />
            {layout.years.map(({ y, x }, i) => {
              const end = layout.years[i + 1]?.x ?? layout.totalW - PAD_R + 60;
              return (
                <React.Fragment key={y}>
                  <span className="ar-tick-line" style={{ left: x }} />
                  {/* the year number rides along as you scroll, held between its hash lines */}
                  <div className="ar-yearspan" style={{ left: x + 6, width: Math.max(end - x - 12, 44) }}>
                    <span
                      className={`ar-year ${yearScale[y] ? 'is-scaled' : ''}`}
                      data-year={y}
                    >{y}{yearScale[y] ? ` ×${yearScale[y]}` : ''}</span>
                  </div>
                </React.Fragment>
              );
            })}
            {/* the un-lived runway: the line keeps pointing right */}
            <svg className="ar-axis-arrow" style={{ left: layout.totalW - 46 }} width="14" height="16" viewBox="0 0 14 16">
              <path d="M2 2 L12 8 L2 14" />
            </svg>
          </div>
        </div>
      </div>

      {selNode && !VIEW_ONLY && (
        <div className="ar-hud" style={{ '--accent': selNode.hue }}>
          <img className="ar-hud-art" src={selNode.cover} alt="" />
          <div className="ar-hud-info">
            <div className="ar-hud-album">{selNode.album}</div>
            <div className="ar-hud-artist">{selNode.artist} · {FAM_LABEL[selNode.fam]} · {selNode.year}</div>
            <div className="ar-hud-songrow">
              <button
                className={`ar-play ${playing === selNode.id ? 'on' : ''}`}
                onClick={() => togglePlay(selNode.id)}
                title="play snippet (p)"
              >{playing === selNode.id ? '❚❚' : '▶'}</button>
              {(() => {
                const mine = selNode.songs || [];
                const norm = s => s.toLowerCase().replace(/\s*[([].*?[)\]]/g, '').trim();
                const mineNorm = new Set(mine.map(norm));
                const rest = (albumTracks[selNode.id] || []).filter(t => !mineNorm.has(norm(t)));
                const cur = songOf(selNode) || '';
                const known = mine.includes(cur) || rest.includes(cur);
                return (
                  <select
                    className="ar-songpick"
                    value={cur}
                    onChange={e => patch(selNode.id, { song: e.target.value === selNode.song ? undefined : e.target.value })}
                  >
                    {!known && cur && !isLocalSong(selNode) && <option value={cur}>{cur}</option>}
                    {localMap[selNode.id] && <optgroup label="local file (full song)">
                      <option value={`local:${selNode.id}`}>{localMap[selNode.id].title}</option>
                    </optgroup>}
                    {mine.length > 0 && <optgroup label="your tracks">
                      {mine.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>}
                    {rest.length > 0 && <optgroup label="full album">
                      {rest.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>}
                  </select>
                );
              })()}
              {playErr === selNode.id && <span className="ar-noprev">no preview found</span>}
            </div>
            <div
              className="ar-picker"
              onPointerDown={e => {
                e.stopPropagation();
                const bar = e.currentTarget.getBoundingClientRect();
                const [ci, co] = clipOf(selNode);
                const handle = e.target.dataset?.h; // 'in' | 'out' | undefined (window drag)
                const id = selNode.id;
                const startX = e.clientX;
                const span = spanOf(selNode);
                const clickSec = ((e.clientX - bar.left) / bar.width) * span;
                let movedBar = false;
                const toSec = px => (px / bar.width) * span;
                const move = (ev) => {
                  if (Math.abs(ev.clientX - startX) > 3) movedBar = true;
                  if (!movedBar) return;
                  const ds = toSec(ev.clientX - startX);
                  let ni = ci, no = co;
                  if (handle === 'in') ni = clamp(ci + ds, 0, co - MIN_CLIP);
                  else if (handle === 'out') no = clamp(co + ds, ci + MIN_CLIP, span);
                  else { const len = co - ci; ni = clamp(ci + ds, 0, span - len); no = ni + len; }
                  const clip = [+ni.toFixed(1), +no.toFixed(1)];
                  patch(id, { clip });
                  if (playing === id) clipRef.current = clip;
                };
                const up = () => {
                  // plain click inside the sample = jump the playhead there
                  if (!movedBar && !handle && clickSec >= ci && clickSec <= co && audioRef.current && playing === id) {
                    audioRef.current.currentTime = clickSec;
                    setPos(clickSec);
                  }
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            >
              {(() => {
                const [ci, co] = clipOf(selNode);
                const span = spanOf(selNode);
                return (
                  <>
                    <div className="ar-picker-win" style={{ left: `${(ci / span) * 100}%`, width: `${((co - ci) / span) * 100}%` }}>
                      <span className="ar-picker-h ar-picker-h-l" data-h="in" />
                      <span className="ar-picker-h ar-picker-h-r" data-h="out" />
                    </div>
                    {playing === selNode.id && <div className="ar-picker-head" style={{ left: `${(pos / span) * 100}%` }} />}
                    <span className="ar-picker-times">{(co - ci).toFixed(1)}s</span>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="ar-hud-sizes">
            <button
              className={`ar-size ${selNode.o.size === undefined && !selNode.o.tier ? 'on' : ''}`}
              onClick={() => patch(selNode.id, { size: undefined })}
            >auto</button>
            {SIZES.map((s, i) => (
              <button
                key={s}
                className={`ar-size ${selNode.o.size === s ? 'on' : ''}`}
                onClick={() => patch(selNode.id, { size: s })}
              >{SIZE_LABELS[i]}</button>
            ))}
          </div>
          <button className="ar-reset" onClick={() => { touched.current.add(selNode.id); setOvr(prev => { const n = { ...prev }; delete n[selNode.id]; return n; }); scheduleSave(); }}>reset</button>
          <span className="ar-hud-hint">drag move · [ ] size · arrows nudge · r reset</span>
        </div>
      )}
      <div className="ar-hint">{VIEW_ONLY || sel ? '' : 'drag background to pan · drag a year label to widen it · click an album to edit'}</div>
    </div>
  );
}
