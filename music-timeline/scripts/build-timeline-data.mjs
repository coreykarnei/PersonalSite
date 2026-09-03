// Assemble the real timeline dataset: every album marked 'keep' in The Cut,
// with resolved fractional-year time, genre family, and cover.
// Reads public/candidates.json + ~/music-catalog/data/verdicts.json,
// writes public/timeline-data.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const candidates = JSON.parse(readFileSync(new URL('../public/candidates.json', import.meta.url), 'utf8'));
const verdicts = JSON.parse(readFileSync(join(homedir(), 'music-catalog', 'data', 'verdicts.json'), 'utf8'));

const FAMILIES = [
  ['hiphop', /hip.?hop|rap|trap|drill|grime/i, '#ff9f43'],
  ['rnb', /r&b|soul|funk|neo.?soul/i, '#c792ea'],
  ['electronic', /electronic|house|techno|edm|idm|ambient|synth|electro|dance/i, '#4dd0e1'],
  ['rock', /rock|punk|metal|shoegaze|grunge|emo/i, '#ef5350'],
  ['folk', /folk|country|americana|singer.?songwriter|acoustic/i, '#9ccc65'],
  ['pop', /pop/i, '#f06292'],
  ['jazz', /jazz|blues/i, '#ffd54f'],
  ['indie', /indie|alternative/i, '#7986cb'],
  ['latin', /latin|reggaeton|salsa|cumbia/i, '#ffab91'],
];
const HUE = Object.fromEntries(FAMILIES.map(([fam, , hue]) => [fam, hue]));

// fallback: artist-majority family from the derived likes (Liner Notes pipeline),
// for artists MusicBrainz has no genres for
const likes = JSON.parse(readFileSync(join(homedir(), 'music-catalog', 'derived', 'likes.json'), 'utf8'));
const LIKES_FAM = { 'hip hop': 'hiphop', 'r&b/soul': 'rnb', 'folk/country': 'folk', electronic: 'electronic', pop: 'pop', rock: 'rock', jazz: 'jazz' };
const artistVotes = {};
for (const l of likes) {
  const f = LIKES_FAM[l.f];
  if (!f) continue;
  (artistVotes[l.a.toLowerCase()] ||= {})[f] = ((artistVotes[l.a.toLowerCase()] || {})[f] || 0) + 1;
}
const artistFam = Object.fromEntries(Object.entries(artistVotes).map(([a, votes]) =>
  [a, Object.entries(votes).sort((x, y) => y[1] - x[1])[0][0]]));

// preview URLs (scripts/fetch-keep-previews.mjs) — attached when cached
const previewCachePath = join(homedir(), 'music-catalog', 'data', 'preview-cache.json');
let previewCache = {};
try { previewCache = JSON.parse(readFileSync(previewCachePath, 'utf8')); } catch {}

// last-resort fallback: Deezer album genre tags (scripts/backfill-genres.mjs)
const genreCachePath = join(homedir(), 'music-catalog', 'data', 'genre-cache.json');
let genreCache = {};
try { genreCache = JSON.parse(readFileSync(genreCachePath, 'utf8')); } catch {}

function familyOf(genres, artist, album) {
  for (const g of genres || []) for (const [fam, re, hue] of FAMILIES) if (re.test(g)) return { fam, hue };
  const fb = artistFam[artist.toLowerCase()];
  if (fb) return { fam: fb, hue: HUE[fb] };
  for (const g of genreCache[`${artist}::${album}`] || [])
    for (const [fam, re, hue] of FAMILIES) if (re.test(g)) return { fam, hue };
  return { fam: 'other', hue: '#8b93a7' };
}

const keeps = candidates.albums.filter(a => verdicts[a.id] === 'keep');
const out = keeps.map(a => {
  const y = +a.firstSeen.slice(0, 4), m = +a.firstSeen.slice(5, 7), day = +a.firstSeen.slice(8, 10) || 15;
  const dim = new Date(y, m, 0).getDate(); // days in month
  const { fam, hue } = familyOf(a.genres, a.artist, a.album);
  return {
    id: a.id,
    artist: a.artist,
    album: a.album,
    song: a.likedTracks[0]?.name || null,
    songs: a.likedTracks.map(t => t.name), // all liked tracks — pick the representative in the HUD
    t: y + (m - 1 + (day - 0.5) / dim) / 12,
    year: y, month: m,
    fam, hue,
    genre: a.genres[0] || null,
    cover: a.cover,
    preview: previewCache[`${a.artist}::${a.likedTracks[0]?.name}`] || null,
    score: a.score,
    approxDate: a.approxDate,
  };
}).sort((x, y) => x.t - y.t);

writeFileSync(new URL('../public/timeline-data.json', import.meta.url), JSON.stringify(out));
const fams = {};
for (const a of out) fams[a.fam] = (fams[a.fam] || 0) + 1;
console.log(`wrote ${out.length} keeps ·`, fams);
