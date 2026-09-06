# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open-source pure static personal website (huanfly.com) — no front-end frameworks, build step, package manager or application backend. Vanilla HTML5 + CSS3 + JavaScript, CDN front-end libraries. Robot is only a static “研究中” placeholder; no chat, configuration or API integration is implemented. Every terminal is a browser-only simulation: never add a shell, PTY, terminal socket or command-execution endpoint.

## Commands

```bash
./run.sh test          # Start local Python HTTP server on port 8080
./run.sh test 3000     # Start on custom port
node --test tests/studio-guest.test.js
DEPLOY_TARGET=... PUBLIC_BASE_URL=... ./run.sh deploy        # Deploy HEAD as a validated Git artifact
DEPLOY_TARGET=... PUBLIC_BASE_URL=... ./run.sh deploy <ref>  # Deploy a commit/ref, including a rollback target
```

Browser contract tests: start the local server and open `tests/studio-outdoor.html`. They use the existing pinned Three.js CDN, require no package manager, and are excluded from deploy artifacts. Viewport/interaction evidence and remaining real-device acceptance are recorded in `docs/testing/studio-continuous-outdoor.md`. Software rendering and mobile viewport emulation are not hardware performance acceptance.

No front-end framework or asset compilation step exists — the site is served as-is. Deployment still packages and validates an immutable Git artifact as described below.

Deploys never copy the working tree directly. `run.sh deploy` requires a clean worktree, builds the selected commit with `git archive`, writes `deploy-version.json`, validates the artifact, uses delayed rsync updates, and runs generic online smoke checks. `DEPLOY_TARGET` and `PUBLIC_BASE_URL` are required environment variables; `DEPLOY_REQUIRED_REF` optionally constrains eligible commits. Web-server, TLS, DNS, cache, credentials, and host-specific deployment configuration must remain outside this repository. Research plans under `agents/plans/` are versioned but excluded from static artifacts. The general Server plan is paused, not an implementation instruction.

## Architecture

Studio layout, object placement and direct monitor interaction constraints are recorded in [design/workbench.md](design/workbench.md).

**Multi-page static site** with client-side rendering:

- `index.html` — Homepage with hero, time-aware greeting, entry cards, activity timeline
- `blog.html` — Blog system: article grid + Markdown detail view (toggles visibility); article head renders date/tag/word-count/reading-time + AI summary from front matter; giscus comments (disabled until `categoryId` is filled in `GISCUS_CONFIG`)
- `tool.html` — Tools hub with inline ICO converter + links to standalone tools
- `about.html` — Profile with timeline and interest cards
- `studio.html` — Full-viewport Three.js embedded-engineering studio with an illustrated aesthetic. `js/studio-room.js` builds the bounded room, rear-supported L-shaped workbench, floor-standing printer and devices; `js/studio-art.js` generates paper, wood, cloth and sunlight textures. `js/studio-figures.js` builds three anime shelf sculptures. `js/studio-window.js` owns only the outward-opening casements, glass and click area. Its sibling `js/studio-landscape.js` owns the nearly level courtyard, wall-foot stone, continuous coarse far ground, closed world-fixed sky, instanced orchard/flowers/grass and separate cloud/bird meshes. `js/studio-landscape-art.js` deterministically paints static day/night panoramas, only on theme or quality changes. Real walls provide exterior depth occlusion; no window-aperture shader remains. World-space ground feathering matches paper after output conversion. Room owns layout/palette, the shared clock, smoothed window wind, and background radius/far-plane coverage derived from the allowed camera targets and orbit distances. Opaque scenery blocks picking without becoming a window/device action. Fixed meshes and outlines are batched. Three.js 0.170.0 and its addons load through a pinned CDN import map. `js/studio-monitor.js` mounts the existing HTML huanfly-os on a CSS3D plane, with a depth-tested transparent aperture in the WebGL canvas; native clicks, input, selection and scrolling work directly on the physical monitor. OrbitControls use a sibling gesture surface so they do not intercept screen touches. Moving closer only moves the camera and preserves app state. `js/studio.js` owns device state, on-demand labels, an eight-stop tour, camera presets, day/night lighting, window/breeze state and keyboard controls. Devices include MCU flashing and board explosion, oscilloscope wave/frequency controls, solder/extraction linkage, layered printing, BLDC speed, robot pick-and-place and simulated soil moisture linked to the MCU OLED. `css/studio.css` styles room controls; `css/studio-apps.css` styles Terminal (xterm.js via CDN, exclusively browser-simulated commands in `js/studio-guest.js`), Album (`interests/*/index.json`) and the static Robot research placeholder in `studio.html` (no dedicated script, API requests or chat storage). The room targets 30 fps at rest and up to 60 fps during activity, caches static shadows, respects reduced motion and stops rendering when the tab is hidden. Devices continue running while the computer is in use. Screen pointer, click and wheel guards also respect opaque foreground objects. Room and child modules use idempotent ownership-aware cleanup, including cached geometry detached by batching and partially failed initialization. A standalone accessible HTML desktop remains available if Three.js or WebGL fails. `window.Studio` exposes actions and rendering counters for the guest terminal and diagnostics.
- `tools/` — Standalone tool pages (keyboard practice, link converter).
- `tests/studio-guest.test.js` + `tests/studio-apps-browser.cjs` — Simulated-terminal contracts and optional Chromium regression for the monitor, album and static Robot placeholder. The browser suite uses a temporary standard-library static server; no application backend or real API credentials.
- `agents/plans/2026-09-06-general-server.md` — Paused research plan. Its former Robot backend baseline has been removed; reassess the code before any future implementation, and do not resume without a new request.
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
