/**
 * Screenshots for the documentation and the manifest.
 *
 * This is a checked-in script rather than something rebuilt by hand, because
 * the README shows seven screens: after any design change they all have to be
 * retaken together, from the same data, or one image shows an old interface
 * beside a new one.
 *
 * The data is invented but coherent — a term halfway through, with a history
 * that makes sense. Dates are derived from today, so the counter never shows
 * something impossible.
 *
 *   npm run shots            # dark theme, English, into docs/screenshots
 *   THEME=light npm run shots
 *
 * Needs the preview server on :4173 — see scripts/README.md.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const EXEC = `${process.env.HOME}/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`
const BASE = process.env.BASE ?? 'http://localhost:4173'
const OUT = process.env.OUT ?? new URL('../docs/screenshots', import.meta.url).pathname
const THEME = process.env.THEME ?? 'dark'
const LOCALE = process.env.LOCALE ?? 'en-IE'

const iso = (d) => d.toISOString().slice(0, 10)
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

/** Enlisted about six months ago: enough history that no screen is empty. */
const enlist = (() => { const d = new Date(); d.setMonth(d.getMonth() - 6, 24); return iso(d) })()

const profile = {
  name: 'Kostas',
  enlistDate: enlist,
  months: 12,
  borderUnit: false,
  unit: '2nd Infantry Regiment',
  postings: [
    { id: 'ps-1', unit: 'Sparta Training Centre', from: enlist },
    { id: 'ps-2', unit: '2nd Infantry Regiment', from: day(-90), note: 'Evros' },
  ],
  leaveTaken: 0,
  leaves: [
    { id: 'lv-1', kind: 'regular', from: day(-104), to: day(-100), note: 'home' },
    { id: 'lv-2', kind: 'blood', from: day(-61), to: day(-59) },
    { id: 'lv-3', kind: 'regular', from: day(12), to: day(16), note: 'home' },
  ],
  duties: [
    { id: 'dt-1', kind: 'guard', date: day(1), hours: 2, start: '18:00', note: 'gate 2' },
    { id: 'dt-2', kind: 'kitchen', date: day(6), hours: 6 },
    { id: 'dt-3', kind: 'guard', date: day(-4), hours: 2, start: '02:00' },
    { id: 'dt-4', kind: 'orderly', date: day(-9), hours: 8 },
    { id: 'dt-5', kind: 'patrol', date: day(-15), hours: 4 },
    { id: 'dt-6', kind: 'guard', date: day(-22), hours: 2, start: '22:00' },
  ],
  bloodDonations: 1,
  lang: 'en',
  startingBalance: 42000,
  expenses: [
    { id: 'e1', amount: 450, category: 'canteen', date: day(-1), note: 'coffee' },
    { id: 'e2', amount: 1800, category: 'transport', date: day(-3) },
    { id: 'e3', amount: 2250, category: 'food', date: day(-5) },
    { id: 'e4', amount: 3200, category: 'fun', date: day(-11) },
    { id: 'e5', amount: 900, category: 'gear', date: day(-14) },
  ],
  recurring: [
    { id: 'rc-1', amount: 1500, category: 'phone', day: 5, since: day(-150), note: 'mobile plan' },
  ],
  monthlyBudget: 12000,
  deletedIds: [],
  updatedAt: Date.now(),
}

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: EXEC })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: LOCALE,
})
const page = await ctx.newPage()

await page.addInitScript(([p, theme]) => {
  localStorage.setItem('army_app.profile.v1', JSON.stringify(p))
  localStorage.setItem('army_app.theme.v1', theme)
  // So the announcements section marks the recent ones as new.
  localStorage.setItem('army_app.news.seen.v1', '2025-06-01')
}, [profile, THEME])

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.clock__num')
await page.waitForTimeout(700)

const shots = []
const shot = async (name) => {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  shots.push(name)
}

/**
 * Brings a section to the top of the screen, starting at its heading.
 * `block: 'center'` centres the panel and pushed the title out of frame — in a
 * documentation image the title is half the point.
 */
const scrollTo = async (selector) => {
  await page.waitForSelector(selector)
  await page.evaluate((s) => {
    const el = document.querySelector(s)
    const band = el?.closest('.band') ?? el
    const top = band.getBoundingClientRect().top + window.scrollY - 16
    window.scrollTo({ top, behavior: 'instant' })
  }, selector)
  await page.waitForTimeout(300)
}

await shot('counter')

await scrollTo('.ag')
await shot('month')
await page.evaluate(() => window.scrollTo(0, 0))

for (const tab of ['leave', 'duty', 'money', 'profile']) {
  await page.click(`[data-tab="${tab}"]`)
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(tab)
}

// Announcements live on the Profile tab but well down it, so they get their own shot.
await scrollTo('.nw')
await shot('news')

await browser.close()
console.log(`${shots.length} εικόνες (${THEME}, ${LOCALE}) → ${OUT}`)
for (const s of shots) console.log(`  · ${s}.png`)
