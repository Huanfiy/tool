# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open-source pure static personal website (huanfly.com) — no frameworks, no build step, no package manager. Vanilla HTML5 + CSS3 + JavaScript. All external libraries loaded via CDN.

## Commands

```bash
./run.sh test          # Start local Python HTTP server on port 8080
./run.sh test 3000     # Start on custom port
STUDIO_TERM_PASSWORD=… ./run.sh term [port]   # Optional: studio.html terminal bridge (WebSocket⇄PTY + CORS relay), 127.0.0.1:7681
DEPLOY_TARGET=... PUBLIC_BASE_URL=... ./run.sh deploy        # Deploy HEAD as a validated Git artifact
DEPLOY_TARGET=... PUBLIC_BASE_URL=... ./run.sh deploy <ref>  # Deploy a commit/ref, including a rollback target
```

No front-end framework or asset compilation step exists — the site is served as-is. Deployment still packages and validates an immutable Git artifact as described below.

Deploys never copy the working tree directly. `run.sh deploy` requires a clean worktree, builds the selected commit with `git archive`, writes `deploy-version.json`, validates the artifact, uses delayed rsync updates, and runs generic online smoke checks. `DEPLOY_TARGET` and `PUBLIC_BASE_URL` are required environment variables; `DEPLOY_REQUIRED_REF` optionally constrains eligible commits. Web-server, TLS, DNS, cache, authentication, and host-specific deployment configuration must remain outside this repository.

## Architecture

**Multi-page static site** with client-side rendering:

- `index.html` — Homepage with hero, time-aware greeting, entry cards, activity timeline
- `blog.html` — Blog system: article grid + Markdown detail view (toggles visibility); article head renders date/tag/word-count/reading-time + AI summary from front matter; giscus comments (disabled until `categoryId` is filled in `GISCUS_CONFIG`)
- `tool.html` — Tools hub with inline ICO converter + links to standalone tools
- `about.html` — Profile with timeline and interest cards
- `studio.html` — Full-viewport Three.js embedded-engineering studio with an illustrated, natural aesthetic: warm daylight, forest window, curved fabric curtains, an L-shaped wooden workbench, rug and coloured outlines. `js/studio-room.js` builds the room and devices; `js/studio-art.js` generates paper, wood, cloth and landscape textures locally using Canvas. Fixed meshes and outlines are batched; no external model, image or font assets are required for the scene. Three.js 0.170.0 and its OrbitControls / RoundedBoxGeometry / BufferGeometryUtils addons load through a pinned CDN import map. `js/studio.js` owns device state, on-demand DOM labels, an eight-stop tour, four main camera views plus a panorama in the device picker, day/night lighting, a breeze switch and keyboard / touch controls. Device interactions include MCU flashing and board explosion, oscilloscope wave / frequency controls, solder / extraction fan linkage, pausable layered printing, BLDC speed, robot pick-and-place and a plant with simulated soil-moisture feedback (linked to the flashed MCU's OLED). No cat character appears in the studio. `css/studio.css` provides standalone paper-style controls; `css/studio-apps.css` styles the HTML huanfly-os overlay. The computer retains Terminal (xterm.js via CDN → local bridge, with guest shell fallback), Album (`interests/*/index.json`) and Robot (OpenAI-compatible streaming chat, browser-local credentials, optional local `/relay/`). Entering the monitor moves the camera and opens an accessible HTML dialog. The room targets 30 fps at rest, up to 60 fps during camera/device activity, caches static shadows, respects reduced motion and stops rendering while the computer is open or the tab is hidden. If Three.js or WebGL fails, the computer entry remains usable. `window.Studio` exposes device actions and rendering counters for the guest terminal and diagnostics.
- `server/studio-bridge.py` — Dev-only, stdlib-only WebSocket⇄PTY bridge (`./run.sh term`): binds 127.0.0.1, requires `STUDIO_TERM_PASSWORD`, Origin allow-list, auth throttling; `export-ignore`d so it never ships in deploy artifacts.
- `tools/` — Standalone tool pages (keyboard practice, link converter)
- `posts/*.md` — Blog articles fetched and parsed client-side with Marked.js; front matter supports `title/date/tag/summary/cover/coverFit/publish/ai_summary` (`ai_summary` is read by blog.html only, ignored by `run.sh gen`)
- `activity.json` — Site/tool events merged with posts.json into homepage activity timeline (types: `post`/`tool`/`site`)
- `css/style.css` — Single unified stylesheet with CSS custom properties for theming
- `js/script.js` — Shared functionality (mobile nav, theme toggle, greeting, activity timeline, busuanzi stats, scroll-reveal via IntersectionObserver)
- `manifest.webmanifest`, `robots.txt`, `sitemap.xml` — PWA + SEO; the four primary pages carry OG meta and canonical URLs

**Key pattern:** Pages use view switching — JavaScript toggles between list view and detail view within the same page (blog article list ↔ article content, tool grid ↔ tool interface).

**Footer stats:** busuanzi (不蒜子) UV/PV counters, hidden until values load (`#site-stats` + `.visible`). Counts on localhost are shared global test numbers; real counts start on the production domain.

**Design theme:** Hand-drawn storybook style inspired by "Luo Xiaohei" (罗小黑). Warm paper background with grain overlay; dark mode = "night forest". Primary: forest green `#5da844`, accent: spirit teal `#4fc4cf`. Signature elements: wobble border-radius (`--wobble-*` vars), ink outlines with offset shadows, squiggle SVG underlines, hero hills + animated black cat SVG (index.html), ambient firefly canvas + click spirit-burst (js/script.js). Standalone pages in `tools/` still consume legacy aliases from style.css (`--border-color`, `--radius-lg/md`, `.tool-icon`) — keep them.

**CDN dependencies:** Three.js 0.170.0 + addons (studio only, ES-module import map), Marked.js 4.0.12, Font Awesome 6.4.0, LXGW WenKai Screen webfont (jsDelivr, non-blocking `media="print"` swap), busuanzi, giscus (optional), xterm.js 5.3.0 + xterm-addon-fit 0.8.0 (lazy-loaded by studio.html only when the Terminal app opens). Entrance animations are self-hosted: `.rise-in` (CSS keyframes, plays at first paint) and `[data-reveal]` (IntersectionObserver in js/script.js adds `.revealed`; hidden only under `html.js`, set by the inline head script).

## Git Commit Convention

Format: `<type>(<scope>): <subject>` — English, single line, scope optional.

Types: `feat`, `fix`, `perf`, `refactor`, `chore`, `docs`

Breaking changes: `feat!: ...` with `BREAKING CHANGE:` in body.

Principles: single responsibility per commit, each commit must be independently deployable.
