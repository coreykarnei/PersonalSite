# music-timeline (parked — to be integrated later)

Standalone React + Vite visualization, **"A Life in Music"** — album covers scattered
across a horizontal, scrollable time axis (2010→now). Covers are sized by local temporal
density (lone releases become large heroes; busy months shrink into a collage) and tinted
by genre. Click a cover to stream its Deezer preview and loop a draggable in/out snippet
window; hover for a tooltip.

This folder is **stored here for safekeeping, not yet wired into the Astro site.** It is a
self-contained project with its own `package.json` and dev server — the surrounding Astro
build ignores it.

## Run it standalone

```bash
cd music-timeline
npm install
npm run dev      # Vite dev server on http://127.0.0.1:5188
npm run shot     # puppeteer screenshot harness -> shots/
```

## Layout

- `src/MusicTimeline.jsx` — the whole component: density-based layout + audio/snippet picker
- `src/data.js` — 132 albums, 2010–2025 (still the **auto-generated sample arc**; header
  notes it should be replaced with real music history). 4 tracks lack previews.
- `src/timeline.css` — styling
- `public/covers/` — 125 album cover images
- `scripts/` — cover/preview fetchers (Deezer) + puppeteer screenshotter
- `docs/audio-research.md` — notes on the audio-preview approach
- `shots/` — reference screenshots of the intended look

## Integration notes (for later)

- The component is framework-agnostic React; it can be mounted in Astro via an island
  (`client:only="react"`) or ported to the site's existing R3F/React setup.
- Cover images and Deezer preview URLs are the main assets to carry over. Deezer preview
  URLs are time-signed and will expire — expect to re-fetch via `scripts/fetch-deezer.mjs`.
