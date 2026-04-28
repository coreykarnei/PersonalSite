# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal portfolio website for Corey Karnei, hosted on GitHub Pages at coreykarnei.com. The site showcases academic projects (ML/AI focus), photography, and personal bio.

## Architecture

**Main site**: Static HTML/CSS/JS with no build system. Pages are served directly by GitHub Pages.

- Pages: `index.html` (home), `academicprojects.html`, `photography.html`, `aboutme.html`, `smartbottle.html`, `elements.html` (template reference)
- Styling: `assets/css/main.css` (based on "Spatial" template by TEMPLATED, uses Raleway font and Font Awesome icons)
- JS framework: Skel.js for responsive breakpoints + jQuery for DOM manipulation (`assets/js/main.js`)
- Images: `images/` directory, photography in `images/photography/`

**Smart Bottle sub-app** (`smart-bottle-app/`): A standalone Create React App (React 17) project with a pre-built version in `smart-bottle-app/build/`. This is a separate academic project writeup page.

```bash
cd smart-bottle-app && npm install && npm start   # dev server on localhost:3000
cd smart-bottle-app && npm run build               # production build
cd smart-bottle-app && npm test                    # run tests
```

## Deployment

Deployed via GitHub Pages from the `master` branch. The `CNAME` file maps to `coreykarnei.com`. Any push to `master` triggers deployment — there is no CI/CD pipeline or build step for the main site.

## Key Details

- Navigation is shared across all main pages via duplicated HTML (no templating engine)
- The site uses Skel.js breakpoints: xlarge (1680px), large (1280px), medium (980px), small (736px), xsmall (480px)
- `smartbottle.html` is a stub page; the actual smart bottle content is the React app hosted separately
- PDFs (e.g., resume) are stored in `pdfs/`
