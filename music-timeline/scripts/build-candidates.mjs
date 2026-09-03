// Build album-level timeline candidates from the raw music catalog on jarvis.
// Reads ~/music-catalog/data/*, writes public/candidates.json for the curation page.
//
// Evidence per album:
//   - liked tracks (count, names, first/last added_at)
//   - playlist entries (count, playlist names — seasonal playlists are strong era evidence)
//   - best lifetime top-track rank (Spotify long_term affinity, lower = more listened)
//   - genre (MusicBrainz artist genres)
// Score is a weighted blend; "suggested" flags the top N per year of first contact.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DATA = join(homedir(), 'music-catalog', 'data');
const read = f => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const readOpt = f => existsSync(join(DATA, f)) ? read(f) : null;

// "Take Care (Deluxe Version)" / "Wake Me Up - Single" → "take care" / "wake me up"
const normTitle = s => s.toLowerCase()
  .replace(/\s*[([].*?[)\]]/g, '')
  .replace(/\s*-\s*(single|ep|deluxe.*|expanded.*)$/i, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const albumKey = (artist, album) => `${normTitle(artist)}::${normTitle(album)}`;

const savedTracks = read('saved_tracks.json');
const playlists = read('playlists.json');
const playlistTracks = read('playlist_tracks.json');
const topLong = read('top_tracks_long_term.json');
const artistGenres = read('artist_genres_mb.json');

const plName = Object.fromEntries(playlists.map(p => [p.id, p.name]));

// pre-Spotify iTunes library (optional) — real Date Added from the 2014 era
const itunesTracks = readOpt('itunes-tracks.json') || [];
const itunesAlbums = new Map();
for (const t of itunesTracks) {
  if (!t.added) continue;
  const key = albumKey(t.artist, t.album);
  if (!itunesAlbums.has(key)) itunesAlbums.set(key, {
    artist: t.artist, album: t.album.replace(/\s*[([](deluxe|expanded|bonus)[^)\]]*[)\]]/i, '').trim(),
    genre: t.genre, first: t.added, tracks: [], consumed: false,
  });
  const rec = itunesAlbums.get(key);
  rec.tracks.push(t.name);
  if (t.added < rec.first) rec.first = t.added;
}

// manual additions (memory-only era: mixtapes, aux-cord, YouTube) — Corey's dates are truth
const manual = readOpt('manual-additions.json') || [];
const SEASONAL = /\b(spring|summer|fall|autumn|winter)\s*['’]?\d{2,4}\b|\b(spring|summer|fall|autumn|winter)\s+20\d\d\b/i;

const albums = new Map(); // album id -> record

function albumRec(al, primaryArtist) {
  if (!albums.has(al.id)) {
    const img = (al.images || []).find(i => i.width === 300) || (al.images || [])[0];
    albums.set(al.id, {
      id: al.id,
      album: al.name,
      artist: primaryArtist,
      artistIds: (al.artists || []).map(a => a.id),
      type: al.album_type,
      release: al.release_date || null,
      cover: img ? img.url : null,
      liked: [],        // {name, at, rank}
      firstLiked: null,
      lastLiked: null,
      playlistNames: new Set(),
      playlistAdds: [], // ISO dates
      bestRank: null,
      rankedCount: 0,
    });
  }
  return albums.get(al.id);
}

// lifetime affinity rank per track id
const rankById = new Map(topLong.map((t, i) => [t.id, i]));

// 1) liked tracks
for (const e of savedTracks) {
  const t = e.track;
  if (!t || !t.album) continue;
  const rec = albumRec(t.album, t.artists?.[0]?.name || '?');
  const rank = rankById.has(t.id) ? rankById.get(t.id) : null;
  rec.liked.push({ name: t.name, at: e.added_at, rank });
  if (!rec.firstLiked || e.added_at < rec.firstLiked) rec.firstLiked = e.added_at;
  if (!rec.lastLiked || e.added_at > rec.lastLiked) rec.lastLiked = e.added_at;
}

// bulk-import days (e.g. 2022-07-02: 445 likes in one sitting) — dates from these
// days say "imported then", not "entered my life then"
const dayCounts = {};
for (const e of savedTracks) dayCounts[e.added_at.slice(0, 10)] = (dayCounts[e.added_at.slice(0, 10)] || 0) + 1;
const BULK_DAYS = new Set(Object.entries(dayCounts).filter(([, n]) => n >= 50).map(([d]) => d));

// 2) playlist membership — e.item is the track object itself (its `track` key is a boolean).
// A playlist gaining >=25 tracks in one day is a bulk assembly ("Indie" got 100 on
// 2016-04-29), so those added_at dates are curation dates, not first-contact dates.
const plDayCounts = {};
for (const [pid, entries] of Object.entries(playlistTracks))
  for (const e of entries) {
    if (!e.added_at) continue;
    const k = pid + e.added_at.slice(0, 10);
    plDayCounts[k] = (plDayCounts[k] || 0) + 1;
  }
for (const [pid, entries] of Object.entries(playlistTracks)) {
  const name = plName[pid] || pid;
  for (const e of entries) {
    const t = e.item;
    if (!t || typeof t !== 'object' || !t.album || !t.album.id) continue;
    const rec = albumRec(t.album, t.artists?.[0]?.name || '?');
    rec.playlistNames.add(name);
    if (t.name) (rec.plTrackNames ??= new Set()).add(t.name); // which song was playlisted
    if (e.added_at) {
      const bulk = plDayCounts[pid + e.added_at.slice(0, 10)] >= 25;
      rec.playlistAdds.push(e.added_at);
      if (bulk) rec.bulkDates ??= new Set(), rec.bulkDates.add(e.added_at);
    }
  }
}

// 3) top-rank presence for albums whose tracks charted but were never "liked"
for (const [i, t] of topLong.entries()) {
  if (!t.album || !t.album.id) continue;
  const rec = albumRec(t.album, t.artists?.[0]?.name || '?');
  if (rec.bestRank === null || i < rec.bestRank) rec.bestRank = i;
  rec.rankedCount++;
}

// genres: first artist with non-empty MB genres
function genresFor(rec) {
  for (const aid of rec.artistIds) {
    const g = artistGenres[aid];
    if (g && g.genres && g.genres.length) return g.genres.slice(0, 4);
  }
  return [];
}

const N = topLong.length;
const out = [];
for (const rec of albums.values()) {
  const likedCount = rec.liked.length;
  const nPl = rec.playlistAdds.length || rec.playlistNames.size;
  const firstPl = rec.playlistAdds.length ? rec.playlistAdds.slice().sort()[0] : null;
  // prefer organic dates (not from a bulk-import/bulk-assembly day) for "when it entered my life"
  const allDates = [...rec.liked.map(t => t.at), ...rec.playlistAdds].filter(Boolean).sort();
  const organic = allDates.filter(d => !BULK_DAYS.has(d.slice(0, 10)) && !(rec.bulkDates && rec.bulkDates.has(d)));
  let firstSeen = organic[0] || allDates[0] || null;
  let approxDate = !organic.length && allDates.length > 0; // only bulk evidence
  const lastSeen = allDates.at(-1) || null;

  // iTunes-era evidence — the earlier date wins (a 2016 Spotify re-like of an album
  // bought on iTunes in 2014 entered life in 2014)
  let dateSource = 'spotify';
  const itunes = itunesAlbums.get(albumKey(rec.artist, rec.album));
  if (itunes) {
    itunes.consumed = true;
    if (!firstSeen || itunes.first < firstSeen) { firstSeen = itunes.first; dateSource = 'itunes'; approxDate = false; }
  }

  // signals normalized 0..1
  const sLiked = Math.min(likedCount / 5, 1);
  const sRank = rec.bestRank === null ? 0 : 1 - rec.bestRank / N;
  const sDepth = Math.min(rec.rankedCount / 6, 1); // many tracks charted = album lived-in
  const sPl = Math.min(nPl / 4, 1);
  const spanYears = firstSeen && lastSeen ? (new Date(lastSeen) - new Date(firstSeen)) / 3.156e10 : 0;
  const sSpan = Math.min(spanYears / 4, 1);
  const score = +(0.3 * sLiked + 0.28 * sRank + 0.16 * sDepth + 0.14 * sPl + 0.12 * sSpan).toFixed(4);

  const seasons = [...rec.playlistNames].filter(n => SEASONAL.test(n));
  out.push({
    id: rec.id,
    album: rec.album,
    artist: rec.artist,
    type: rec.type,
    release: rec.release,
    cover: rec.cover,
    genres: genresFor(rec),
    firstSeen,
    approxDate,
    dateSource,
    lastSeen,
    likedCount,
    // liked tracks first; if none, fall back to playlisted tracks, then iTunes
    // tracks — every album should offer SOME playable, pickable songs
    likedTracks: (rec.liked.length
      ? rec.liked.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)).map(t => ({ name: t.name, rank: t.rank }))
      : [...(rec.plTrackNames || []), ...(itunes ? itunes.tracks : [])]
          .filter((v, i, arr) => arr.indexOf(v) === i).map(name => ({ name, rank: null }))
    ).slice(0, 8),
    bestRank: rec.bestRank,
    rankedCount: rec.rankedCount,
    playlists: [...rec.playlistNames].slice(0, 10),
    seasons,
    score,
  });
}

// albums that exist only in the iTunes library (never touched Spotify)
for (const it of itunesAlbums.values()) {
  if (it.consumed) continue;
  out.push({
    id: 'it-' + albumKey(it.artist, it.album).replace(/[^a-z0-9]+/g, '-'),
    album: it.album, artist: it.artist,
    type: /- single$|single\b/i.test(it.album) ? 'single' : 'album',
    release: null, cover: null,
    genres: it.genre ? [it.genre] : [],
    firstSeen: it.first, approxDate: false, dateSource: 'itunes', lastSeen: it.first,
    likedCount: it.tracks.length,
    likedTracks: it.tracks.slice(0, 8).map(n => ({ name: n, rank: null })),
    bestRank: null, rankedCount: 0, playlists: [], seasons: [],
    score: +Math.min(0.1 + it.tracks.length * 0.05, 0.35).toFixed(4),
  });
}

// manual memory entries: {artist, album, song?, year, month?, genre?, note?}
for (const m of manual) {
  const mm = String(m.month || 6).padStart(2, '0');
  out.push({
    id: 'mm-' + albumKey(m.artist, m.album).replace(/[^a-z0-9]+/g, '-'),
    album: m.album, artist: m.artist, type: m.type || 'album',
    release: null, cover: null,
    genres: m.genre ? [m.genre] : [],
    firstSeen: `${m.year}-${mm}-15T00:00:00`, approxDate: !m.month, dateSource: 'memory',
    lastSeen: null,
    likedCount: 0,
    likedTracks: m.song ? [{ name: m.song, rank: null }] : [],
    bestRank: null, rankedCount: 0, playlists: [], seasons: [],
    note: m.note || null,
    score: 0.5, // memory entries exist because they mattered
  });
}

// merge edition duplicates (deluxe/clean/expanded/re-releases) into one candidate,
// unioning evidence — earliest firstSeen wins, best rank wins, playlists union
const byKey = new Map();
for (const a of out) {
  const key = (a.type === 'single' ? 's:' : 'a:') + albumKey(a.artist, a.album);
  const prev = byKey.get(key);
  if (!prev) { byKey.set(key, a); continue; }
  const [base, other] = (a.score > prev.score || (!prev.cover && a.cover)) ? [a, prev] : [prev, a];
  if (other.firstSeen && (!base.firstSeen || other.firstSeen < base.firstSeen)) {
    base.firstSeen = other.firstSeen; base.dateSource = other.dateSource; base.approxDate = other.approxDate;
  }
  if (other.lastSeen && (!base.lastSeen || other.lastSeen > base.lastSeen)) base.lastSeen = other.lastSeen;
  base.likedCount += other.likedCount;
  const seenSongs = new Set(base.likedTracks.map(t => t.name));
  for (const t of other.likedTracks) if (!seenSongs.has(t.name)) base.likedTracks.push(t);
  base.likedTracks = base.likedTracks.sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9)).slice(0, 8);
  if (other.bestRank !== null && (base.bestRank === null || other.bestRank < base.bestRank)) base.bestRank = other.bestRank;
  base.rankedCount = Math.max(base.rankedCount, other.rankedCount);
  base.playlists = [...new Set([...base.playlists, ...other.playlists])].slice(0, 10);
  base.seasons = [...new Set([...base.seasons, ...other.seasons])];
  base.cover ||= other.cover;
  base.genres = base.genres.length ? base.genres : other.genres;
  base.note ||= other.note;
  base.score = Math.max(base.score, other.score);
  byKey.set(key, base);
}
const merged = [...byKey.values()];

// stable ids: artist+title slug, immune to rebuilds, edition merges, and source changes
// (verdicts in the UI are keyed by this id — it must never shift between runs)
for (const a of merged) {
  a.id = (a.type === 'single' ? 's-' : 'a-') + albumKey(a.artist, a.album).replace(/[^a-z0-9]+/g, '-');
}

// fetch covers for iTunes/memory records via Deezer, cached so reruns stay offline
const coverCachePath = join(DATA, 'cover-cache.json');
const coverCache = existsSync(coverCachePath) ? JSON.parse(readFileSync(coverCachePath, 'utf8')) : {};
const needCover = merged.filter(a => !a.cover);
for (const a of needCover) {
  const ck = `${a.artist}::${a.album}`;
  if (!(ck in coverCache)) {
    try {
      const q = encodeURIComponent(`${a.artist} ${a.album.replace(/ - single$/i, '')}`);
      const res = await fetch(`https://api.deezer.com/search/album?q=${q}&limit=5`);
      const js = await res.json();
      const hit = (js.data || []).find(d =>
        normTitle(d.artist?.name || '') === normTitle(a.artist) ||
        normTitle(d.title || '') === normTitle(a.album));
      coverCache[ck] = hit ? hit.cover_big || hit.cover_medium : null;
      await new Promise(r => setTimeout(r, 250));
    } catch { coverCache[ck] = null; }
  }
  a.cover = coverCache[ck];
}
writeFileSync(coverCachePath, JSON.stringify(coverCache, null, 1));

// keep only albums with a date anchor (no firstSeen = can't be placed on a timeline)
const placeable = merged.filter(a => a.firstSeen);

// suggested: top 12 per calendar year of firstSeen, albums preferred over singles
const byYear = {};
for (const a of placeable) {
  const y = a.firstSeen.slice(0, 4);
  (byYear[y] ||= []).push(a);
}
for (const list of Object.values(byYear)) {
  list.sort((x, y) => y.score - x.score);
  list.slice(0, 12).forEach(a => { a.suggested = true; });
}

placeable.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
const meta = {
  generated: new Date().toISOString(),
  total: placeable.length,
  dropped: merged.length - placeable.length,
  years: Object.fromEntries(Object.entries(byYear).map(([y, l]) => [y, l.length]).sort()),
};
writeFileSync(new URL('../public/candidates.json', import.meta.url),
  JSON.stringify({ meta, albums: placeable }));
console.log(`wrote ${placeable.length} candidates (${meta.dropped} dropped for no date anchor)`);
console.log('per year:', meta.years);
