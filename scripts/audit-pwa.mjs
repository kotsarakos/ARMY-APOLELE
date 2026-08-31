import { chromium } from 'playwright-core'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const BASE = 'http://localhost:4173'
let fails = 0
const check = (l, ok, extra='') => { if(!ok) fails++; console.log(`${ok?'ok  ':'FAIL'} ${l}${extra?' — '+extra:''}`) }

const b = await chromium.launch({ executablePath: EXEC })
const ctx = await b.newContext()
const p = await ctx.newPage()
await p.goto(BASE + '/', { waitUntil:'networkidle' })

const man = await (await fetch(BASE + '/manifest.webmanifest')).json()
check('manifest: name', !!man.name)
check('manifest: short_name', !!man.short_name)
check('manifest: start_url', man.start_url === '/')
check('manifest: display standalone', man.display === 'standalone')
const sizes = man.icons.map(i => i.sizes)
check('manifest: εικονίδιο 192px', sizes.includes('192x192'), sizes.join(' '))
check('manifest: εικονίδιο 512px', sizes.includes('512x512'))
check('manifest: maskable', man.icons.some(i => i.purpose === 'maskable'))

for (const f of ['/icon-192.png','/icon-512.png','/icon-maskable-512.png','/apple-touch-icon.png','/sw.js']) {
  const r = await fetch(BASE + f)
  check(`υπάρχει ${f}`, r.ok, r.ok ? '' : String(r.status))
}
const at = await p.getAttribute('link[rel="apple-touch-icon"]','href')
check('apple-touch-icon είναι PNG (το iOS αγνοεί SVG)', !!at && at.endsWith('.png'), at ?? '')

await p.waitForTimeout(1800)
const sw = await p.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration()
  return { registered: !!r, active: !!r?.active, scope: r?.scope }
})
check('service worker καταχωρήθηκε', sw.registered, sw.scope ?? '')
check('service worker ενεργός', sw.active)

const cached = await p.evaluate(async () => {
  const keys = await caches.keys()
  if (!keys.length) return []
  const c = await caches.open(keys[0])
  return (await c.keys()).map(r => new URL(r.url).pathname)
})
check('έγινε precache του app shell', cached.includes('/'), cached.join(' '))

await ctx.setOffline(true)
const p2 = await ctx.newPage()
let offlineOk = true
try {
  await p2.goto(BASE + '/', { waitUntil:'domcontentloaded', timeout: 15000 })
  await p2.waitForTimeout(1500)
  // Το #root υπάρχει στο HTML αλλά είναι κενό μέχρι να τρέξει το React —
  // ελέγχουμε ότι όντως αποδόθηκε περιεχόμενο, όχι απλώς ότι φόρτωσε το HTML.
  offlineOk = await p2.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0)
} catch { offlineOk = false }
check('η εφαρμογή ανοίγει OFFLINE', offlineOk)
await ctx.setOffline(false)

const p3 = await (await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'el-GR' })).newPage()
await p3.goto(BASE + '/install', { waitUntil:'networkidle' })
check('η /install αποδίδει', await p3.isVisible('.ig__steps'))
check('έχει 3 καρτέλες πλατφόρμας', (await p3.$$('.ig__tab')).length === 3)
check('έχει 3 βήματα', (await p3.$$('.ig__step')).length === 3)
const first = await p3.textContent('.ig__h')
await p3.click('.ig__tab >> nth=1'); await p3.waitForTimeout(250)
const second = await p3.textContent('.ig__h')
check('η αλλαγή καρτέλας αλλάζει τα βήματα', first !== second, `${first} → ${second}`)
await p3.screenshot({ path:'/tmp/claude-1000/-home-kotsaras-army-app/826ac12f-be3d-4713-ac77-1b62fc73d73b/scratchpad/install.png' })

// ── Ο auto-εντοπισμός πλατφόρμας διαλέγει τη σωστή καρτέλα ─────────────
const UAS = [
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'IPHONE & IPAD'],
  ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 'ANDROID'],
  ['Desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'ΥΠΟΛΟΓΙΣΤΗΣ'],
]
for (const [label, ua, expect] of UAS) {
  const c = await b.newContext({ userAgent: ua, viewport:{width:390,height:844}, locale:'el-GR' })
  const pg = await c.newPage()
  await pg.goto(BASE + '/install', { waitUntil:'networkidle' })
  await pg.waitForTimeout(300)
  // Το κείμενο κεφαλαιοποιείται στη JS με τον ελληνικό κανόνα (upperGreek),
  // οπότε συγκρίνουμε με το ίδιο μετασχηματισμένο αναμενόμενο.
  const on = (await pg.textContent('.ig__tab--on'))?.trim()
  check(`auto-tab για ${label}`, on === expect, `${on}`)
  // Κάθε βήμα έχει τη δική του μικρογραφία.
  const mocks = (await pg.$$('.ig__step .mk')).length
  check(`${label}: 3 μικρογραφίες`, mocks === 3, String(mocks))
  // Ποτέ ΠΑΝΩ από ένα τονισμένο στοιχείο ανά μικρογραφία: δύο πορτοκαλί
  // σημεία σημαίνει ότι ο χρήστης δεν ξέρει πού να πατήσει. Το μηδέν είναι
  // αποδεκτό για βήματα που δείχνουν αποτέλεσμα αντί για ενέργεια.
  const per = await pg.evaluate(() =>
    [...document.querySelectorAll('.ig__step .mk')]
      .map(m => m.querySelectorAll('.mk__hi, .mk__ico--hi').length))
  check(`${label}: κανένα διφορούμενο βήμα`, per.every(n => n <= 1), per.join(','))
  check(`${label}: τουλάχιστον 2 βήματα με στόχο`, per.filter(n => n === 1).length >= 2, per.join(','))
  await c.close()
}

await b.close()
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails?1:0)
