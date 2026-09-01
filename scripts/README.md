# Browser audits

These run a production build in headless Chromium through `playwright-core`, so
they catch the class of bug that unit tests cannot see: layout that overflows,
fonts that fall back silently, a service worker that fails to serve offline.

```bash
npm run build
npx vite preview --port 4173 &   # the suites target :4173
npm run audit
```

| Script | What it checks |
|---|---|
| `audit-mobile.mjs` | Horizontal overflow at 320/360/390/414/768px on every screen, input font size ≥16px (below that iOS Safari zooms on focus), tap targets ≥44px |
| `audit-functional.mjs` | Language detection and switching, meta title and description updates, success and error messaging, data persistence across reloads, leave and duty entry with validation, recurring charges, expense editing, the monthly calendar and the milestone timeline, the spending limit, undo on deletion, posting history, home-screen shortcut URLs, 404 and privacy routes, zoom lock |
| `audit-fonts.mjs` | That the display and mono typefaces actually cover **Greek** glyphs rather than falling back silently |
| `audit-pwa.mjs` | Manifest fields, icon sizes including maskable, a PNG apple-touch-icon (iOS ignores SVG), service worker registration and activation, app shell precaching, and that the app **opens with the network down** |
| `audit-extras.mjs` | The notification plan written to the Cache API, its translation following the UI language, the toggle and the chosen hour persisting per device, the light/dark theme surviving a reload with the tokens actually redefined, share-card PNG generation, the JSON backup and `.ics` calendar downloads, and the announcements section — including that it still renders when the live file is missing |
| `audit-legacy.mjs` | That a profile written by an **older version** — missing whole collections — still opens, renders every tab and migrates rather than crashing |
| `audit-scroll.mjs` | That every screen scrolls with a mouse wheel at desktop window sizes, including short ones |

## Why some of these exist

**Fonts.** A silent fallback breaks nothing — it just renders Greek headings in a
typeface nobody chose. Oswald and IBM Plex Mono both fell into this trap before
being replaced. Note that `document.fonts.check()` does not verify glyph coverage
and `measureText` does not trigger loading; only `document.fonts.load()` gives an
honest answer, which is what this suite uses.

**Offline.** The first version of this check asserted that `#root` was visible,
which was true even when the page was blank. The real bug it eventually caught:
Firebase Hosting sends `Vary: Origin` while Vite marks module scripts
`crossorigin`, so `caches.match` missed every asset and the app opened offline to
a white screen. Hence `{ ignoreVary: true }` in the service worker.

**Tap targets.** Measurement has caught undersized controls four separate times,
including ones added while fixing the previous three.

**Old profiles.** Unit-test fixtures are always built from the current
`DEFAULT_PROFILE`, so they can never catch the bug where a field added this week is
read from a profile saved last month. That bug does not produce a broken screen; it
produces a white one, for somebody who did nothing wrong. This suite loads the
shapes previous releases actually wrote.

**The announcements parser.** Its input is somebody else's Drupal install with
debug output left on, so the fixture test is the only thing standing between a new
notice and a screenful of `.twig` paths. It runs against a saved copy of the feed,
not the network: the point is to catch our parser breaking, not their site being
down. A live failure surfaces in the scheduled job instead.

**Themes.** A colour defined only inside a `prefers-color-scheme` block does not
exist in the other theme, and nothing in the build catches it. The suite reads the
computed `--ink` after switching, so a token that failed to redefine shows up as a
value rather than as a screenshot somebody has to look at.

## Other scripts

| Script | Purpose |
|---|---|
| `gen-icons.mjs` | Renders `public/icon-*.png` from the SVG sources in `design/logos/` |
| `build-sw.mjs` | Injects the hashed asset list and a build id into `dist/sw.js` after each build |
| `fetch-announcements.mjs` | Downloads the recruitment service's RSS into `public/announcements.json`. Run daily by [`.github/workflows/announcements.yml`](../.github/workflows/announcements.yml); `--selftest` runs the parser against a saved feed instead of the network, and is part of `npm test` |

If `chromium-1148` is not present locally: `npx playwright install chromium`.
