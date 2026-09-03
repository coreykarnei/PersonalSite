# Audio Architecture Research — Music Timeline

_Researched 2026-07-30. Vendor terms/facts verified against official docs at that time; re-verify before building._

## Bottom line
- **Shippable today:** arbitrary sub-section **within a 30s preview** (Deezer/iTunes), not arbitrary sub-section of the full song.
- A fixed vendor preview is a real 30s of audio you can trim to any in/out **inside that window** — covers most "hook" moments.
- **Arbitrary position in the FULL song** requires either (a) audio you own/license, or (b) live Spotify **Premium** full-track playback (per-visitor login, DRM, no clip storage).
- **No legal path** to self-hosting trimmed clips of full commercial tracks you don't own.

## Sources for audio
| Source | Auth | What you get | Arbitrary sub-section? | Self-host a trim? |
|---|---|---|---|---|
| iTunes/Apple Search API | none | fixed ~30s AAC preview | only within 30s | **No** (terms: stream-only, no caching) |
| Deezer API | none | fixed 30s MP3 (`preview`) | only within 30s | Grey area, non-commercial only |
| Spotify `preview_url` | client creds | **removed Nov 2024** | — | — |
| Spotify Web Playback SDK | user OAuth + **Premium** | full track, DRM/EME | **Yes — seek any ms** | No storage (DRM) |
| YouTube IFrame API | api key | full video, start/end params | Yes (video) | **No** (no audio isolation) |
| MusicBrainz | none | metadata only, **no audio** | — | — |
| Own / license / CC audio | — | full track you control | **Yes — any in/out** | **Yes** |

Key notes:
- **Apple**: previews must be streamed live, shown near a "Download on iTunes" badge + "provided courtesy of iTunes", and **not cached**. Don't self-host Apple audio.
- **Deezer**: `https://api.deezer.com/search?q=<query>` → each track has a direct 30s `preview` MP3 URL. Terms cap at 30s, non-commercial, don't expose full tracks; caching a trimmed 30s is a grey area (low risk for a personal site, not blessed).
- **Spotify SDK**: only sanctioned "arbitrary position in full song" via a vendor, but Premium + login wall makes it a poor default for public visitors. Good optional upgrade.
- **YouTube**: policy forbids isolating/ripping audio; usable only as a "listen on YouTube" link-out.

## Storage (if self-hosting clips — legal for owned/licensed/CC; grey for Deezer)
- Codec: **AAC 128k `.m4a`** baseline (broadest support); optional **Opus 96k** for size.
- ~30s clip ≈ 360–480 KB. **~150 clips ≈ 55–75 MB total.** Trivial.
- Accurate trim (re-encode, not stream-copy):
  ```bash
  ffmpeg -accurate_seek -ss 72.0 -to 94.0 -i input.m4a \
    -c:a aac -b:a 128k -movflags +faststart \
    -af "afade=t=in:st=72:d=0.03,afade=t=out:st=93.75:d=0.25" clip_albumXX.m4a
  ```
- Manifest per clip: `{ albumId, trackId, sourceUrl, sourceType, inPointSec, outPointSec, clipFile, license, attribution, purchaseUrl }`. Keep `sourceUrl`+in/out even when self-hosting so clips can be re-cut.
- Alternative (no audio bytes): store just `{ trackId, sourceUrl, startSec, endSec }` and seek the streamed source at play time (required for Apple).

## Serving & playback
- Static hosting (Cloudflare Pages/Netlify/S3+CDN), same origin as the app to avoid CORS.
- Immutable cache: `Cache-Control: public, max-age=31536000, immutable`, cache-bust by filename.
- Pre-trimmed clips sidestep HTTP range-request complexity (whole clip is one small request). Range/`206` only matters if seeking into long files.
- Play with a plain `<audio>` element; a pre-trimmed clip just plays from 0. To play `[start,end]` of a longer source: set `currentTime=start`, stop on `timeupdate>=end` **plus** a `setTimeout` backup; bake a fade-out into the encode.
- **Autoplay policy** (constrains hover-to-play): browsers block audible playback before a user gesture; `play()` rejects — always `.catch()`. Design so the **first sound is on a click**, then hover-to-play works for the rest of the session.

## Recommended architecture (phased)
- **Phase A (ship now):** self-hosted pre-trimmed clips. Source 30s previews from **Deezer** (fallback iTunes *streamed* w/ badge). Build a tiny scrub tool to pick in/out within the 30s. Trim to AAC 128k with ffmpeg. Serve as static, same-origin. First sound on click, then hover-to-play.
  - Cleanest if clips come from **owned/licensed/CC** audio → then you also get true arbitrary in/out across the whole song immediately.
  - Deezer previews → grey but low-risk for personal/non-commercial; document it.
  - Apple → stream only, never store.
- **Phase B (the "any moment of the full song" dream):** either own/license the recordings (collapses into Phase A with full-song freedom), or layer Spotify Premium SDK playback as an optional "log in to hear the full track at my moment."

_Legal note: this is a summary of vendor terms, not formal legal advice. The clear rules (Apple no-cache; Spotify preview_url gone; YouTube no audio isolation; can't publicly serve full commercial tracks you don't own) are well-supported; Deezer self-hosting is a genuine grey area._
