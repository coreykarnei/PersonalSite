import React, { useEffect, useMemo, useRef, useState } from 'react';

// Songs pass: one album at a time — pick the representative track and the
// snippet window, nothing else. Same override store as arrange mode
// ({song, clip} on the album's entry), same merge-save discipline.

const DEFAULT_CLIP = [0, 30];
const MIN_CLIP = 1.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FAM_LABEL = { hiphop: 'hip-hop', rnb: 'r&b/soul', electronic: 'electronic', rock: 'rock', folk: 'folk/country', pop: 'pop', jazz: 'jazz', indie: 'indie', latin: 'latin', other: 'unsorted' };

export default function Songs() {
  const [albums, setAlbums] = useState(null);
  const [ovr, setOvr] = useState({});
  // ?at=50 jumps to album 50 (1-based) — handy when switching devices,
  // since the resume point otherwise lives in each browser's localStorage
  const [idx, setIdx] = useState(() => {
    const at = new URLSearchParams(window.location.search).get('at');
    return at ? Math.max(0, +at - 1) : (+localStorage.getItem('mt-songs-idx') || 0);
  });
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [tracks, setTracks] = useState({});
  const [localMap, setLocalMap] = useState({}); // albums with a full-length owned file
  const [noPrev, setNoPrev] = useState(false);
  const audioRef = useRef(null);
  const clipRef = useRef(DEFAULT_CLIP);
  const ovrRef = useRef(ovr);
  ovrRef.current = ovr;
  const touched = useRef(new Set());
  const saveTimer = useRef(null);

  useEffect(() => {
    fetch('/timeline-data.json').then(r => r.json()).then(d => setAlbums(d.sort((a, b) => a.t - b.t)));
    fetch('/api/layout').then(r => r.ok ? r.json() : {}).then(v => setOvr(v || {})).catch(() => {});
    fetch('/local/manifest.json').then(r => r.ok ? r.json() : {}).then(setLocalMap).catch(() => {});
  }, []);

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
      delete cur.p;
      if ('song' in delta && delta.song === undefined) delete cur.song;
      const next = { ...prev };
      if (!cur.dx && !cur.dy && cur.size === undefined && !cur.tier && cur.song === undefined && cur.clip === undefined) delete next[id];
      else next[id] = cur;
      return next;
    });
    scheduleSave();
  };

  const n = albums?.[clamp(idx, 0, (albums?.length || 1) - 1)];
  const o = n ? ovr[n.id] || {} : {};
  const songOf = () => o.song || n?.song;
  const local = n ? localMap[n.id] : null;
  const isLocal = !!(local && songOf() === `local:${n.id}`);
  const span = isLocal ? local.duration : 30; // local files: the WHOLE song is pickable
  const clipOf = () => o.clip || [0, span];

  useEffect(() => { localStorage.setItem('mt-songs-idx', String(idx)); }, [idx]);

  // tracklist for the current album
  useEffect(() => {
    if (!n || tracks[n.id]) return;
    fetch(`/api/tracks?artist=${encodeURIComponent(n.artist)}&album=${encodeURIComponent(n.album)}`)
      .then(r => r.json()).then(j => setTracks(prev => ({ ...prev, [n.id]: j.tracks || [] })))
      .catch(() => setTracks(prev => ({ ...prev, [n.id]: [] })));
  }, [idx, albums]); // eslint-disable-line react-hooks/exhaustive-deps

  // audio: fresh preview per album/song, loops the chosen window
  const play = async () => {
    if (!n) return;
    if (!audioRef.current) {
      const a = new Audio();
      a.ontimeupdate = () => {
        const [ci, co] = clipRef.current;
        if (a.currentTime >= co || a.currentTime < ci - 0.2) a.currentTime = ci;
        setPos(a.currentTime);
      };
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      a.onended = () => { a.currentTime = clipRef.current[0]; a.play().catch(() => {}); }; // loop even if the file runs out
      audioRef.current = a;
      window.__songsAudio = a;
    }
    const a = audioRef.current;
    clipRef.current = clipOf();
    setNoPrev(false);
    const url = isLocal
      ? `/local/${local.file}`
      : await fetch(`/api/preview?artist=${encodeURIComponent(n.artist)}&track=${encodeURIComponent(songOf())}&album=${encodeURIComponent(n.album)}`)
          .then(r => r.json()).then(j => j.preview).catch(() => null);
    if (!url) { a.pause(); setNoPrev(true); return; }
    a.src = url;
    a.onloadedmetadata = () => { a.currentTime = clipRef.current[0]; a.play().catch(() => {}); };
  };
  const stop = () => audioRef.current?.pause();

  // changing album or song re-plays automatically (after the first gesture)
  const started = useRef(false);
  useEffect(() => {
    if (!n || !started.current) return;
    play();
  }, [idx, o.song]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => { stop(); setIdx(i => clamp(i + d, 0, albums.length - 1)); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); started.current = true; playing ? stop() : play(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!albums) return <div className="sg-root sg-loading">loading…</div>;

  const [ci, co] = clipOf();
  const customized = !!(o.song || o.clip);
  const mine = n.songs || [];
  const normT = s => s.toLowerCase().replace(/\s*[([].*?[)\]]/g, '').trim();
  const mineNorm = new Set(mine.map(normT));
  const rest = (tracks[n.id] || []).filter(t => !mineNorm.has(normT(t)));
  const cur = songOf() || '';
  const known = mine.includes(cur) || rest.includes(cur);

  return (
    <div className="sg-root">
      <header className="sg-head">
        <h1>Songs pass</h1>
        <span className="sg-progress">{idx + 1} / {albums.length}</span>
      </header>

      <div className="sg-card" style={{ '--accent': n.hue }}>
        <img className="sg-art" src={n.cover} alt="" />
        <div className="sg-album">{n.album}</div>
        <div className="sg-meta">{n.artist} · {FAM_LABEL[n.fam]} · {MONTHS[n.month - 1]} {n.year}{customized ? ' · ✓ customized' : ''}</div>

        <div className="sg-row">
          <button className={`sg-play ${playing ? 'on' : ''}`} onClick={() => { started.current = true; playing ? stop() : play(); }}>
            {playing ? '❚❚' : '▶'}
          </button>
          <select
            className="sg-pick"
            value={cur}
            onChange={e => { started.current = true; patch(n.id, { song: e.target.value === n.song ? undefined : e.target.value }); }}
          >
            {!known && cur && !isLocal && <option value={cur}>{cur}</option>}
            {local && <optgroup label="local file (full song)">
              <option value={`local:${n.id}`}>{local.title}</option>
            </optgroup>}
            {mine.length > 0 && <optgroup label="your tracks">{mine.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>}
            {rest.length > 0 && <optgroup label="full album">{rest.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>}
          </select>
        </div>
        {noPrev && <div className="sg-noprev">no preview available for this track</div>}

        <div
          className="sg-picker"
          onPointerDown={e => {
            const bar = e.currentTarget.getBoundingClientRect();
            const handle = e.target.dataset?.h;
            const startX = e.clientX;
            const [si, so] = clipOf();
            const id = n.id;
            const clickSec = ((e.clientX - bar.left) / bar.width) * span;
            let movedBar = false;
            const toSec = px => (px / bar.width) * span;
            const move = (ev) => {
              if (Math.abs(ev.clientX - startX) > 3) movedBar = true;
              if (!movedBar) return;
              const ds = toSec(ev.clientX - startX);
              let ni = si, no = so;
              if (handle === 'in') ni = clamp(si + ds, 0, so - MIN_CLIP);
              else if (handle === 'out') no = clamp(so + ds, si + MIN_CLIP, span);
              else { const len = so - si; ni = clamp(si + ds, 0, span - len); no = ni + len; }
              const clip = [+ni.toFixed(1), +no.toFixed(1)];
              patch(id, { clip });
              clipRef.current = clip;
            };
            const up = () => {
              // plain click inside the sample = jump the playhead there
              if (!movedBar && !handle && clickSec >= si && clickSec <= so && audioRef.current && playing) {
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
          <div className="sg-picker-win" style={{ left: `${(ci / span) * 100}%`, width: `${((co - ci) / span) * 100}%` }}>
            <span className="sg-picker-h sg-h-l" data-h="in" />
            <span className="sg-picker-h sg-h-r" data-h="out" />
          </div>
          {playing && <div className="sg-picker-head" style={{ left: `${(pos / span) * 100}%` }} />}
        </div>
        <div className="sg-times">{(co - ci).toFixed(1)}s snippet</div>

        <div className="sg-nav">
          <button onClick={() => go(-1)} disabled={idx === 0}>← prev</button>
          <button className="sg-next" onClick={() => go(1)} disabled={idx === albums.length - 1}>next →</button>
        </div>
      </div>
      <div className="sg-hint">← → move between albums · space play/pause · picks save automatically</div>
    </div>
  );
}
