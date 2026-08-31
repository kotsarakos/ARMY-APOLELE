/**
 * Έλεγχος για ό,τι δεν πιάνουν τα άλλα audits: πρόγραμμα ειδοποιήσεων,
 * σήμα στο εικονίδιο, κάρτα κοινοποίησης, αντίγραφο ασφαλείας.
 *
 * Τρέχει σε πραγματικό Chromium με χορηγημένο δικαίωμα ειδοποιήσεων, γιατί
 * τίποτε από αυτά δεν μπορεί να επαληθευτεί σε Node.
 */
import { chromium } from 'playwright-core'

const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const BASE = 'http://localhost:4173'

let fails = 0
const check = (label, ok, extra = '') => {
  if (!ok) fails++
  console.log(ok ? `ok   ${label}${extra ? ' — ' + extra : ''}` : `FAIL ${label} — ${extra}`)
}

const browser = await chromium.launch({ executablePath: EXEC })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  permissions: ['notifications'],
  locale: 'el-GR',
  acceptDownloads: true,
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(BASE, { waitUntil: 'networkidle' })
const skip = await page.$('.welcome__skip .btn')
if (skip) { await skip.click(); await page.waitForSelector('.esso') }
await page.click('.esso')
await page.click('.btn--primary')
await page.waitForSelector('.clock__num')

/* ── Πρόγραμμα ειδοποιήσεων ─────────────────────────────────────────────── */

// Το κύριο νήμα το γράφει στο Cache API, ώστε να το βρει και ο service worker.
const plan = await page.evaluate(async () => {
  const cache = await caches.open('army-notify-plan')
  const res = await cache.match('/__notify-plan')
  return res ? await res.json() : null
})
check('το πρόγραμμα ειδοποιήσεων γράφτηκε στο cache', plan !== null)
check('έχει γεγονότα', plan?.items?.length > 0, `${plan?.items?.length}`)
check('κάθε γεγονός έχει ημερομηνία και κείμενο',
  plan?.items?.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date) && i.title && i.body))
check('περιέχει την απόλυση', plan?.items?.some((i) => i.id === 'dis-0'))
check('badge = μέρες που μένουν', typeof plan?.badge === 'number' && plan.badge > 0, `${plan?.badge}`)
check('τα κείμενα είναι στα ελληνικά',
  plan?.items?.some((i) => /[Α-Ωα-ω]/.test(i.title)),
  plan?.items?.[0]?.title)

// Αλλαγή γλώσσας: το πρόγραμμα ξαναγράφεται μεταφρασμένο.
await page.click('.langsw__b >> nth=1')
await page.waitForTimeout(600)
const planEn = await page.evaluate(async () => {
  const cache = await caches.open('army-notify-plan')
  return (await (await cache.match('/__notify-plan')).json())
})
check('το πρόγραμμα ακολουθεί τη γλώσσα',
  planEn.items.every((i) => !/[Α-Ωα-ω]/.test(i.title)), planEn.items[0]?.title)
check('ίδιο πλήθος γεγονότων και στις δύο γλώσσες',
  planEn.items.length === plan.items.length)

/* ── Διακόπτης ειδοποιήσεων ─────────────────────────────────────────────── */

await page.click('[data-tab="profile"]')
await page.waitForSelector('.nt')
check('ο πίνακας ειδοποιήσεων εμφανίζεται', await page.isVisible('.nt'))
check('ξεκινά ανενεργός', (await page.textContent('.nt__state')).trim() === 'Off')
await page.click('.nt .btn--secondary')
await page.waitForTimeout(500)
check('ενεργοποιείται', (await page.textContent('.nt__state')).trim() === 'On')
check('η προτίμηση αποθηκεύεται ανά συσκευή',
  await page.evaluate(() => localStorage.getItem('army_app.notify.enabled.v1')) === '1')
await page.reload({ waitUntil: 'networkidle' })
await page.click('[data-tab="profile"]')
await page.waitForSelector('.nt')
check('παραμένει ενεργός μετά από reload',
  (await page.textContent('.nt__state')).trim() === 'On')

/* ── Κάρτα κοινοποίησης ─────────────────────────────────────────────────── */

await page.click('[data-tab="clock"]')
await page.waitForSelector('.sh')
// Πατάμε το κουμπί και επιβεβαιώνουμε ότι παράγεται πραγματικό PNG. Το Web
// Share με αρχεία δεν υπάρχει σε desktop Chromium, οπότε πέφτει στο download —
// που είναι ακριβώς το μονοπάτι που θέλουμε να ελέγξουμε εδώ.
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
  page.click('.sh .btn'),
])
check('η κάρτα παράγει αρχείο', download !== null)
if (download) {
  check('είναι PNG', download.suggestedFilename().endsWith('.png'),
    download.suggestedFilename())
}
await page.waitForTimeout(500)

/* ── Αντίγραφο ασφαλείας ────────────────────────────────────────────────── */

await page.click('[data-tab="profile"]')
const [backup] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
  page.click('.set__databtns .btn >> nth=0'),
])
check('το αντίγραφο κατεβαίνει', backup !== null)
if (backup) {
  check('είναι JSON με σωστό όνομα',
    /^army-apolele-\d{4}-\d{2}-\d{2}\.json$/.test(backup.suggestedFilename()),
    backup.suggestedFilename())
}

check('χωρίς σφάλματα κονσόλας', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails ? 1 : 0)
