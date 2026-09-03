// Curated representative arc, 2010 -> present. Sparse early, diversifying, dense later.
// Real albums so iTunes returns real cover art. Swap for Corey's real history later.
import { writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const CURATED = [
  // 2010 — sparse, mainstream doorway
  ['Kanye West', 'My Beautiful Dark Twisted Fantasy', 'Runaway', 2010, 'hip-hop'],
  ['Arcade Fire', 'The Suburbs', 'The Suburbs', 2010, 'indie'],
  // 2011
  ['Bon Iver', 'Bon Iver, Bon Iver', 'Holocene', 2011, 'folk'],
  ['M83', 'Hurry Up, We’re Dreaming', 'Midnight City', 2011, 'electronic'],
  // 2012
  ['Frank Ocean', 'Channel Orange', 'Thinkin Bout You', 2012, 'r&b'],
  ['Kendrick Lamar', 'good kid, m.A.A.d city', 'Money Trees', 2012, 'hip-hop'],
  ['Tame Impala', 'Lonerism', 'Feels Like We Only Go Backwards', 2012, 'indie'],
  // 2013
  ['Daft Punk', 'Random Access Memories', 'Get Lucky', 2013, 'electronic'],
  ['Vampire Weekend', 'Modern Vampires of the City', 'Step', 2013, 'indie'],
  ['Disclosure', 'Settle', 'Latch', 2013, 'electronic'],
  ['Chance the Rapper', 'Acid Rap', 'Cocoa Butter Kisses', 2013, 'hip-hop'],
  // 2014 — diversifying
  ['FKA twigs', 'LP1', 'Two Weeks', 2014, 'r&b'],
  ['Flying Lotus', 'You’re Dead!', 'Never Catch Me', 2014, 'electronic'],
  ['Run the Jewels', 'Run the Jewels 2', 'Close Your Eyes', 2014, 'hip-hop'],
  ['Alvvays', 'Alvvays', 'Archie, Marry Me', 2014, 'indie'],
  ['Mac DeMarco', 'Salad Days', 'Chamber of Reflection', 2014, 'indie'],
  // 2015
  ['Kendrick Lamar', 'To Pimp a Butterfly', 'Alright', 2015, 'hip-hop'],
  ['Tame Impala', 'Currents', 'Let It Happen', 2015, 'indie'],
  ['Sufjan Stevens', 'Carrie & Lowell', 'Should Have Known Better', 2015, 'folk'],
  ['Jamie xx', 'In Colour', 'Gosh', 2015, 'electronic'],
  ['Grimes', 'Art Angels', 'Kill V. Maim', 2015, 'pop'],
  ['Kamasi Washington', 'The Epic', 'Change of the Guard', 2015, 'jazz'],
  // 2016
  ['Frank Ocean', 'Blonde', 'Nights', 2016, 'r&b'],
  ['A Tribe Called Quest', 'We got it from Here... Thank You 4 Your service', 'We the People....', 2016, 'hip-hop'],
  ['Radiohead', 'A Moon Shaped Pool', 'Daydreaming', 2016, 'rock'],
  ['Solange', 'A Seat at the Table', 'Cranes in the Sky', 2016, 'r&b'],
  ['Bon Iver', '22, A Million', '33 “GOD”', 2016, 'folk'],
  ['Nicolas Jaar', 'Sirens', 'No', 2016, 'electronic'],
  // 2017
  ['Kendrick Lamar', 'DAMN.', 'DNA.', 2017, 'hip-hop'],
  ['SZA', 'Ctrl', 'The Weekend', 2017, 'r&b'],
  ['Lorde', 'Melodrama', 'Green Light', 2017, 'pop'],
  ['King Krule', 'The OOZ', 'Dum Surfer', 2017, 'rock'],
  ['Thundercat', 'Drunk', 'Them Changes', 2017, 'jazz'],
  ['Slowdive', 'Slowdive', 'Sugar for the Pill', 2017, 'rock'],
  // 2018
  ['Mitski', 'Be the Cowboy', 'Nobody', 2018, 'indie'],
  ['Kacey Musgraves', 'Golden Hour', 'Slow Burn', 2018, 'folk'],
  ['Pusha T', 'Daytona', 'If You Know You Know', 2018, 'hip-hop'],
  ['Sons of Kemet', 'Your Queen Is a Reptile', 'My Queen Is Ada Eastman', 2018, 'jazz'],
  ['Jon Hopkins', 'Singularity', 'Emerald Rush', 2018, 'electronic'],
  // 2019
  ['Weyes Blood', 'Titanic Rising', 'Andromeda', 2019, 'indie'],
  ['FKA twigs', 'Magdalene', 'cellophane', 2019, 'r&b'],
  ['Tyler, the Creator', 'IGOR', 'EARFQUAKE', 2019, 'hip-hop'],
  ['Big Thief', 'Two Hands', 'Not', 2019, 'folk'],
  ['Floating Points', 'Crush', 'LesAlpx', 2019, 'electronic'],
  ['Angel Olsen', 'All Mirrors', 'Lark', 2019, 'indie'],
  // 2020 — dense
  ['Fiona Apple', 'Fetch the Bolt Cutters', 'Shameika', 2020, 'rock'],
  ['Phoebe Bridgers', 'Punisher', 'Kyoto', 2020, 'indie'],
  ['Perfume Genius', 'Set My Heart on Fire Immediately', 'On the Floor', 2020, 'pop'],
  ['Yves Tumor', 'Heaven to a Tortured Mind', 'Kerosene!', 2020, 'rock'],
  ['Jeff Parker', 'Suite for Max Brown', 'Build a Nest', 2020, 'jazz'],
  // 2021
  ['Little Simz', 'Sometimes I Might Be Introvert', 'Introvert', 2021, 'hip-hop'],
  ['Japanese Breakfast', 'Jubilee', 'Be Sweet', 2021, 'indie'],
  ['Floating Points, Pharoah Sanders & The London Symphony Orchestra', 'Promises', 'Movement 6', 2021, 'ambient'],
  ['Black Country, New Road', 'For the First Time', 'Sunglasses', 2021, 'rock'],
  ['Tirzah', 'Colourgrade', 'Tectonic', 2021, 'electronic'],
  // 2022 — peak density
  ['Big Thief', 'Dragon New Warm Mountain I Believe in You', 'Simulation Swarm', 2022, 'folk'],
  ['Beyoncé', 'RENAISSANCE', 'CUFF IT', 2022, 'pop'],
  ['Alvvays', 'Blue Rev', 'Belinda Says', 2022, 'indie'],
  ['Kendrick Lamar', 'Mr. Morale & the Big Steppers', 'N95', 2022, 'hip-hop'],
  ['Sudan Archives', 'Natural Brown Prom Queen', 'Selfish Soul', 2022, 'r&b'],
  ['Makaya McCraven', 'In These Times', 'Seventh String', 2022, 'jazz'],
  // 2023
  ['Sufjan Stevens', 'Javelin', 'So You Are Tired', 2023, 'folk'],
  ['boygenius', 'the record', 'Not Strong Enough', 2023, 'indie'],
  ['Mitski', 'The Land Is Inhospitable and So Are We', 'My Love Mine All Mine', 2023, 'indie'],
  ['Lankum', 'False Lankum', 'Go Dig My Grave', 2023, 'folk'],
  ['Jessie Ware', 'That! Feels Good!', 'Free Yourself', 2023, 'pop'],
  ['Yves Tumor', 'Praise a Lord Who Chews but Which Does Not Consume', 'Echolalia', 2023, 'rock'],
  // 2024
  ['Charli xcx', 'BRAT', '360', 2024, 'pop'],
  ['Beyoncé', 'COWBOY CARTER', 'TEXAS HOLD ’EM', 2024, 'pop'],
  ['Vampire Weekend', 'Only God Was Above Us', 'Capricorn', 2024, 'indie'],
  ['MJ Lenderman', 'Manning Fireworks', 'She’s Leaving You', 2024, 'rock'],
  ['Nala Sinephro', 'Endlessness', 'Continuum 1', 2024, 'jazz'],
  // 2025 — present edge
  ['FKA twigs', 'EUSEXUA', 'Eusexua', 2025, 'pop'],
  ['Panda Bear', 'Sinister Grift', 'Praise', 2025, 'indie'],
];

const OUT_COVERS = new URL('../public/covers/', import.meta.url);
await mkdir(OUT_COVERS, { recursive: true });

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const JUNK = /karaoke|tribute|made famous|originally performed|instrumental|in the style of|cover version|greatest hits|the essential/i;

function score(r, artist, album) {
  if (!r.artworkUrl100) return -99;
  const cn = norm(r.collectionName), an = norm(r.artistName);
  const wa = norm(artist), wl = norm(album);
  if (JUNK.test(r.collectionName || '')) return -99;
  let s = 0;
  if (an === wa) s += 4; else if (an.includes(wa) || wa.includes(an)) s += 2;
  if (cn === wl) s += 5; else if (cn.startsWith(wl.slice(0, 10))) s += 3; else if (cn.includes(wl.slice(0, 8))) s += 1;
  return s;
}

async function itunes(artist, album) {
  const term = encodeURIComponent(`${artist} ${album}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=10&country=US`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 music-timeline' } });
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  const json = await res.json();
  const ranked = json.results
    .map((r) => ({ r, s: score(r, artist, album) }))
    .sort((a, b) => b.s - a.s);
  const best = ranked[0];
  if (!best || best.s < 3) throw new Error('no confident match');
  return best.r;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`img ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
for (const [artist, album, song, year, genre] of CURATED) {
  const id = slug(`${artist}-${album}`).slice(0, 60);
  let placed = null;
  for (let attempt = 0; attempt < 4 && !placed; attempt++) {
    try {
      const hit = await itunes(artist, album);
      const hi = hit.artworkUrl100.replace('100x100bb', '600x600bb');
      const file = `${id}.jpg`;
      await download(hi, path.join(OUT_COVERS.pathname, file));
      placed = `covers/${file}`;
    } catch (e) {
      if (attempt === 3) process.stdout.write(`✗ ${artist} — ${album}  (${e.message})\n`);
      else await sleep(1400 + attempt * 1600); // back off on 403 / transient
    }
  }
  if (placed) process.stdout.write(`✓ ${artist} — ${album}\n`);
  out.push({ id, artist, album, song, year, genre, cover: placed });
  await sleep(700); // steady, polite pacing
}

const dataPath = new URL('../src/data.js', import.meta.url);
await writeFile(dataPath,
  `// Auto-generated sample arc. Replace with Corey's real music history.\n` +
  `// Shape: { id, artist, album, song, year, genre, cover }\n` +
  `export const albums = ${JSON.stringify(out, null, 2)};\n`);

const ok = out.filter(o => o.cover).length;
console.log(`\nDone: ${ok}/${out.length} covers fetched -> src/data.js`);
