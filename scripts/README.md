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
| `audit-functional.mjs` | Language detection and switching, meta title and description updates, success and error messaging, data persistence across reloads, leave and duty entry with validation, recurring charges, expense editing, 404 and privacy routes, zoom lock |
| `audit-fonts.mjs` | That the display and mono typefaces actually cover **Greek** glyphs rather than falling back silently |
| `audit-pwa.mjs` | Manifest fields, icon sizes including maskable, a PNG apple-touch-icon (iOS ignores SVG), service worker registration and activation, app shell precaching, and that the app **opens with the network down** |
| `audit-extras.mjs` | The notification plan written to the Cache API, its translation following the UI language, the notification toggle persisting per device, share-card PNG generation and JSON backup download |
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

**Tap targets.** Measurement has caught undersized controls three separate times,
including ones added while fixing the previous two.

## Other scripts

| Script | Purpose |
|---|---|
| `gen-icons.mjs` | Renders `public/icon-*.png` from the SVG sources in `design/logos/` |
| `build-sw.mjs` | Injects the hashed asset list and a build id into `dist/sw.js` after each build |

If `chromium-1148` is not present locally: `npx playwright install chromium`.
