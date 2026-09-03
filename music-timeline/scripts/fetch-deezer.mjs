// Fetch album covers from Deezer (open API, 1000px art, gentle rate limits).
// Requires BOTH an artist match and an album-title match, so artist-only
// mismatches (e.g. a single named "Moon River") are rejected.
import { writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { CURATED } from './curated.mjs';

const OUT = new URL('../public/covers/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const JUNK = /karaoke|tribute|made famous|originally performed|in the style|cover version|medley|solo sounds|rhodes|piano version|lullaby|8-bit/i;

function score(a, artist, album) {
  if (JUNK.test(a.title || '') || JUNK.test(a.artist?.name || '')) return -99;
  const at = norm(a.title), an = norm(a.artist?.name);
  const wa = norm(artist), wl = norm(album);
  let artistS = an === wa ? 4 : (an.includes(wa) || wa.includes(an)) ? 2 : 0;
  let albumS = at === wl ? 5 : at.startsWith(wl.slice(0, 10)) ? 3 : at.includes(wl.slice(0, 8)) ? 1 : 0;
  if (artistS === 0 || albumS === 0) return -99; // require both
  // prefer shorter titles (avoid deluxe/collectors when exact exists)
  return artistS + albumS - Math.min(2, Math.abs(at.length - wl.length) / 20);
}

async function deezer(artist, album) {
  const q = encodeURIComponent(`${artist} ${album}`);
  const url = `https://api.deezer.com/search/album?q=${q}&limit=15`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`deezer ${res.status}`);
  const json = await res.json();
  const ranked = (json.data || []).map((a) => ({ a, s: score(a, artist, album) })).sort((x, y) => y.s - x.s);
  if (!ranked[0] || ranked[0].s < 0) throw new Error('no confident match');
  return ranked[0].a;
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`img ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

const out = [];
for (const [artist, album, song, year, genre] of CURATED) {
  const id = slug(`${artist}-${album}`).slice(0, 60);
  let placed = null;
  for (let attempt = 0; attempt < 4 && !placed; attempt++) {
    try {
      const a = await deezer(artist, album);
      const art = a.cover_xl || a.cover_big || a.cover_medium;
      if (!art) throw new Error('no art url');
      const file = `${id}.jpg`;
      await download(art, path.join(OUT, file));
      placed = `covers/${file}`;
    } catch (e) {
      if (attempt === 3) process.stdout.write(`✗ ${artist} — ${album}  (${e.message})\n`);
      else await sleep(800 + attempt * 1000);
    }
  }
  if (placed) process.stdout.write(`✓ ${artist} — ${album}\n`);
  out.push({ id, artist, album, song, year, genre, cover: placed });
  await sleep(250);
}

await writeFile(new URL('../src/data.js', import.meta.url),
  `// Auto-generated sample arc (Deezer art). Replace with Corey's real music history.\n` +
  `// Shape: { id, artist, album, song, year, genre, cover }\n` +
  `export const albums = ${JSON.stringify(out, null, 2)};\n`);
console.log(`\nDone: ${out.filter((o) => o.cover).length}/${out.length} covers -> src/data.js`);
