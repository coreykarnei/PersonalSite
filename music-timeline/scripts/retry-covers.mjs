// Fill in albums still missing a cover, using the confident matcher and slow pacing.
import { writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { albums } from '../src/data.js';

const OUT = new URL('../public/covers/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const JUNK = /karaoke|tribute|made famous|originally performed|instrumental|in the style of|cover version|greatest hits|the essential/i;

function score(r, artist, album) {
  if (!r.artworkUrl100) return -99;
  if (JUNK.test(r.collectionName || '')) return -99;
  const cn = norm(r.collectionName), an = norm(r.artistName);
  const wa = norm(artist), wl = norm(album);
  let s = 0;
  if (an === wa) s += 4; else if (an.includes(wa) || wa.includes(an)) s += 2;
  if (cn === wl) s += 5; else if (cn.startsWith(wl.slice(0, 10))) s += 3; else if (cn.includes(wl.slice(0, 8))) s += 1;
  return s;
}
async function itunes(artist, album) {
  const term = encodeURIComponent(`${artist} ${album}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=12&country=US`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 music-timeline' } });
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  const json = await res.json();
  const ranked = json.results.map((r) => ({ r, s: score(r, artist, album) })).sort((a, b) => b.s - a.s);
  if (!ranked[0] || ranked[0].s < 3) throw new Error('no confident match');
  return ranked[0].r;
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`img ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

const missing = albums.filter((a) => !a.cover);
console.log(`retrying ${missing.length} missing covers...`);
for (const a of missing) {
  let done = false;
  for (let attempt = 0; attempt < 5 && !done; attempt++) {
    try {
      const hit = await itunes(a.artist, a.album);
      const file = `${a.id}.jpg`;
      await download(hit.artworkUrl100.replace('100x100bb', '600x600bb'), path.join(OUT, file));
      a.cover = `covers/${file}`;
      process.stdout.write(`✓ ${a.artist} — ${a.album}\n`);
      done = true;
    } catch (e) {
      if (attempt === 4) process.stdout.write(`✗ ${a.artist} — ${a.album}  (${e.message})\n`);
      else await sleep(2500 + attempt * 2500);
    }
  }
  await sleep(2500); // slow and steady to dodge the rate limiter
}

await writeFile(new URL('../src/data.js', import.meta.url),
  `// Auto-generated sample arc. Replace with Corey's real music history.\n` +
  `// Shape: { id, artist, album, song, year, genre, cover }\n` +
  `export const albums = ${JSON.stringify(albums, null, 2)};\n`);
console.log(`\n${albums.filter((a) => a.cover).length}/${albums.length} now have covers`);
