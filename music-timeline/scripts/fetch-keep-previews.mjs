// Fetch Deezer 30s preview URLs for every kept album's representative song.
// Cached in ~/music-catalog/data/preview-cache.json (URLs are time-signed and
// expire after a while — re-run to refresh). build-timeline-data.mjs attaches
// them as `preview` on each album.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const albums = JSON.parse(readFileSync(new URL('../public/timeline-data.json', import.meta.url), 'utf8'));
const cachePath = join(homedir(), 'music-catalog', 'data', 'preview-cache.json');
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

const JUNK = /karaoke|tribute|cover|instrumental|8[- ]?bit|lullaby|made famous|in the style of|originally performed/i;
const norm = s => (s || '').toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
// Deezer's search chokes on "(feat. X)" / "(with X)" suffixes — drop them from the
// query the same way norm() drops them from the comparison.
const bare = s => (s || '').replace(/\s*[([].*?[)\]]/g, '').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// cached nulls are sticky; pass --retry-missing to re-probe them
const retryMissing = process.argv.includes('--retry-missing');

const targets = albums.filter(a => a.song);
const cached = a => `${a.artist}::${a.song}` in cache;
console.log(`${targets.length} keeps with a song; ${targets.filter(cached).length} cached`
  + (retryMissing ? ` (re-probing ${targets.filter(a => cached(a) && !cache[`${a.artist}::${a.song}`]).length} missing)` : ''));

let hit = 0, miss = 0, n = 0;
for (const a of targets) {
  const key = `${a.artist}::${a.song}`;
  if (key in cache && !(retryMissing && !cache[key])) continue;
  n++;
  try {
    const q = encodeURIComponent(`${bare(a.artist)} ${bare(a.song)}`);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=8`).then(r => r.json());
    const na = norm(a.artist), nt = norm(a.song);
    const match = (res.data || []).find(d => {
      if (!d.preview) return false;
      const da = norm(d.artist?.name), dt = norm(d.title);
      if (JUNK.test(d.title) || JUNK.test(d.artist?.name || '')) return false;
      const artistOk = da === na || da.includes(na) || na.includes(da);
      const titleOk = dt === nt || dt.includes(nt) || nt.includes(dt);
      return artistOk && titleOk;
    });
    cache[key] = match ? match.preview : null;
    match ? hit++ : miss++;
  } catch { cache[key] = null; miss++; }
  await sleep(130);
  if (n % 60 === 0) { writeFileSync(cachePath, JSON.stringify(cache)); console.log(`…${n} (${hit} found)`); }
}
writeFileSync(cachePath, JSON.stringify(cache));
console.log(`done: ${hit} previews found, ${miss} missing`);
