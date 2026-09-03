// Backfill genres for albums with no MusicBrainz/likes data, via Deezer's
// album genre tags. Results cached in ~/music-catalog/data/genre-cache.json;
// build-timeline-data.mjs picks the cache up as a last-resort fallback.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const albums = JSON.parse(readFileSync(new URL('../public/timeline-data.json', import.meta.url), 'utf8'));
const cachePath = join(homedir(), 'music-catalog', 'data', 'genre-cache.json');
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

const norm = s => s.toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const targets = albums.filter(a => a.fam === 'other');
console.log(`${targets.length} unsorted albums; ${targets.filter(a => `${a.artist}::${a.album}` in cache).length} already cached`);

let hit = 0, miss = 0, n = 0;
for (const a of targets) {
  const key = `${a.artist}::${a.album}`;
  if (key in cache) continue;
  n++;
  try {
    const q = encodeURIComponent(`${a.artist} ${a.album}`);
    const res = await fetch(`https://api.deezer.com/search/album?q=${q}&limit=5`).then(r => r.json());
    const match = (res.data || []).find(d =>
      norm(d.artist?.name || '') === norm(a.artist) || norm(d.title || '') === norm(a.album));
    if (!match) { cache[key] = []; miss++; continue; }
    await sleep(120);
    const full = await fetch(`https://api.deezer.com/album/${match.id}`).then(r => r.json());
    const genres = (full.genres?.data || []).map(g => g.name).filter(g => g && g !== 'All');
    cache[key] = genres;
    genres.length ? hit++ : miss++;
  } catch { cache[key] = []; miss++; }
  await sleep(120);
  if (n % 40 === 0) { writeFileSync(cachePath, JSON.stringify(cache)); console.log(`…${n}/${targets.length} (${hit} tagged)`); }
}
writeFileSync(cachePath, JSON.stringify(cache));
console.log(`done: ${hit} newly tagged, ${miss} no-genre/miss`);
