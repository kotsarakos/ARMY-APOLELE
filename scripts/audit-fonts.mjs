import { chromium } from 'playwright-core'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: EXEC })
// Ελληνικό locale ώστε η σελίδα να ζητήσει όντως τα ελληνικά subsets.
const page = await (await browser.newContext({ locale: 'el-GR' })).newPage()
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })

const r = await page.evaluate(async () => {
  const probes = [
    ['Roboto Condensed', 700, 'ΑΠΟΛΥΤΗΡΙΟ ΜΕΡΕΣ ΔΦΓΞΨΩ', 'Display / Greek caps'],
    ['Roboto Condensed', 700, 'Πότε κατατάσσεσαι; άέήίόύώ', 'Display / Greek lc+accents'],
    ['Roboto Condensed', 700, 'DISCHARGE Days', 'Display / Latin'],
    ['Roboto Condensed', 700, '0123456789', 'Display / digits'],
    ['Roboto Mono', 500, 'ΜΕΡΕΣ ΜΕΧΡΙ ΤΟ ΑΠΟΛΥΤΗΡΙΟ', 'Mono / Greek caps'],
    ['Roboto Mono', 500, 'DAYS UNTIL DISCHARGE', 'Mono / Latin'],
  ]
  // Το measureText δεν φορτώνει faces — πρέπει να ζητηθούν ρητά.
  await Promise.all(probes.map(([f, w, t]) =>
    document.fonts.load(`${w} 60px "${f}"`, t).catch(() => {})))
  await document.fonts.ready

  const measure = (text, family, weight) => {
    const c = document.createElement('canvas').getContext('2d')
    c.font = `${weight} 60px ${family}`
    return c.measureText(text).width
  }
  return probes.map(([family, weight, text, label]) => {
    const withFont = measure(text, `"${family}", serif`, weight)
    const fallback = measure(text, 'serif', weight)
    return { label, withFont, fallback, covered: Math.abs(withFont - fallback) > 0.5 }
  })
})

let fails = 0
for (const p of r) {
  if (!p.covered) fails++
  console.log(`${p.covered ? 'ok   COVERED ' : 'MISS FALLBACK'} ${p.label.padEnd(28)} font=${p.withFont.toFixed(1)} serif=${p.fallback.toFixed(1)}`)
}
await browser.close()
console.log(fails === 0 ? '\nALL PASS — display και mono καλύπτουν ελληνικά + λατινικά' : `\n${fails} FAILURES`)
process.exit(fails ? 1 : 0)
