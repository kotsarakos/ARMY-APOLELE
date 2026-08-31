import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const JOBS = [
  ['design/logos/03-tally.svg',          'public/icon-192.png',            192],
  ['design/logos/03-tally.svg',          'public/icon-512.png',            512],
  ['design/logos/03-tally-maskable.svg', 'public/icon-maskable-512.png',   512],
  ['design/logos/03-tally-ios.svg',      'public/apple-touch-icon.png',    180],
]

const b = await chromium.launch({ executablePath: EXEC })
for (const [src, out, size] of JOBS) {
  const svg = readFileSync(src, 'utf8')
  const page = await (await b.newContext({
    viewport: { width: size, height: size }, deviceScaleFactor: 1,
  })).newPage()
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px">${
      svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
    }</body>`)
  await page.waitForTimeout(120)
  await page.screenshot({ path: out, omitBackground: false })
  console.log(`  ${out}  ${size}×${size}`)
  await page.close()
}
await b.close()
