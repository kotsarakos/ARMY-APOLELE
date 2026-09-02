/*
 * Service worker — Army Apolele
 *
 * It exists for two reasons:
 *  1. Without it Chrome never fires `beforeinstallprompt`, so there is no way
 *     to install on Android.
 *  2. The app is local-first — the counter runs off localStorage — so it may
 *     as well open with no network at all.
 *
 * Strategy: network-first for navigation, so a new version arrives at once and
 * nobody is stranded on an old build; cache-first for hashed assets, which
 * never change under the same name.
 */

// The two lines below are written at build time by scripts/build-sw.mjs.
// Assets carry a hash in their name, so the service worker cannot guess them —
// and without them the app opens offline but stays blank.
const VERSION = '__BUILD_ID__'
const BUILD_ASSETS = [/* __ASSETS__ */]
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`

/*
 * ignoreVary is required, not optional.
 *
 * The server sends `Vary: Origin`. The precache fetches files without an
 * `Origin` header, while Vite marks module scripts `crossorigin`, so the
 * browser requests them WITH one. Without ignoreVary, caches.match decides
 * they do not match, finds nothing, and the app opens offline but stays blank
 * — the HTML loads, the JS and CSS do not.
 */
const MATCH = { ignoreVary: true }

// The Greek and Latin subsets, which every screen of this app needs. The
// latin-ext files are left out on purpose: nothing the app writes reaches that
// range — only a name or a unit somebody types — so they are fetched on demand
// and cached by the handler below like any other same-origin asset.
const FONTS = [
  '/fonts/roboto-condensed-v31-greek.woff2',
  '/fonts/roboto-condensed-v31-latin.woff2',
  '/fonts/roboto-mono-v31-greek.woff2',
  '/fonts/roboto-mono-v31-latin.woff2',
]

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/apple-touch-icon.png',
  ...FONTS,
  ...BUILD_ASSETS,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

// The notification caches have no version in their names and must **not** be
// cleared: they hold the plan and everything already sent. Without this
// exception, every new release would fire the same notifications again.
const KEEP = ['army-notify-plan', 'army-notify-shown']

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL && k !== ASSETS && !KEEP.includes(k))
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return   // Google Fonts, Firebase, etc.

  // Navigation: network first, cache as the safety net.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/', MATCH).then((r) => r ?? caches.match(request, MATCH))),
    )
    return
  }

  // Assets with a hash in the name: cache first.
  event.respondWith(
    caches.match(request, MATCH).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone()
        caches.open(ASSETS).then((c) => c.put(request, copy))
      }
      return res
    })),
  )
})

/* ── Notifications ────────────────────────────────────────────────────────
 *
 * A browser will not let a web app schedule a notification for a future time
 * without a server. Periodic Background Sync is the closest thing: Chrome
 * wakes the service worker roughly once a day, in an installed PWA, and we
 * look at what has come due.
 *
 * The "plan" is written by the main thread into the Cache API — the service
 * worker cannot see localStorage. Its text is already translated, so no
 * dictionary is needed here. See src/lib/notify.ts.
 */

const PLAN_CACHE = 'army-notify-plan'
const PLAN_URL = '/__notify-plan'
const SHOWN_CACHE = 'army-notify-shown'
const SHOWN_URL = '/__notify-shown'

function todayISO() {
  const n = new Date()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${m}-${d}`
}

async function readJSON(cacheName, url, fallback) {
  try {
    const cache = await caches.open(cacheName)
    const res = await cache.match(url)
    return res ? await res.json() : fallback
  } catch {
    return fallback
  }
}

async function writeJSON(cacheName, url, value) {
  const cache = await caches.open(cacheName)
  await cache.put(url, new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
  }))
}

async function showDue() {
  const plan = await readJSON(PLAN_CACHE, PLAN_URL, null)
  if (!plan || !Array.isArray(plan.items)) return

  // The service worker keeps its own set; the main thread keeps one in
  // localStorage. The `tag` prevents a double showing if they overlap.
  const shown = new Set(await readJSON(SHOWN_CACHE, SHOWN_URL, []))
  const iso = todayISO()
  // The chosen hour travels inside the plan: there is no localStorage here to
  // read it from.
  const hour = Number.isInteger(plan.hour) ? plan.hour : 20
  const clock = new Date().getHours()
  let changed = false

  for (const item of plan.items) {
    if (item.date > iso || shown.has(item.id)) continue
    if (item.date === iso && clock < hour) continue
    await self.registration.showNotification(item.title, {
      body: item.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: item.id,
      data: { url: '/' },
    })
    shown.add(item.id)
    changed = true
  }

  if (changed) await writeJSON(SHOWN_CACHE, SHOWN_URL, [...shown].slice(-200))
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'army-daily') event.waitUntil(showDue())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If the app is already open, focus it rather than opening a second one.
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
