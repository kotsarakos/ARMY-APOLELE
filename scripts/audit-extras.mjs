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
// Το κείμενο ενός σφάλματος δικτύου δεν περιέχει τη διεύθυνση — μόνο το
// `location()` την ξέρει. Χωρίς αυτή δεν μπορούμε να ξεχωρίσουμε ένα
// αναμενόμενο 404 από πραγματικό σφάλμα.
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const at = m.location()?.url
  errors.push(at ? `${m.text()} @ ${at}` : m.text())
})

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


/* ── Εξαγωγή σε ημερολόγιο (.ics) ───────────────────────────────────────── */

const [ics] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
  page.click('.set__databtns .btn >> nth=2'),
])
check('το αρχείο ημερολογίου κατεβαίνει', ics !== null)
if (ics) {
  check('είναι .ics με σωστό όνομα',
    /^army-apolele-\d{4}-\d{2}-\d{2}\.ics$/.test(ics.suggestedFilename()),
    ics.suggestedFilename())
  const stream = await ics.createReadStream()
  let text = ''
  for await (const chunk of stream) text += chunk
  check('είναι έγκυρο VCALENDAR',
    text.startsWith('BEGIN:VCALENDAR') && text.trimEnd().endsWith('END:VCALENDAR'))
  check('περιέχει την απόλυση ως γεγονός', /UID:discharge-/.test(text))
  check('χρησιμοποιεί CRLF όπως ορίζει το RFC 5545',
    text.includes('\r\n') && !/[^\r]\n/.test(text))
  check('καμία γραμμή πάνω από 75 οκτάδες',
    text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75))
}

/* ── Θέμα εμφάνισης ─────────────────────────────────────────────────────── */

// Χωρίς ρητή επιλογή δεν μπαίνει `data-theme`: δουλεύει το prefers-color-scheme.
check('χωρίς επιλογή το θέμα ακολουθεί τη συσκευή',
  (await page.getAttribute('html', 'data-theme')) === null)

await page.click('.seg__b >> nth=1')          // Φωτεινό
await page.waitForTimeout(150)
check('η ρητή επιλογή γράφεται στο <html>',
  (await page.getAttribute('html', 'data-theme')) === 'light')
check('ο καμβάς άλλαξε πραγματικά χρώμα',
  (await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    === 'rgb(251, 251, 249)')
check('συγχρονίζεται και το theme-color της μπάρας',
  (await page.getAttribute('meta[name=theme-color]', 'content')) === '#FBFBF9')

// Το κείμενο πρέπει να μένει αναγνώσιμο: αν κάποιο χρώμα οριζόταν μόνο μέσα
// στο σκοτεινό μπλοκ, εδώ θα έβγαινε σχεδόν λευκό πάνω σε λευκό.
const inkLight = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--ink').trim())
check('τα tokens του κειμένου ξαναορίστηκαν', inkLight === '#14161A', inkLight)

await page.reload({ waitUntil: 'domcontentloaded' })
check('το θέμα επιβιώνει του reload χωρίς αναλαμπή',
  (await page.getAttribute('html', 'data-theme')) === 'light')

await page.click('[data-tab="profile"]')
await page.click('.seg__b >> nth=0')          // Αυτόματο
await page.waitForTimeout(150)
check('η επιστροφή στο αυτόματο αφαιρεί το data-theme',
  (await page.getAttribute('html', 'data-theme')) === null)

/* ── Ώρα ειδοποιήσεων ───────────────────────────────────────────────────── */

check('η ώρα εμφανίζεται μόνο όταν είναι ενεργές', await page.isVisible('.nt__hour'))
await page.selectOption('.nt__hour select', '9')
await page.waitForTimeout(200)
check('η ώρα αποθηκεύεται ανά συσκευή',
  (await page.evaluate(() => localStorage.getItem('army_app.notify.hour.v1'))) === '9')

// Ο service worker δεν βλέπει localStorage, οπότε η ώρα πρέπει να ταξιδεύει
// μέσα στο ίδιο το πρόγραμμα.
const planWithHour = await page.evaluate(async () => {
  const cache = await caches.open('army-notify-plan')
  const res = await cache.match('/__notify-plan')
  return res ? await res.json() : null
})
check('η ώρα μπαίνει στο πρόγραμμα για τον service worker',
  planWithHour?.hour === 9, String(planWithHour?.hour))


/* ── Ανακοινώσεις στρατολογίας ──────────────────────────────────────────── */

await page.click('[data-tab="profile"]')
await page.waitForSelector('.nw')
check('η ενότητα ανακοινώσεων εμφανίζεται', await page.isVisible('.nw'))
await page.waitForTimeout(800)

const news = await page.evaluate(() => [...document.querySelectorAll('.nw__item')].map((li) => ({
  title: li.querySelector('.nw__title')?.textContent?.trim() ?? '',
  href: li.querySelector('.nw__title')?.getAttribute('href') ?? '',
  target: li.querySelector('.nw__title')?.getAttribute('target') ?? '',
  rel: li.querySelector('.nw__title')?.getAttribute('rel') ?? '',
  summary: li.querySelector('.nw__sum')?.textContent?.trim() ?? '',
})))
check('διαβάστηκαν ανακοινώσεις από το αρχείο του build', news.length > 0, `${news.length}`)
check('κάθε τίτλος δείχνει στην επίσημη σελίδα',
  news.every((n) => n.href.startsWith('https://www.stratologia.gr/')))
// `noopener` δεν είναι τελετουργικό: χωρίς αυτό η σελίδα που ανοίγει αποκτά
// `window.opener` και μπορεί να αλλάξει τη διεύθυνση της δικής μας καρτέλας.
check('οι εξωτερικοί σύνδεσμοι ανοίγουν ασφαλώς',
  news.every((n) => n.target === '_blank' && n.rel.includes('noopener')))
check('οι περιλήψεις είναι καθαρές από markup του Drupal',
  news.every((n) => !n.summary.includes('THEME DEBUG') && !n.summary.includes('.twig')))
check('φαίνεται πότε ελέγχθηκε η πηγή', await page.isVisible('.nw__checked'))
check('δηλώνεται ότι δεν είναι επίσημο κανάλι', await page.isVisible('.nw__note'))
check('υπάρχουν σύνδεσμοι προς τις επίσημες πηγές',
  (await page.$$('.nw__links a')).length === 3)

// Η σήμανση «διαβάστηκε» γράφεται μόνο αφού μείνει η λίστα στην οθόνη.
await page.waitForTimeout(1800)
const seen = await page.evaluate(() => localStorage.getItem('army_app.news.seen.v1'))
check('η νεότερη ημερομηνία σημειώνεται ως ιδωμένη', /^\d{4}-\d{2}-\d{2}$/.test(seen ?? ''), seen)

// Πρώτη επίσκεψη: καμία κουκκίδα. Θα ήταν ψέμα να πούμε «νέο» σε κάποιον που
// δεν έχει δει ποτέ τη λίστα.
check('καμία κουκκίδα «νέο» στην πρώτη επίσκεψη',
  (await page.$$('.tabs__dot')).length === 0)

// Το ζωντανό αρχείο στο GitHub μπορεί κάλλιστα να λείπει: πριν τρέξει το
// Action για πρώτη φορά, ή σε ένα fork. Η ενότητα πρέπει να δείχνει ό,τι
// ήρθε με το build και να μη λέει τίποτα για την αποτυχία — το παραπάνω
// «διαβάστηκαν ανακοινώσεις» το επιβεβαιώνει ήδη.
const liveFailed = errors.some((e) => e.includes('raw.githubusercontent.com'))
check('η αποτυχία του ζωντανού αρχείου δεν αφήνει ίχνος στην οθόνη',
  await page.isVisible('.nw__list'), liveFailed ? 'το ζωντανό αρχείο έδωσε 404' : '')

// Το αποτυχημένο αίτημα προς το raw.githubusercontent.com το καταγράφει ο
// ίδιος ο browser και δεν πιάνεται από `catch`. Είναι αναμενόμενη κατάσταση,
// όχι σφάλμα, και ελέγχεται χωριστά παραπάνω.
const unexpected = errors.filter((e) => !e.includes('raw.githubusercontent.com'))
check('χωρίς σφάλματα κονσόλας', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))

await browser.close()
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails ? 1 : 0)
