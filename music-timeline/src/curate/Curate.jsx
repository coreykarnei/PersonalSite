import React, { useEffect, useMemo, useRef, useState } from 'react';

// ---- helpers ---------------------------------------------------------------

const VERDICTS_KEY = 'mt-verdicts'; // { [albumId]: 'keep' | 'maybe' | 'cut' }
const loadVerdicts = () => {
  try { return JSON.parse(localStorage.getItem(VERDICTS_KEY)) || {}; } catch { return {}; }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = iso => iso ? `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '—';

const HUES = [
  [/hip.?hop|rap|trap|drill|grime/i, '#ff9f43'],
  [/r&b|soul|funk|neo.?soul/i, '#c792ea'],
  [/electronic|house|techno|edm|idm|ambient|synth|electro/i, '#4dd0e1'],
  [/rock|punk|metal|shoegaze|grunge|emo/i, '#ef5350'],
  [/folk|country|americana|singer.?songwriter|acoustic/i, '#9ccc65'],
  [/pop/i, '#f06292'],
  [/jazz|blues/i, '#ffd54f'],
  [/indie|alternative/i, '#7986cb'],
  [/latin|reggaeton|salsa|cumbia/i, '#ffab91'],
];
const accentFor = genres => {
  for (const g of genres || []) for (const [re, hue] of HUES) if (re.test(g)) return hue;
  return '#8b93a7';
};

const quarterOf = iso => `${iso.slice(0, 4)} Q${Math.ceil(+iso.slice(5, 7) / 3)}`;

// ---- component -------------------------------------------------------------

export default function Curate() {
  const [data, setData] = useState(null);
  const [verdicts, setVerdicts] = useState(loadVerdicts);
  const [filter, setFilter] = useState('all'); // all|suggested|unreviewed|keep|maybe|cut
  const [albumsOnly, setAlbumsOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetch('/candidates.json').then(r => r.json()).then(setData);
    // server copy is the source of truth; localStorage is just an offline fallback
    fetch('/api/verdicts').then(r => r.ok ? r.json() : null).then(v => {
      if (v && Object.keys(v).length) setVerdicts(prev => ({ ...prev, ...v }));
    }).catch(() => {});
  }, []);

  const saveTimer = useRef(null);
  useEffect(() => {
    localStorage.setItem(VERDICTS_KEY, JSON.stringify(verdicts));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/verdicts', { method: 'POST', body: JSON.stringify(verdicts) }).catch(() => {});
    }, 600);
  }, [verdicts]);

  const albums = data?.albums || [];
  const byId = useMemo(() => Object.fromEntries(albums.map(a => [a.id, a])), [albums]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return albums.filter(a => {
      if (albumsOnly && a.type !== 'album') return false;
      if (q && !(`${a.artist} ${a.album}`.toLowerCase().includes(q))) return false;
      const v = verdicts[a.id];
      if (filter === 'suggested') return a.suggested;
      if (filter === 'unreviewed') return !v;
      if (filter === 'keep' || filter === 'maybe' || filter === 'cut') return v === filter;
      return true;
    });
  }, [albums, verdicts, filter, albumsOnly, query]);

  // group into quarters, score-sorted inside each
  const groups = useMemo(() => {
    const m = new Map();
    for (const a of visible) {
      const key = quarterOf(a.firstSeen);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(a);
    }
    for (const list of m.values()) list.sort((x, y) => y.score - x.score);
    return [...m.entries()]; // insertion order follows firstSeen sort from the builder
  }, [visible]);

  // covers in the order they appear on screen (band by band, score-sorted within) —
  // arrow keys and auto-advance must follow this, not the date-sorted `visible`
  const ordered = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  const counts = useMemo(() => {
    const c = { keep: 0, maybe: 0, cut: 0 };
    for (const v of Object.values(verdicts)) if (c[v] !== undefined) c[v]++;
    return c;
  }, [verdicts]);

  const focus = focusId ? byId[focusId] : null;

  // keep the focused cover in view when arrows/auto-advance move it off-screen
  useEffect(() => {
    if (!focusId) return;
    document.querySelector(`.cu-cover[data-id="${focusId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusId]);

  const setVerdict = (id, v) => {
    setVerdicts(prev => {
      const next = { ...prev };
      if (next[id] === v) delete next[id]; // toggle off
      else next[id] = v;
      return next;
    });
  };

  // verdict + advance to the next visible album
  const judgeAndAdvance = (v) => {
    if (!focus) return;
    setVerdict(focus.id, v);
    const i = ordered.findIndex(a => a.id === focus.id);
    const next = ordered[i + 1];
    if (next) setFocusId(next.id);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (!focus) return;
      if (e.key === 'a' || e.key === 'k') judgeAndAdvance('keep');
      else if (e.key === 's' || e.key === 'm') judgeAndAdvance('maybe');
      else if (e.key === 'x') judgeAndAdvance('cut');
      else if (e.key === 'Escape') setFocusId(null);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = ordered.findIndex(a => a.id === focus.id);
        const n = ordered[i + (e.key === 'ArrowRight' ? 1 : -1)];
        if (n) setFocusId(n.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportKeeps = () => {
    const pick = v => albums.filter(a => verdicts[a.id] === v).map(a => ({
      id: a.id,
      artist: a.artist,
      album: a.album,
      song: a.likedTracks[0]?.name || null,
      year: +a.firstSeen.slice(0, 4),
      month: +a.firstSeen.slice(5, 7),
      approxDate: a.approxDate,
      genre: a.genres[0] || null,
      cover: a.cover,
    }));
    const blob = new Blob([JSON.stringify({ keep: pick('keep'), maybe: pick('maybe') }, null, 2)],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url; el.download = 'timeline-selection.json'; el.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return <div className="cu-root cu-loading">loading catalog…</div>;

  return (
    <div className={`cu-root ${focus ? 'has-panel' : ''}`}>
      <header className="cu-bar">
        <div className="cu-title">
          <h1>The Cut</h1>
          <span className="cu-sub">{albums.length} candidates · pick what makes the timeline</span>
        </div>
        <div className="cu-filters">
          {['all', 'suggested', 'unreviewed', 'keep', 'maybe', 'cut'].map(f => (
            <button key={f} className={`cu-f ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f}{f === 'keep' ? ` ${counts.keep}` : f === 'maybe' ? ` ${counts.maybe}` : f === 'cut' ? ` ${counts.cut}` : ''}
            </button>
          ))}
          <button className={`cu-f ${albumsOnly ? 'on' : ''}`} onClick={() => setAlbumsOnly(v => !v)}>
            albums only
          </button>
          <input
            className="cu-search" placeholder="search artist / album…"
            value={query} onChange={e => setQuery(e.target.value)}
          />
          <button className="cu-export" onClick={exportKeeps}>
            export {counts.keep + counts.maybe ? `(${counts.keep}+${counts.maybe})` : ''}
          </button>
        </div>
      </header>

      <main className="cu-scroll" ref={listRef} onClick={e => { if (e.target === e.currentTarget) setFocusId(null); }}>
        {groups.map(([label, list]) => (
          <section key={label} className="cu-band">
            <div className="cu-band-head">
              <span className="cu-band-label">{label}</span>
              <span className="cu-band-count">{list.length}</span>
            </div>
            <div className="cu-grid">
              {list.map(a => {
                const v = verdicts[a.id];
                return (
                  <button
                    key={a.id}
                    data-id={a.id}
                    className={[
                      'cu-cover',
                      a.suggested ? 'is-suggested' : '',
                      v ? `is-${v}` : '',
                      focusId === a.id ? 'is-focus' : '',
                    ].join(' ')}
                    style={{ '--accent': accentFor(a.genres) }}
                    title={`${a.artist} — ${a.album}`}
                    onClick={() => setFocusId(a.id)}
                  >
                    {a.cover
                      ? <img src={a.cover} alt="" loading="lazy" />
                      : <span className="cu-noart">{a.album.slice(0, 12)}</span>}
                    {a.suggested && <span className="cu-star">★</span>}
                    {v && <span className={`cu-mark cu-mark-${v}`}>{v === 'keep' ? '✓' : v === 'maybe' ? '~' : '✕'}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {!groups.length && <div className="cu-empty">nothing matches this filter</div>}
      </main>

      {focus && (
        <aside className="cu-panel" style={{ '--accent': accentFor(focus.genres) }}>
          <img className="cu-panel-art" src={focus.cover} alt="" />

          <div className="cu-panel-main">
            <div className="cu-panel-album">{focus.album}</div>
            <div className="cu-panel-artist">{focus.artist}</div>
            <div className="cu-panel-meta">
              {focus.type}{focus.release ? ` · released ${focus.release.slice(0, 4)}` : ''}
              {focus.genres.length ? ` · ${focus.genres.slice(0, 2).join(', ')}` : ''}
            </div>
            <div className="cu-ev">
              <div className="cu-ev-row">
                <span className="cu-ev-k">entered life</span>
                <span className="cu-ev-v">
                  {fmtDate(focus.firstSeen)}
                  {focus.dateSource && focus.dateSource !== 'spotify' &&
                    <span className="cu-src"> via {focus.dateSource}</span>}
                  {focus.approxDate && <em className="cu-approx">{focus.dateSource === 'memory' ? ' (year from memory — month unconfirmed)' : ' (bulk import — date unreliable)'}</em>}
                </span>
              </div>
              <div className="cu-ev-row">
                <span className="cu-ev-k">liked tracks</span>
                <span className="cu-ev-v">{focus.likedCount || '0'}</span>
              </div>
              {focus.bestRank !== null && (
                <div className="cu-ev-row">
                  <span className="cu-ev-k">lifetime rank</span>
                  <span className="cu-ev-v">#{focus.bestRank + 1} <span className="cu-dim">· {focus.rankedCount} charted</span></span>
                </div>
              )}
              <div className="cu-ev-row">
                <span className="cu-ev-k">score</span>
                <span className="cu-ev-v">{Math.round(focus.score * 100)}{focus.suggested ? ' ★' : ''}</span>
              </div>
            </div>
          </div>

          <div className="cu-panel-songs">
            {focus.likedTracks.length > 0 && (
              <>
                <span className="cu-ev-k">songs</span>
                <ul className="cu-songs">
                  {focus.likedTracks.map(t => (
                    <li key={t.name}>{t.name}{t.rank !== null && <span className="cu-dim"> #{t.rank + 1}</span>}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="cu-panel-lists">
            {focus.note && <div className="cu-note">{focus.note}</div>}
            {focus.playlists.length > 0 && (
              <>
                <span className="cu-ev-k">playlists</span>
                <div className="cu-chips">
                  {focus.playlists.map(p => (
                    <span key={p} className={`cu-chip ${focus.seasons.includes(p) ? 'is-season' : ''}`}>{p}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="cu-panel-actions">
            <div className="cu-verdicts">
              <button className={`cu-v cu-v-keep ${verdicts[focus.id] === 'keep' ? 'on' : ''}`} onClick={() => judgeAndAdvance('keep')}>✓ keep <kbd>a</kbd></button>
              <button className={`cu-v cu-v-maybe ${verdicts[focus.id] === 'maybe' ? 'on' : ''}`} onClick={() => judgeAndAdvance('maybe')}>~ maybe <kbd>s</kbd></button>
            </div>
            <div className="cu-panel-hint">←/→ browse · blank = pass · esc close</div>
          </div>
        </aside>
      )}
    </div>
  );
}
