import { chromium } from 'playwright-core'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const BASE = 'http://localhost:4173'
let fails = 0

// Νέα αρχική οθόνη: πρώτα «συνέχεια χωρίς λογαριασμό», μετά το onboarding.
async function skipAuth(page) {
  const skip = await page.$('.welcome__skip .btn')
  if (skip) { await skip.click(); await page.waitForSelector('.esso') }
}
const check = (l, ok, extra='') => { if(!ok) fails++; console.log(`${ok?'ok  ':'FAIL'} ${l}${extra?' — '+extra:''}`) }

const browser = await chromium.launch({ executablePath: EXEC })
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'el-GR' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
page.on('console', m => { if (m.type()==='error') errs.push(m.text()) })

await page.goto(BASE + '/', { waitUntil:'networkidle' })
// 0. Η αρχική οθόνη προσφέρει σύνδεση πριν από οτιδήποτε άλλο.
check('welcome screen shown first', await page.isVisible('.welcome'))
check('welcome offers Google', await page.isVisible('.btn--google'))
check('welcome offers email + password',
  (await page.isVisible('input[type=email]')) && (await page.isVisible('input[type=password]')))
check('welcome offers skip', await page.isVisible('.welcome__skip .btn'))
await skipAuth(page)
check('skip leads to onboarding', await page.isVisible('.esso'))

// 1. Ανίχνευση γλώσσας από τον browser (el-GR -> ελληνικά)
check('auto-detects Greek from locale', (await page.textContent('.onboard__title')) === 'Πότε κατατάσσεσαι;')
check('html lang=el', (await page.getAttribute('html','lang')) === 'el')
check('meta description is Greek',
  (await page.getAttribute('meta[name=description]','content')).startsWith('Μέτρησε'))

// 2. Σφάλμα: υποβολή χωρίς ημερομηνία
await page.click('.btn--primary')
await page.waitForSelector('.toast--error')
check('error toast on missing date', (await page.textContent('.toast--error')).includes('Διάλεξε ημερομηνία'))

// 3. Εναλλαγή γλώσσας
await page.click('.langsw__b >> nth=1')   // EN
await page.waitForTimeout(200)
check('switches to English', (await page.textContent('.onboard__title')) === 'When do you enlist?')
check('html lang=en', (await page.getAttribute('html','lang')) === 'en')
check('meta description switches',
  (await page.getAttribute('meta[name=description]','content')).startsWith('Count the days'))
check('title carries brand', (await page.title()).startsWith('Army Apolele'))
check('title switches language', (await page.title()).includes('Greek Military Service'))
check('og:locale switches', (await page.getAttribute('meta[property="og:locale"]','content')) === 'en_US')

check('language switch marks active segment',
  (await page.getAttribute('.langsw__b >> nth=1', 'aria-pressed')) === 'true' &&
  (await page.getAttribute('.langsw__b >> nth=0', 'aria-pressed')) === 'false')

// 4. Επιτυχία: συμπλήρωση προφίλ
await skipAuth(page)
await page.click('.esso')
await page.click('.btn--primary')
await page.waitForSelector('.clock__num')
check('success toast on save', (await page.textContent('.toast--success')).includes('All set'))
// Τα eyebrows κεφαλαιοποιούνται πλέον στη JS, όχι με CSS.
check('English counter', (await page.textContent('.eyebrow')).toUpperCase().includes('DAYS UNTIL'))
const days = await page.textContent('.clock__num')
check('counter shows a number', /^\d+$/.test(days.trim()), days)

// 5. Η γλώσσα επιβιώνει σε reload
await page.reload({ waitUntil:'networkidle' })
check('language persists after reload', (await page.getAttribute('html','lang')) === 'en')
check('profile persists after reload', await page.isVisible('.clock__num'))

// 6. Άδειες με ημερομηνίες
await page.click('[data-tab="leave"]')
check('leave screen shows next-leave clock', await page.isVisible('.clock__num, .clock__sub--empty'))

// Το ημερολόγιο είναι δικό μας: επιλέγουμε μέρα πατώντας τον κύκλο της.
async function pickDate(page, fieldIndex, iso) {
  await page.click(`.mn__add .datef >> nth=${fieldIndex}`)
  await page.waitForSelector('.cal')
  const [y, m] = iso.split('-').map(Number)
  // Πλοήγηση στον σωστό μήνα με τα βελάκια, ό,τι κι αν δείχνει τώρα.
  for (let i = 0; i < 36; i++) {
    // `$` επιστρέφει null αμέσως· το `getAttribute` θα περίμενε 30s ανά γύρο.
    if (await page.$(`[data-day="${iso}"]`)) break
    const mid = await page.getAttribute('.cal__grid > button:nth-child(16)', 'data-day')
    const [curY, curM] = mid.split('-').map(Number)
    const back = curY > y || (curY === y && curM > m)
    await page.click(`.cal__nav >> nth=${back ? 0 : 1}`)
    await page.waitForTimeout(60)
  }
  await page.click(`[data-day="${iso}"]`)
  await page.waitForSelector('.cal', { state: 'detached' })
}

await pickDate(page, 0, '2026-05-03')
await pickDate(page, 1, '2026-05-05')
await page.click('.mn__add .btn--primary')
await page.waitForSelector('.mn__item')
check('leave recorded', (await page.$$('.mn__item')).length === 1)
// 3/5 έως 5/5 είναι τρεις μέρες, όχι δύο — μετριέται περιληπτικά.
check('leave counts inclusive days',
  (await page.textContent('.mn__item .mn__iamt')).includes('3'))
check('leave taken reflected in the summary',
  (await page.textContent('.leave__side')).includes('3'))

// Η ίδια περίοδος δεύτερη φορά πρέπει να απορρίπτεται.
await pickDate(page, 0, '2026-05-04')
await pickDate(page, 1, '2026-05-06')
await page.click('.mn__add .btn--primary')
await page.waitForSelector('.toast--error')
check('overlapping leave rejected',
  (await page.textContent('.toast--error')).includes('already have leave'))

// Ανάποδο διάστημα: το ημερολόγιο του «Έως» δεν επιτρέπει καν μέρα πριν το «Από».
await page.click('.mn__add .datef >> nth=1')
await page.waitForSelector('.cal')
check('end-date calendar disables days before the start',
  await page.isDisabled('[data-day="2026-05-03"]'))
check('the start day itself stays selectable',
  !(await page.isDisabled('[data-day="2026-05-04"]')))
await page.click('.cal__foot .btn--ghost')
await page.waitForSelector('.cal', { state: 'detached' })

await page.click('.mn__item .mn__idel')
await page.waitForTimeout(300)
check('leave deleted', (await page.$$('.mn__item')).length === 0)

for (let i=0;i<3;i++) await page.click('.stepper .btn--ghost >> nth=1')  // αιμοδοσίες > 2
await page.waitForSelector('.toast--error')
check('blood donation cap error', (await page.textContent('.toast--error')).includes('at most 2'))

// 6β. Υπηρεσίες
await page.click('[data-tab="duty"]')
check('duty screen renders', await page.isVisible('.mn__add'))
await page.click('.mn__add .btn--primary')
await page.waitForSelector('.mn__item')
check('duty recorded', (await page.$$('.mn__item')).length === 1)
check('duty totals update', (await page.textContent('.tiles')).includes('1'))
await page.fill('.mn__add input[inputmode="decimal"]', '99')
await page.click('.mn__add .btn--primary')
await page.waitForTimeout(400)
// Το τελευταίο toast, όχι το πρώτο: προηγούμενα σφάλματα μπορεί να είναι
// ακόμη στην οθόνη και θα διαβάζαμε λάθος μήνυμα.
check('impossible duty length rejected',
  (await page.textContent('.toast--error >> nth=-1')).includes('between 0 and 24'),
  await page.textContent('.toasts'))

// 7. Ταμείο
await page.click('[data-tab="money"]')
check('money screen renders', await page.isVisible('.mn__add'))
await page.fill('.mn__f--amt input', '4,50')
await page.click('.mn__add .btn--primary')
await page.waitForSelector('.mn__item')
check('expense recorded', (await page.$$('.mn__item')).length === 1)
check('expense toast', (await page.textContent('.toast--success')).length > 0)
check('breakdown appears', await page.isVisible('.mn__cats'))
await page.fill('.mn__f--amt input', 'abc')
await page.click('.mn__add .btn--primary')
await page.waitForSelector('.toast--error')
check('invalid amount rejected', (await page.textContent('.toast--error')).length > 0)

// Η ημερομηνία γράφεται μαζί με το έξοδο και μπορεί να αλλάξει.
await page.fill('.mn__f--amt input', '7,20')
await pickDate(page, 0, '2026-07-04')
await page.click('.mn__add .btn--primary')
await page.waitForTimeout(300)
check('expense keeps the chosen date',
  (await page.textContent('.mn__list')).includes('04/07/2026'))

// Επεξεργασία υπάρχοντος εξόδου.
await page.click('.mn__item .mn__iedit >> nth=0')
await page.waitForSelector('.mn__edit')
await page.fill('.mn__edit .mn__f--amt input', '9,99')
await page.click('.mn__edit .btn--primary')
await page.waitForTimeout(300)
check('expense edited', (await page.textContent('.mn__list')).includes('9.99'))

// Πάγιο έξοδο: χρεώνεται μόνο του και φεύγει μαζί με τις χρεώσεις του.
const before = (await page.$$('.mn__item')).length
await page.click('.mn__rec .btn--secondary')
await page.waitForSelector('.mn__recform')
await page.fill('.mn__recform .mn__f--amt input', '15')
// Η μέρα χρέωσης πρέπει να είναι μελλοντική **μέσα στον μήνα**, αλλιώς ο
// έλεγχος εξαρτάται από το πότε τρέχει. Με προεπιλογή «1» και σημερινή μέρα
// την 1η του μήνα, η χρέωση όντως ωριμάζει σήμερα και ο έλεγχος αποτυγχάνει
// χωρίς να υπάρχει σφάλμα στην εφαρμογή.
const dom = new Date().getDate()
await page.fill('.mn__recform input[type=number]', String(dom < 28 ? 28 : 1))
await page.click('.mn__recform .btn--primary')
await page.waitForSelector('.mn__recitem')
check('recurring added', (await page.$$('.mn__recitem')).length === 1)
// Καμία αναδρομική χρέωση για μήνα που δεν παρακολουθούσε ο χρήστης.
await page.reload({ waitUntil: 'networkidle' })
await page.click('[data-tab="money"]')
await page.waitForSelector('.mn__item')
check('recurring does not back-charge before it existed',
  (await page.$$('.mn__item')).length === before)
await page.reload({ waitUntil: 'networkidle' })
await page.click('[data-tab="money"]')
await page.waitForSelector('.mn__item')
check('recurring stays idempotent across reloads',
  (await page.$$('.mn__item')).length === before)
await page.click('.mn__recitem .mn__idel')
await page.waitForTimeout(300)
check('deleting a recurring removes its charges too',
  (await page.$$('.mn__item')).length === before)

while ((await page.$$('.mn__item')).length > 0) {
  await page.click('.mn__item .mn__idel >> nth=0')
  await page.waitForTimeout(200)
}
check('expense deleted', (await page.$$('.mn__item')).length === 0)

// Το αντίγραφο ασφαλείας πρέπει να είναι έγκυρο JSON με τα δεδομένα μέσα.
const backup = await page.evaluate(() => {
  const raw = localStorage.getItem('army_app.profile.v1')
  return raw ? JSON.parse(raw) : null
})
check('profile has the new collections',
  backup && Array.isArray(backup.leaves) && Array.isArray(backup.duties)
    && Array.isArray(backup.recurring) && Array.isArray(backup.deletedIds))
check('deleting leaves tombstones behind', backup.deletedIds.length > 0)


/* ── Ενιαίο ημερολόγιο μήνα ─────────────────────────────────────────────── */

await page.click('[data-tab="clock"]')
await page.waitForSelector('.ag__grid')
check('agenda renders 42 cells', (await page.$$('.ag__cell')).length === 42)
check('agenda marks today', (await page.$$('.ag__cell--today')).length === 1)
// Η άδεια και η υπηρεσία που καταχωρήθηκαν παραπάνω πρέπει να φαίνονται εδώ:
// αυτός είναι όλος ο λόγος ύπαρξης της οθόνης.
check('agenda shows entries from other tabs',
  (await page.$$('.ag__dot--duty, .ag__dot--leave')).length > 0)
check('agenda has a legend', await page.isVisible('.ag__legend'))

const monthBefore = await page.textContent('.ag__month')
await page.click('.ag__head .cal__nav >> nth=1')
await page.waitForTimeout(150)
check('agenda moves to the next month',
  (await page.textContent('.ag__month')) !== monthBefore)
check('a way back to the current month appears', await page.isVisible('.ag__back .btn'))
await page.click('.ag__back .btn')
await page.waitForTimeout(150)
check('and it returns', (await page.textContent('.ag__month')) === monthBefore)

// Πάτημα μέρας ανοίγει τη λίστα της, χωρίς να φύγει από τη σελίδα.
const dutyCell = await page.$('.ag__cell:has(.ag__dot--duty)')
if (dutyCell) {
  await dutyCell.click()
  await page.waitForTimeout(150)
  check('tapping a day opens its list', await page.isVisible('.ag__day'))
  check('the list names the entry', (await page.textContent('.ag__list')).length > 0)
} else {
  check('tapping a day opens its list', false, 'no duty cell found')
}

/* ── Χρονολόγιο: πρόοδος και ορόσημα σε ένα ─────────────────────────────── */

check('timeline replaces the duplicated progress bar',
  (await page.$$('.clock .progress__track')).length === 0)
check('timeline carries the progress bar', await page.isVisible('.tl .progress__track'))
check('timeline lists milestones', (await page.$$('.tl .ms__item')).length > 0)
check('timeline marks where you are now', (await page.$$('.ms__item--now')).length === 1)

/* ── Μηνιαίο όριο εξόδων ────────────────────────────────────────────────── */

await page.click('[data-tab="money"]')
await page.waitForSelector('.bd')
check('budget starts unset', (await page.textContent('.bd')).includes('No limit'))
await page.fill('.bd input', '50')
await page.click('.bd .btn--secondary')
await page.waitForTimeout(250)
check('budget can be set', await page.isVisible('.bd__big'))
check('budget counts only this month', (await page.$$('.bd__nums > div')).length === 2)

// Ένα έξοδο πάνω από το όριο πρέπει να το δηλώνει, όχι να το κρύβει.
await page.fill('.mn__add .mn__f--amt input', '80')
await page.click('.mn__add .btn--primary')
await page.waitForTimeout(300)
check('going over the limit is flagged', await page.isVisible('.bd--over'))
check('and the bar does not overflow its track',
  await page.evaluate(() => {
    const fill = document.querySelector('.bd .progress__fill')
    const track = fill?.parentElement
    return !!fill && fill.getBoundingClientRect().width <= track.getBoundingClientRect().width + 1
  }))
await page.click('.bd .btn--ghost')
await page.waitForTimeout(250)
check('budget can be removed', !(await page.isVisible('.bd__big')))

/* ── Αναίρεση διαγραφής ─────────────────────────────────────────────────── */

const beforeUndo = (await page.$$('.mn__item')).length
await page.click('.mn__item .mn__idel >> nth=0')
await page.waitForSelector('.toast__action')
check('deleting offers an undo', await page.isVisible('.toast__action'))
check('the row is gone meanwhile', (await page.$$('.mn__item')).length === beforeUndo - 1)
await page.click('.toast__action')
await page.waitForTimeout(300)
check('undo brings the row back', (await page.$$('.mn__item')).length === beforeUndo)
check('and the toast closes', !(await page.isVisible('.toast__action')))
// Η ταφόπλακα πρέπει να φύγει, αλλιώς η επόμενη συγχώνευση θα το ξανάσβηνε.
const tombstones = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('army_app.profile.v1')).deletedIds)
const ids = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('army_app.profile.v1')).expenses.map((e) => e.id))
check('undo also removes the tombstone', ids.every((id) => !tombstones.includes(id)))

/* ── Ιστορικό μονάδων ───────────────────────────────────────────────────── */

await page.click('[data-tab="profile"]')
await page.waitForSelector('.ps')
check('postings start empty', (await page.textContent('.ps')).includes('No postings'))
await page.click('.ps > .btn--secondary')
await page.waitForSelector('.ps .mn__recform')
await page.fill('.ps .mn__recform input[type=text] >> nth=0', 'Sparta Training Centre')
await page.click('.ps .mn__recform .btn--primary')
await page.waitForSelector('.ps__item')
check('posting recorded', (await page.$$('.ps__item')).length === 1)
check('the current posting is marked', await page.isVisible('.ps__item--now .tag--live'))
check('and it shows in the profile header',
  (await page.textContent('.pf__unit')) === 'Sparta Training Centre')

await page.click('.ps__item .mn__idel')
await page.waitForTimeout(300)
check('posting deleted', (await page.$$('.ps__item')).length === 0)
await page.click('.toast__action')
await page.waitForTimeout(300)
check('posting deletion can be undone', (await page.$$('.ps__item')).length === 1)

/* ── Συντομεύσεις του εικονιδίου ────────────────────────────────────────── */

// Το manifest δηλώνει /?add=duty· η εφαρμογή πρέπει να ανοίγει στη φόρμα.
await page.goto(BASE + '/?add=duty', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('shortcut opens the duty tab',
  (await page.getAttribute('[data-tab="duty"]', 'aria-current')) === 'page')
check('shortcut cleans the URL so a refresh does not repeat it',
  page.url() === BASE + '/')
await page.goto(BASE + '/?add=leave', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('shortcut opens the leave tab',
  (await page.getAttribute('[data-tab="leave"]', 'aria-current')) === 'page')
await page.goto(BASE + '/?add=nonsense', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check('an unknown shortcut is ignored',
  (await page.getAttribute('[data-tab="clock"]', 'aria-current')) === 'page')

/* ── Εικονίδια στις ενότητες ────────────────────────────────────────────── */

check('every tab has an icon', (await page.$$('.tabs__b svg')).length === 5)
check('and keeps its label', (await page.$$('.tabs__t')).length === 5)

// 8. Προφίλ + επιβεβαίωση μηδενισμού
await page.click('[data-tab="profile"]')
check('profile renders', await page.isVisible('.pf__name'))
check('milestones moved to counter tab', (await page.$$('.ms__item')).length === 0)
await page.click('.btn--danger')
check('reset asks for confirmation', await page.isVisible('.set__confirm'))
await page.click('.btn--ghost.btn--sm')
check('reset can be cancelled', !(await page.isVisible('.set__confirm')))

// 9. Απόρρητο
await page.click('.foot__link')
await page.waitForSelector('.page__title')
check('privacy page opens', (await page.textContent('.page__title')) === 'Privacy Policy')
check('privacy has 7 sections', (await page.$$('.page__section')).length === 7)
check('privacy url', page.url().endsWith('/privacy'))

// 10. 404
await page.goto(BASE + '/does-not-exist', { waitUntil:'networkidle' })
check('404 renders', (await page.textContent('.notfound__code')) === '404')
await page.click('.notfound .btn--primary')
await page.waitForTimeout(200)
check('404 back button returns home', page.url() === BASE + '/')

// 11. Κλείδωμα ζουμ
const vp = await page.getAttribute('meta[name=viewport]','content')
check('viewport locks zoom', vp.includes('user-scalable=no') && vp.includes('maximum-scale=1'), vp)

check('no console/page errors', errs.length === 0, errs.slice(0,3).join(' | '))

// Στιγμιότυπα
await page.goto(BASE + '/', { waitUntil:'networkidle' })
await page.screenshot({ path:'/tmp/claude-1000/-home-kotsaras-army-app/826ac12f-be3d-4713-ac77-1b62fc73d73b/scratchpad/shot-clock-en.png' })
await page.click('.langsw__b >> nth=0'); await page.waitForTimeout(250)  // ΕΛ
await page.screenshot({ path:'/tmp/claude-1000/-home-kotsaras-army-app/826ac12f-be3d-4713-ac77-1b62fc73d73b/scratchpad/shot-clock-el.png' })
await page.click('[data-tab="leave"]'); await page.waitForTimeout(200)
await page.screenshot({ path:'/tmp/claude-1000/-home-kotsaras-army-app/826ac12f-be3d-4713-ac77-1b62fc73d73b/scratchpad/shot-leave-el.png' })
await page.goto(BASE + '/nope', { waitUntil:'networkidle' })
await page.screenshot({ path:'/tmp/claude-1000/-home-kotsaras-army-app/826ac12f-be3d-4713-ac77-1b62fc73d73b/scratchpad/shot-404.png' })

await browser.close()
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails?1:0)
