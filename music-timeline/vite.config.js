import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// persist curation verdicts server-side (~/music-catalog/data/verdicts.json) so
// keep/maybe/cut marks survive browser data wipes and follow across devices
const STORES = {
  '/api/verdicts': join(homedir(), 'music-catalog', 'data', 'verdicts.json'),
  '/api/layout': join(homedir(), 'music-catalog', 'data', 'layout-overrides.json'),
};
const jsonStore = (route, file) => (server) => {
  server.middlewares.use(route, (req, res) => {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(existsSync(file) ? readFileSync(file, 'utf8') : '{}');
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          JSON.parse(body); // validate before writing
          writeFileSync(file, body);
          res.end('ok');
        } catch { res.statusCode = 400; res.end('bad json'); }
      });
    } else { res.statusCode = 405; res.end(); }
  });
};
// server-side Deezer preview lookup (browser can't call Deezer directly: CORS).
// Deezer preview URLs are time-signed and DIE within hours, so URLs are never
// persisted — resolved fresh at play time, held in memory with a short TTL.
const JUNK = /karaoke|tribute|cover version|instrumental|8[- ]?bit|lullaby|made famous|in the style of/i;
const norm = s => (s || '').toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const previewMem = new Map(); // key -> { url, ts }
const TTL_HIT = 25 * 60 * 1000, TTL_MISS = 8 * 60 * 1000; // short miss TTL: an "empty" answer may just be rate-limiting
const previewApi = (server) => {
  server.middlewares.use('/api/preview', async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const artist = url.searchParams.get('artist') || '', track = url.searchParams.get('track') || '';
    const key = `${artist}::${track}`;
    res.setHeader('Content-Type', 'application/json');
    try {
      const hit = previewMem.get(key);
      if (hit && Date.now() - hit.ts < (hit.url ? TTL_HIT : TTL_MISS)) {
        res.end(JSON.stringify({ preview: hit.url }));
        return;
      }
      // strict field query first (ranks the canonical studio cut on top),
      // then score: exact clean titles beat live/remix/acoustic variants
      const album = url.searchParams.get('album') || '';
      const VERSION_PEN = /\blive\b|remix|acoustic|sped.?up|slowed|demo|radio edit|instrumental|medley|karaoke|\bcover\b|rendition|tribute|reprise|cappella|8[- ]?bit|lullaby|- version|\(version/i;
      const na = norm(artist), nt = norm(track), nal = norm(album);
      const score = d => {
        if (!d.preview || JUNK.test(d.artist?.name || '')) return -1e9;
        const da = norm(d.artist?.name), dt = norm(d.title), rawT = (d.title || '').toLowerCase();
        let s = 0;
        if (da === na) s += 4;
        else if (da.includes(na) || na.includes(da)) s += 1;
        else return -1e9;
        if (dt === nt) s += 3; else if (dt.includes(nt) || nt.includes(dt)) s += 1; else return -1e9;
        if (rawT.trim() === track.toLowerCase().trim()) s += 3;
        if (VERSION_PEN.test(rawT)) s -= 5;
        if (nal && norm(d.album?.title) === nal) s += 2;
        return s;
      };
      let data = (await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`artist:"${artist}" track:"${track}"`)}&limit=12`).then(r => r.json())).data || [];
      if (!data.length) data = (await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${track}`)}&limit=12`).then(r => r.json())).data || [];
      const best = data.map(d => [score(d), d]).sort((a, b) => b[0] - a[0])[0];
      const m = best && best[0] > 0 ? best[1] : null;
      previewMem.set(key, { url: m ? m.preview : null, ts: Date.now() });
      res.end(JSON.stringify({ preview: m ? m.preview : null }));
    } catch { res.end(JSON.stringify({ preview: null })); }
  });
};

// full album tracklists from Deezer (titles don't expire — cached in memory).
// Empty results are NOT cached: Deezer rate-limiting returns empty data with no
// error flag, and caching that poisoned albums permanently.
const tracksMem = new Map();
const tracksApi = (server) => {
  server.middlewares.use('/api/tracks', async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const artist = url.searchParams.get('artist') || '', album = url.searchParams.get('album') || '';
    const key = `${artist}::${album}`;
    res.setHeader('Content-Type', 'application/json');
    try {
      if (!tracksMem.has(key) || tracksMem.get(key).length === 0) {
        const q = encodeURIComponent(`${artist} ${album}`);
        const js = await fetch(`https://api.deezer.com/search/album?q=${q}&limit=5`).then(r => r.json());
        const na = norm(artist);
        let m = (js.data || []).find(d => !JUNK.test(d.title || '') &&
          (norm(d.artist?.name) === na || norm(d.artist?.name).includes(na) || na.includes(norm(d.artist?.name))));
        if (!m) {
          // album search misses some albums track search can see — go in via a track
          const ts = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`artist:"${artist}" album:"${album}"`)}&limit=5`).then(r => r.json());
          const t = (ts.data || []).find(d => norm(d.artist?.name) === na || norm(d.artist?.name).includes(na) || na.includes(norm(d.artist?.name)));
          if (t?.album?.id) m = t.album;
        }
        let titles = [];
        if (m) {
          const tj = await fetch(`https://api.deezer.com/album/${m.id}/tracks?limit=50`).then(r => r.json());
          titles = (tj.data || []).map(t => t.title).filter(Boolean);
        }
        tracksMem.set(key, titles);
      }
      res.end(JSON.stringify({ tracks: tracksMem.get(key) }));
    } catch { res.end(JSON.stringify({ tracks: [] })); }
  });
};

const verdictsApi = () => ({
  name: 'json-stores',
  configureServer(server) {
    for (const [route, file] of Object.entries(STORES)) jsonStore(route, file)(server);
    previewApi(server);
    tracksApi(server);
  },
});

export default defineConfig({
  plugins: [react(), verdictsApi()],
  // 0.0.0.0 so the Pi's Tailscale IP works from the laptop; ufw default-denies
  // the LAN interface, so in practice this is loopback + Tailscale only.
  server: { host: '0.0.0.0', port: 5188, strictPort: true },
  preview: { host: '0.0.0.0', port: 5188, strictPort: true },
});
