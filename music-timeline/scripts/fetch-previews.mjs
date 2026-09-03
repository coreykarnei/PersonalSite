// Add a Deezer 30s preview URL to each album by searching for its representative song.
import { writeFile } from 'node:fs/promises';
import { albums } from '../src/data.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const JUNK = /karaoke|tribute|made famous|originally performed|instrumental|freestyle|in the style|cover version|remix|sped up|slowed/i;

function score(t, artist, song) {
  if (!t.preview) return -99;
  if (JUNK.test(t.title || '') || JUNK.test(t.artist?.name || '')) return -99;
  const tt = norm(t.title), an = norm(t.artist?.name);
  const wa = norm(artist), ws = norm(song);
  let s = 0;
  if (an === wa) s += 4; else if (an.includes(wa) || wa.includes(an)) s += 2; else return -99;
  if (tt === ws) s += 5; else if (tt.startsWith(ws.slice(0, 8))) s += 3; else if (tt.includes(ws.slice(0, 6))) s += 1; else return -99;
  return s;
}

async function findPreview(artist, song) {
  const q = encodeURIComponent(`${artist} ${song}`);
  const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=12`);
  if (!res.ok) throw new Error(`deezer ${res.status}`);
  const json = await res.json();
  const ranked = (json.data || []).map((t) => ({ t, s: score(t, artist, song) })).sort((a, b) => b.s - a.s);
  return ranked[0] && ranked[0].s > 0 ? ranked[0].t.preview : null;
}

let ok = 0;
for (const a of albums) {
  if (!a.cover) continue;
  try {
    const preview = await findPreview(a.artist, a.song);
    a.preview = preview || null;
    if (preview) { ok++; process.stdout.write(`✓ ${a.artist} — ${a.song}\n`); }
    else process.stdout.write(`✗ ${a.artist} — ${a.song}  (no match)\n`);
  } catch (e) {
    a.preview = null;
    process.stdout.write(`✗ ${a.artist} — ${a.song}  (${e.message})\n`);
  }
  await sleep(180);
}

await writeFile(new URL('../src/data.js', import.meta.url),
  `// Auto-generated sample arc (Deezer art + preview). Replace with Corey's real music history.\n` +
  `// Shape: { id, artist, album, song, year, genre, cover, preview }\n` +
  `export const albums = ${JSON.stringify(albums, null, 2)};\n`);
console.log(`\n${ok}/${albums.filter((a) => a.cover).length} previews added`);
