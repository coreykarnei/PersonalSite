# Local-track wishlist

Songs where Deezer's 30s preview misses the moment — candidates for an owned
full-length file via `scripts/add-local-track.mjs` (see that script's header).
Ingest makes the full song pickable in the songs/arrange pickers; only the
chosen trimmed clip ever deploys.

- [ ] **The Lumineers — Stubborn Love** (`a-the-lumineers-the-lumineers`) — flagged 2026-08-22
- [ ] **Bon Iver — Skinny Love** (`a-bon-iver-for-emma-forever-ago`) — flagged 2026-08-22
- [ ] **Milo — Sweet Chin Music (The Fisher King's Anthem)** (`a-milo-things-that-happen-at-day-things-that-happen-at-night`) — flagged 2026-08-22
- [ ] **alt-J — Fitzpleasure** (`a-altj-an-awesome-wave`) — flagged 2026-08-22
- [ ] **The Head and the Heart — Lost in My Mind** (`a-the-head-and-the-heart-the-head-and-the-heart`) — flagged 2026-08-23
- [ ] **Logic — The Spotlight** (`a-logic-young-sinatra-undeniable`) — flagged 2026-08-23 — mixtape, not on Deezer at all (no tracklist/preview), so local is the only lane
- [ ] **Foxing — The Medic** (`a-foxing-the-albatross`) — flagged 2026-08-23
- [ ] **Passion Pit — Take a Walk** (`a-passion-pit-gossamer`) — flagged 2026-08-23
- [ ] **Tame Impala — Eventually** (`a-tame-impala-currents`) — flagged 2026-08-23
- [ ] **ayokay — Kings of Summer** (`s-ayokay-kings-of-summer`) — flagged 2026-08-23
- [ ] **Felly — Fabrics** (`a-felly-waking-up-to-sirens`) — flagged 2026-08-23 — no Deezer preview
- [ ] **Post Malone — White Iverson** (`a-post-malone-stoney`) — flagged 2026-08-23
- [ ] **Monte Booker — Kolors (feat. Smino)** (`s-monte-booker-soulection-white-label-monte-booker`) — flagged 2026-08-23 — no Deezer preview
- [ ] **Two Feet — Go Fuck Yourself** (`s-two-feet-first-steps`) — flagged 2026-08-23
- [ ] **Post Malone — Congratulations (Remix) [feat. Quavo & Future]** (`s-post-malone-congratulations`) — flagged 2026-08-28 — he wants the remix specifically; the preview scorer deliberately penalizes remixes, so local is the lane
- [ ] **Smino — Anita** (`s-smino-anita`) — flagged 2026-08-28
- [ ] **Max Wonders — Kid Again** (`a-max-wonders-hues-to-blame`) — flagged 2026-08-28
- [ ] **Healy — Winse** (`s-healy-winse`) — flagged 2026-08-28

Swept 2026-09-03: every keep with no preview, re-probed after the `bare()` query
fix in `fetch-keep-previews.mjs`. These are real Deezer gaps, not match failures.

- [ ] **Daughter — Candles** (`s-daughter-his-young-heart`) — flagged 2026-09-03
- [ ] **Daughter — Youth** (`s-daughter-the-wild-youth`) — flagged 2026-09-03
- [ ] **The Cinematic Orchestra — To Build A Home** (`a-the-cinematic-orchestra-ma-fleur`) — flagged 2026-09-03
- [ ] **Milmine — Altered State Of Mind** (`a-milmine-so-long-and-thanks`) — flagged 2026-09-03
- [ ] **BJ The Chicago Kid — His Pain** (`a-bj-the-chicago-kid-pineapple-nowlaters`) — flagged 2026-09-03
- [ ] **Pond — Sweep Me Off My Feet** (`a-pond-the-weather`) — flagged 2026-09-03
- [ ] **LAUREL — Scream Drive Faster** (`s-laurel-scream-drive-faster`) — flagged 2026-09-03
- [ ] **ego apartment — NEXT 2 U** (`s-ego-apartment-next-2-u`) — flagged 2026-09-03
- [ ] **Benét — Funny (feat. Childish Major)** (`s-bent-funny`) — flagged 2026-09-03
- [ ] **Declan McKenna — Brazil** (`a-declan-mckenna-what-do-you-think-about-the-car`) — flagged 2026-09-03
- [ ] **Orion Sun — Antidote** (`a-orion-sun-a-collection-of-fleeting-moments-and-daydreams`) — flagged 2026-09-03
- [ ] **Kacey Musgraves — Deeper Well** (`s-kacey-musgraves-deeper-well`) — flagged 2026-09-03
- [ ] **Sâlo — Yearning** (`s-slo-yearning`) — flagged 2026-09-03
- [ ] **SOFI TUKKER — Original Sin** (`a-sofi-tukker-wet-tennis`) — flagged 2026-09-03
- [ ] **King Krule — Out Getting Ribs** (`a-king-krule-6-feet-beneath-the-moon`) — flagged 2026-09-03
- [ ] **Sean Paul — Get Busy - Odd Mob Club Mix** (`s-sean-paul-get-busy`) — flagged 2026-09-03 — the club mix specifically; the scorer penalizes remixes
- [ ] **About You — Jessi** (`s-about-you-jessi`) — flagged 2026-09-03 — artist/song may be transposed upstream; check before sourcing
- [ ] **astadia — Starts With You** (`s-astadia-starts-with-you`) — flagged 2026-09-03
- [ ] **Tabby — prequel** (`s-tabby-prequel`) — flagged 2026-09-03 — not on Deezer at all
      (`artist:"Tabby" track:"prequel"` → 0 hits; only `SEQUEL!` on *peachfuzz!*).
      Note this one still carries a stale preview URL in `timeline-data.json` that
      now 403s, so it does *not* show up in the null-preview sweep.
