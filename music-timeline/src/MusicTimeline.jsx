import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { albums as defaultAlbums } from './data.js';
import './timeline.css';

// Genre -> accent color used for glow, guide line, tooltip rule.
const GENRE_COLOR = {
  'hip-hop': '#ff8a5c',
  indie: '#7db0ff',
  folk: '#9ad17a',
  electronic: '#5fe6d4',
  'r&b': '#d98cff',
  pop: '#ff6fae',
  rock: '#ff5d6c',
  jazz: '#ffd166',
  ambient: '#8fb3c9',
};
const accentOf = (g) => GENRE_COLOR[g] || '#c9d1e0';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASON_MONTH = { winter: 1, spring: 4, summer: 7, fall: 10, autumn: 10 };

// Deterministic per-id PRNG so layout is stable across renders/screenshots.
function makeRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mapRange = (v, a, b, c, d) => (b === a ? c : c + ((v - a) / (b - a)) * (d - c));

// --- audio / snippet-picker helpers ---
const PREVIEW_LEN = 30;                 // Deezer previews are ~30s
const DEFAULT_WIN = { in: 8, out: 20 }; // default snippet window (seconds)
const RING_C = 2 * Math.PI * 47;        // circumference of the progress ring
const fmt = (s) => `0:${String(clamp(Math.round(s), 0, 99)).padStart(2, '0')}`;
const clampWin = (w, len) => {
  const inS = clamp(w.in, 0, len - 1);
  return { in: inS, out: clamp(w.out, inS + 1, len) };
};
function loadClips() {
  try { return JSON.parse(localStorage.getItem('mt-clips') || '{}'); } catch { return {}; }
}

// Resolve an album to a real month: explicit `month` wins, then `season`,
// otherwise a stable spread across the year so the stream still flows.
function resolveMonth(a) {
  if (typeof a.month === 'number') return clamp(a.month, 1, 12);
  if (a.season && SEASON_MONTH[a.season.toLowerCase()]) return SEASON_MONTH[a.season.toLowerCase()];
  return 1 + Math.floor(makeRng(a.id + '~m')() * 12);
}
const timeOf = (a) => a.year + (resolveMonth(a) - 0.5) / 12;

const STAGE_H = 820;
const AXIS_Y = STAGE_H - 92;
const CANVAS_TOP = 108;
const FLOOR_GAP = 70;
const PAD_L = 190;
const PAD_R = 380;          // open runway to the right — the story isn't finished
const PPY = 340;            // pixels per year — time is continuous, monthly granularity
const DENSITY_WIN = 0.5;    // ± years (~6 months) counted as "around the same time"

function layout(albums) {
  const items = albums
    .filter((a) => a.cover)
    .map((a) => {
      const m = resolveMonth(a);
      return { ...a, month: m, t: a.year + (m - 0.5) / 12, accent: accentOf(a.genre), dateLabel: `${MONTHS[m - 1]} ${a.year}` };
    })
    .sort((p, q) => p.t - q.t);

  if (!items.length) return { nodes: [], bands: [], totalW: PAD_L + PAD_R };

  const tMin = Math.floor(items[0].t);
  const tMax = Math.ceil(items[items.length - 1].t);
  const timeToX = (t) => PAD_L + (t - tMin) * PPY;

  // Local temporal density -> drives size (sparse moments big, busy moments small).
  let dMax = 1;
  for (const it of items) {
    let c = 0;
    for (const j of items) if (Math.abs(j.t - it.t) <= DENSITY_WIN) c++;
    it.density = c;
    if (c > dMax) dMax = c;
  }

  const centerY = (CANVAS_TOP + (AXIS_Y - FLOOR_GAP)) / 2;
  const placed = [];
  const collides = (x, y, size) => {
    for (let k = placed.length - 1; k >= 0; k--) {
      const p = placed[k];
      const reach = ((size + p.size) / 2) * 0.84; // slight overlap allowed -> tighter collage
      if (x - p.x > 240) break; // placed is x-sorted; beyond max cover width nothing can reach
      if (Math.abs(x - p.x) < reach && Math.abs(y - p.y) < reach) return true;
    }
    return false;
  };

  for (const it of items) {
    const x = timeToX(it.t);
    // Inverse-density size: a lone album is a large hero; busy moments shrink into collage.
    const size = clamp(248 / Math.pow(it.density, 0.46), 62, 240);
    const step = size * 0.6;
    let y = centerY;
    for (let attempt = 0; attempt < 90; attempt++) {
      const rank = Math.ceil(attempt / 2);
      const sign = attempt % 2 === 1 ? 1 : -1;
      const cand = centerY + sign * rank * step;
      if (!collides(x, cand, size)) { y = cand; break; }
    }
    it.cxLine = x;
    it.x = x - size / 2;
    it.y = y - size / 2;
    it.size = size;
    placed.push({ x, y, size });
  }

  const bands = [];
  for (let yr = tMin; yr <= tMax; yr++) bands.push({ year: yr, x: timeToX(yr) });

  return { nodes: items, bands, totalW: timeToX(tMax) + PAD_R };
}

export default function MusicTimeline({ albums = defaultAlbums }) {
  const withCovers = useMemo(() => albums.filter((a) => a.cover), [albums]);
  const { nodes, bands, totalW } = useMemo(() => layout(withCovers), [withCovers]);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [grabbing, setGrabbing] = useState(false);
  const [progress, setProgress] = useState(0); // playback position within the snippet window (0..1)
  const [pos, setPos] = useState(0);           // absolute playback position (seconds)
  const [playing, setPlaying] = useState(false);
  const [previewLen, setPreviewLen] = useState(PREVIEW_LEN);
  const [clips, setClips] = useState(loadClips); // per-album chosen snippet window {id:{in,out}}

  const scrollRef = useRef(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const audioRef = useRef(null);
  const selectedRef = useRef(null);
  const winRef = useRef(DEFAULT_WIN);
  const barRef = useRef(null);
  const pick = useRef(null);

  const hoveredNode = hover != null ? nodes.find((n) => n.id === hover) : null;
  const selectedNode = selected != null ? nodes.find((n) => n.id === selected) : null;
  const focus = hoveredNode || selectedNode; // drives the guide line
  const win = clampWin(selected != null ? clips[selected] || DEFAULT_WIN : DEFAULT_WIN, previewLen);

  // keep refs fresh for the audio callbacks
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { winRef.current = win; }, [win.in, win.out]); // eslint-disable-line
  useEffect(() => { try { localStorage.setItem('mt-clips', JSON.stringify(clips)); } catch {} }, [clips]);

  // playback: on selecting an album, stream its Deezer preview and loop the chosen window
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (typeof window !== 'undefined') window.__mtAudio = a; // debug hook for screenshot harness
    if (selected == null || !selectedNode || !selectedNode.preview) {
      a.pause();
      setPlaying(false);
      setProgress(0);
      setPos(0);
      return;
    }
    a.src = selectedNode.preview;
    a.currentTime = winRef.current.in;
    const onLoaded = () => {
      setPreviewLen(Number.isFinite(a.duration) ? clamp(a.duration, 5, 45) : PREVIEW_LEN);
      try { a.currentTime = winRef.current.in; } catch {}
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    const onTime = () => {
      const w = winRef.current;
      if (a.currentTime >= w.out || a.currentTime < w.in - 0.15) {
        try { a.currentTime = w.in; } catch {} // loop the window so you can audition it
      }
      setPos(a.currentTime);
      setProgress(clamp((a.currentTime - w.in) / Math.max(0.2, w.out - w.in), 0, 1));
    };
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    if (a.readyState >= 1) onLoaded();
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.pause();
    };
  }, [selected, selectedNode]);

  const onWheel = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  }, []);

  // click-and-drag to pan left/right anywhere on the canvas
  const onPointerDown = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    setGrabbing(true);
  }, []);
  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d.down) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    const el = scrollRef.current;
    if (el) el.scrollLeft = d.startScroll - dx;
  }, []);
  const endDrag = useCallback(() => {
    drag.current.down = false;
    setGrabbing(false);
  }, []);

  const onCoverClick = useCallback((e, id) => {
    e.stopPropagation();
    if (drag.current.moved) return; // that was a pan, not a click
    setSelected((prev) => (prev === id ? null : id));
  }, []);
  const onBackgroundClick = useCallback(() => {
    if (!drag.current.moved) setSelected(null);
  }, []);

  // dragging the snippet in/out handles (or the whole window) inside the picker
  const movePick = useCallback((e) => {
    const d = pick.current;
    if (!d) return;
    const id = selectedRef.current;
    if (id == null) return;
    const dsec = ((e.clientX - d.startX) / d.barW) * d.len;
    const MIN = 1.5;
    let ni = d.startIn, no = d.startOut;
    if (d.mode === 'in') ni = clamp(d.startIn + dsec, 0, d.startOut - MIN);
    else if (d.mode === 'out') no = clamp(d.startOut + dsec, d.startIn + MIN, d.len);
    else {
      ni = d.startIn + dsec; no = d.startOut + dsec;
      if (ni < 0) { no -= ni; ni = 0; }
      if (no > d.len) { ni -= no - d.len; no = d.len; }
    }
    setClips((prev) => ({ ...prev, [id]: { in: ni, out: no } }));
  }, []);
  const endPick = useCallback(() => {
    pick.current = null;
    window.removeEventListener('pointermove', movePick);
    window.removeEventListener('pointerup', endPick);
  }, [movePick]);
  const beginPick = (mode) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    pick.current = {
      mode,
      startX: e.clientX,
      startIn: win.in,
      startOut: win.out,
      barW: barRef.current ? barRef.current.offsetWidth : 220,
      len: previewLen,
    };
    window.addEventListener('pointermove', movePick);
    window.addEventListener('pointerup', endPick);
  };

  const ringOffset = RING_C * (1 - progress);

  return (
    <div className="mt-root">
      <header className="mt-header">
        <h1>A Life in Music</h1>
        <p>Every album placed at the moment it entered my life — a continuous stream from 2010 to now, thickening as the taste opens up.</p>
      </header>

      <div
        className={`mt-scroll${grabbing ? ' is-grabbing' : ''}`}
        ref={scrollRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="mt-stage" style={{ width: totalW, height: STAGE_H }} onClick={onBackgroundClick}>
          {/* focus guide: a single line from the album down to its exact date on the axis */}
          <svg className="mt-guide" width={totalW} height={STAGE_H} aria-hidden="true">
            {focus && (
              <g style={{ color: focus.accent }}>
                <line className="mt-guide-line" x1={focus.cxLine} y1={focus.y + focus.size} x2={focus.cxLine} y2={AXIS_Y} />
                <circle className="mt-guide-dot" cx={focus.cxLine} cy={AXIS_Y} r="3.5" />
              </g>
            )}
          </svg>

          {/* covers */}
          {nodes.map((n) => {
            const isHover = hover === n.id;
            const isSelected = selected === n.id;
            const active = isHover || isSelected;
            const dim = (hover != null || selected != null) && !active;
            return (
              <button
                key={n.id}
                className={`mt-cover${active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
                style={{
                  left: n.x,
                  top: n.y,
                  width: n.size,
                  height: n.size,
                  '--accent': n.accent,
                  // click commits a hard spotlight; hover alone is a gentler one
                  opacity: dim ? (selected != null ? 0.16 : 0.42) : 1,
                  zIndex: isSelected ? 10000 : active ? 9999 : Math.round(n.y),
                }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                onClick={(e) => onCoverClick(e, n.id)}
                aria-pressed={isSelected}
                aria-label={`${n.album} by ${n.artist}, ${n.dateLabel}`}
              >
                <img src={n.cover} alt="" draggable="false" />
                {isSelected && (
                  <span className="mt-ring" aria-hidden="true">
                    <svg viewBox="0 0 100 100">
                      <circle className="bg" cx="50" cy="50" r="47" />
                      <circle className="fg" cx="50" cy="50" r="47" style={{ strokeDashoffset: ringOffset }} />
                    </svg>
                  </span>
                )}
                <span className="mt-play" aria-hidden="true">{isSelected ? (playing ? '❚❚' : '▶') : '▶'}</span>
              </button>
            );
          })}

          {/* axis */}
          <div className="mt-axis" style={{ top: AXIS_Y }}>
            <div className="mt-axis-line" style={{ width: totalW }} />
            {bands.map((b) => (
              <div key={b.year} className="mt-tick" style={{ left: b.x }}>
                <span className="mt-tick-dot" />
                <span className="mt-year">{b.year}</span>
              </div>
            ))}
            <svg className="mt-axis-arrow" style={{ left: totalW - 14 }} width="16" height="16" aria-hidden="true">
              <path d="M1 3 L9 8 L1 13" />
            </svg>
          </div>

          {/* transient hover preview (only when not the selected/playing one) */}
          {hoveredNode && hover !== selected && (
            <div
              className="mt-tip"
              style={{ left: hoveredNode.x + hoveredNode.size / 2, top: hoveredNode.y - 14, '--accent': hoveredNode.accent }}
            >
              <div className="mt-tip-song">{hoveredNode.song}</div>
              <div className="mt-tip-meta">
                {hoveredNode.artist} · <span className="mt-tip-album">{hoveredNode.album}</span>
              </div>
              <div className="mt-tip-genre">{hoveredNode.genre} · {hoveredNode.dateLabel}</div>
            </div>
          )}

          {/* committed "now playing" panel with the in/out snippet picker */}
          {selectedNode && (
            <div
              className="mt-tip mt-panel is-playing"
              style={{ left: selectedNode.x + selectedNode.size / 2, top: selectedNode.y - 14, '--accent': selectedNode.accent }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-tip-song">{selectedNode.song}</div>
              <div className="mt-tip-meta">
                {selectedNode.artist} · <span className="mt-tip-album">{selectedNode.album}</span>
              </div>
              <div className="mt-tip-genre">{selectedNode.genre} · {selectedNode.dateLabel}</div>

              {selectedNode.preview ? (
                <>
                  <div className="mt-picker" ref={barRef} onPointerDown={beginPick('move')}>
                    <div
                      className="mt-picker-win"
                      style={{ left: `${(win.in / previewLen) * 100}%`, width: `${((win.out - win.in) / previewLen) * 100}%` }}
                      onPointerDown={beginPick('move')}
                    >
                      <span className="mt-picker-h mt-picker-h-l" onPointerDown={beginPick('in')} />
                      <span className="mt-picker-h mt-picker-h-r" onPointerDown={beginPick('out')} />
                    </div>
                    <div className="mt-picker-head" style={{ left: `${(pos / previewLen) * 100}%` }} />
                  </div>
                  <div className="mt-picker-times">
                    <span>{fmt(win.in)}</span>
                    <span>{(win.out - win.in).toFixed(1)}s snippet · drag to set</span>
                    <span>{fmt(win.out)}</span>
                  </div>
                </>
              ) : (
                <div className="mt-noprev">no preview available for this track</div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="mt-hint">
        {selectedNode
          ? 'drag the handles to pick the snippet · click the album again to stop'
          : 'hover to preview · click to play · drag to move'}
      </footer>
    </div>
  );
}
