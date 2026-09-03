// Ingest a locally-owned audio file as a full-length playable track for an album.
// Transcodes to AAC, drops it in public/local/, and registers it in the manifest
// — the songs/arrange pickers then offer it as "<title> (local file)" with the
// snippet window spanning the WHOLE song instead of Deezer's 30s.
//
// Usage: node scripts/add-local-track.mjs <audio-file> <album-id> [title]
//   e.g. node scripts/add-local-track.mjs ~/incoming/stubborn-love.m4a \
//          a-the-lumineers-the-lumineers "Stubborn Love"
//
// Full tracks are gitignored — only short trimmed clips ever get deployed
// (a freeze-time export cuts each album's chosen window to public/clips/).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const [src, albumId, titleArg] = process.argv.slice(2);
if (!src || !albumId) {
  console.error('usage: node scripts/add-local-track.mjs <audio-file> <album-id> [title]');
  process.exit(1);
}
if (!existsSync(src)) { console.error('no such file:', src); process.exit(1); }

const albums = JSON.parse(readFileSync(new URL('../public/timeline-data.json', import.meta.url), 'utf8'));
if (!albums.some(a => a.id === albumId)) {
  console.error(`album id "${albumId}" not found in timeline-data.json`);
  const guess = albums.filter(a => albumId.split('-').some(t => t.length > 3 && a.id.includes(t))).slice(0, 5);
  if (guess.length) console.error('did you mean:', guess.map(a => a.id).join(', '));
  process.exit(1);
}

const outDir = new URL('../public/local/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const outFile = `${albumId}.m4a`;

execFileSync('ffmpeg', ['-y', '-i', src, '-vn', '-c:a', 'aac', '-b:a', '160k', outDir + outFile], { stdio: 'inherit' });
const duration = +execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', outDir + outFile]).toString().trim();

const manifestPath = outDir + 'manifest.json';
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
manifest[albumId] = {
  file: outFile,
  title: titleArg || basename(src).replace(/\.[^.]+$/, ''),
  duration: +duration.toFixed(1),
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`added local track for ${albumId}: "${manifest[albumId].title}" (${Math.round(duration)}s)`);
