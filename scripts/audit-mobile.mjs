import { chromium } from 'playwright-core'

const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const BASE = 'http://localhost:4173'


// Νέα αρχική οθόνη: πρώτα «συνέχεια χωρίς λογαριασμό», μετά το onboarding.
async function skipAuth(page) {
  const skip = await page.$('.welcome__skip .btn')
  if (skip) { await skip.click(); await page.waitForSelector('.esso') }
}
const WIDTHS = [320, 360, 390, 414, 768]
let fails = 0
const check = (label, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch({ executablePath: EXEC })

async function audit(width, setup, name) {
  const ctx = await browser.newContext({
    viewport: { width, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  if (setup) await setup(page)
  await page.waitForTimeout(250)

  const r = await page.evaluate(() => {
    const de = document.documentElement
    const overflowing = []
    for (const el of document.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.right > window.innerWidth + 1 || rect.left < -1) {
        overflowing.push(
          el.tagName.toLowerCase() +
          (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
          ` [${Math.round(rect.left)}..${Math.round(rect.right)}]`
        )
      }
    }
    // Πεδία κάτω από 16px προκαλούν αυτόματο zoom στο iOS.
    const smallInputs = [...document.querySelectorAll('input,select,textarea')]
      .filter((el) => !['checkbox', 'radio', 'range'].includes(el.type))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.tagName.toLowerCase() + '#' + (el.id || el.type))
    // Στόχοι αφής κάτω από 44px.
    const smallTargets = [...document.querySelectorAll('button,a')]
      .filter((el) => {
        const b = el.getBoundingClientRect()
        return b.height > 0 && b.height < 44
      })
      .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/)[0] + ':' + Math.round(el.getBoundingClientRect().height))
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      innerW: window.innerWidth,
      overflowing: [...new Set(overflowing)].slice(0, 6),
      smallInputs,
      smallTargets: [...new Set(smallTargets)],
    }
  })

  check(`${name} @${width}px no horizontal scroll`,
    r.scrollW <= r.clientW,
    r.scrollW > r.clientW ? `scrollW=${r.scrollW} clientW=${r.clientW}` : '')
  check(`${name} @${width}px nothing overflows viewport`,
    r.overflowing.length === 0,
    r.overflowing.join(' | '))
  check(`${name} @${width}px text inputs >=16px`, r.smallInputs.length === 0, r.smallInputs.join(', '))
  check(`${name} @${width}px touch targets >=44px`, r.smallTargets.length === 0, r.smallTargets.join(', '))

  await ctx.close()
}

const fillProfile = async (page) => {
  await skipAuth(page)
  await page.click('.esso')                       // διάλεξε ΕΣΣΟ
  await page.click('.btn--primary')               // ξεκίνα
  await page.waitForSelector('.clock__num')
}

console.log('── Onboarding ──')
for (const w of WIDTHS) await audit(w, skipAuth, 'onboard')

console.log('\n── Μετρητής ──')
for (const w of WIDTHS) await audit(w, fillProfile, 'clock')

console.log('\n── Άδειες ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => { await fillProfile(p); await p.click('[data-tab="leave"]') }, 'leave')
}

console.log('\n── Ταμείο ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => { await fillProfile(p); await p.click('[data-tab="money"]') }, 'money')
}

console.log('\n── Ταμείο με έξοδα ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => {
    await fillProfile(p); await p.click('[data-tab="money"]')
    // Καταχώρηση εξόδου: ελέγχει και τη λίστα και την ανάλυση κατηγοριών.
    await p.fill('.mn__f--amt input', '12,50')
    await p.click('.mn__add .btn--primary')
    await p.waitForSelector('.mn__item')
  }, 'money+')
}

console.log('\n── Υπηρεσίες ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => {
    await fillProfile(p); await p.click('[data-tab="duty"]')
    await p.click('.mn__add .btn--primary')
    await p.waitForSelector('.mn__item')
  }, 'duty')
}

console.log('\n── Άδειες με εγγραφή ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => {
    await fillProfile(p); await p.click('[data-tab="leave"]')
    await p.click('.mn__add .btn--primary')
    await p.waitForSelector('.mn__item')
  }, 'leave+')
}

console.log('\n── Ημερολόγιο ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => {
    await fillProfile(p); await p.click('[data-tab="leave"]')
    await p.click('.mn__add .datef >> nth=0')
    await p.waitForSelector('.cal')
  }, 'calendar')
}

console.log('\n── Προφίλ ──')
for (const w of WIDTHS) {
  await audit(w, async (p) => { await fillProfile(p); await p.click('[data-tab="profile"]') }, 'profile')
}

console.log('\n── Απόρρητο & 404 ──')
for (const w of [320, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  for (const [path, label] of [['/privacy', 'privacy'], ['/nope', '404']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const r = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      text: document.body.innerText.slice(0, 60).replace(/\n/g, ' '),
    }))
    check(`${label} @${w}px no horizontal scroll`, r.scrollW <= r.clientW, `${r.scrollW}>${r.clientW}`)
    check(`${label} @${w}px renders`, r.text.length > 10, r.text)
  }
  await ctx.close()
}

await browser.close()
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails ? 1 : 0)
