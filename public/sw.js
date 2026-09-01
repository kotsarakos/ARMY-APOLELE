/*
 * Service worker — Army Apolele
 *
 * Υπάρχει για δύο λόγους:
 *  1. Χωρίς αυτόν το Chrome δεν πυροδοτεί ποτέ το `beforeinstallprompt`,
 *     άρα δεν υπάρχει εγκατάσταση σε Android.
 *  2. Η εφαρμογή είναι local-first — ο μετρητής δουλεύει από το localStorage —
 *     οπότε μπορεί κάλλιστα να ανοίγει και χωρίς δίκτυο.
 *
 * Στρατηγική: network-first για πλοήγηση (ώστε μια νέα έκδοση να φτάνει
 * αμέσως και να μην κολλάει ο χρήστης σε παλιό build), cache-first για τα
 * hashed assets (που δεν αλλάζουν ποτέ με το ίδιο όνομα).
 */

// Οι δύο γραμμές παρακάτω γράφονται κατά το build από το scripts/build-sw.mjs.
// Τα assets έχουν hash στο όνομα, οπότε ο service worker δεν μπορεί να τα
// μαντέψει — και χωρίς αυτά η εφαρμογή ανοίγει offline αλλά μένει λευκή.
const VERSION = '__BUILD_ID__'
const BUILD_ASSETS = [/* __ASSETS__ */]
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`

/*
 * ignoreVary είναι απαραίτητο, όχι προαιρετικό.
 *
 * Ο server στέλνει `Vary: Origin`. Το precache κατεβάζει τα αρχεία χωρίς
 * header `Origin`, ενώ ο Vite σημειώνει τα module scripts με `crossorigin`,
 * οπότε ο browser τα ζητά ΜΕ `Origin`. Χωρίς ignoreVary το caches.match
 * θεωρεί ότι δεν ταιριάζουν, δεν βρίσκει τίποτα, και η εφαρμογή ανοίγει
 * offline αλλά μένει λευκή — το HTML φορτώνει, JS και CSS όχι.
 */
const MATCH = { ignoreVary: true }

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/apple-touch-icon.png',
  ...BUILD_ASSETS,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

// Τα caches των ειδοποιήσεων δεν έχουν έκδοση στο όνομά τους και **δεν**
// πρέπει να καθαρίζονται: κρατούν το πρόγραμμα και ό,τι έχει ήδη σταλεί.
// Χωρίς αυτή την εξαίρεση, κάθε νέα έκδοση θα ξανάστελνε τις ίδιες ειδοποιήσεις.
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
  if (url.origin !== self.location.origin) return   // Google Fonts, Firebase κ.λπ.

  // Πλοήγηση: δίκτυο πρώτα, cache ως δίχτυ ασφαλείας.
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

  // Assets με hash στο όνομα: cache πρώτα.
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

/* ── Ειδοποιήσεις ─────────────────────────────────────────────────────────
 *
 * Ο browser δεν επιτρέπει σε web εφαρμογή να προγραμματίσει ειδοποίηση για
 * μελλοντική ώρα χωρίς διακομιστή. Το Periodic Background Sync είναι το
 * κοντινότερο: ο Chrome ξυπνά τον service worker περίπου μία φορά την ημέρα,
 * σε εγκατεστημένη PWA, και εμείς κοιτάμε τι ωρίμασε.
 *
 * Το «πρόγραμμα» το γράφει το κύριο νήμα στο Cache API — ο service worker δεν
 * βλέπει localStorage. Τα κείμενα είναι ήδη μεταφρασμένα μέσα του, οπότε εδώ
 * δεν χρειάζεται λεξικό. Βλ. src/lib/notify.ts.
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

  // Ο service worker κρατά δικό του σύνολο· το κύριο νήμα κρατά το δικό του
  // σε localStorage. Το `tag` εμποδίζει τη διπλή εμφάνιση αν συμπέσουν.
  const shown = new Set(await readJSON(SHOWN_CACHE, SHOWN_URL, []))
  const iso = todayISO()
  // Η ώρα που διάλεξε ο χρήστης ταξιδεύει μέσα στο πρόγραμμα: εδώ δεν υπάρχει
  // localStorage για να τη διαβάσουμε.
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
      // Αν η εφαρμογή είναι ήδη ανοιχτή, την εστιάζουμε αντί να ανοίξουμε δεύτερη.
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
