import { chromium } from 'playwright-core'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: EXEC })

// The welcome screen comes first: skip the account, then onboarding.
async function skipAuth(page) {
  const skip = await page.$('.welcome__skip .btn')
  if (skip) { await skip.click(); await page.waitForSelector('.esso') }
}

async function probe(label, sizes, setup) {
  for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, locale:'el-GR' })
    const p = await ctx.newPage()
    await p.goto('http://localhost:4173/', { waitUntil:'networkidle' })
    if (setup) await setup(p)
    await p.waitForTimeout(350)
    const m = await p.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      viewH: window.innerHeight,
      scrollingEl: document.scrollingElement === document.documentElement ? 'html' : 'body',
    }))
    const need = m.docH - m.viewH
    await p.mouse.move(w/2, h/2)
    await p.mouse.wheel(0, 800)
    await p.waitForTimeout(350)
    const y = await p.evaluate(() => window.scrollY)
    const verdict = need <= 0 ? 'δεν χρειάζεται scroll' : (y > 0 ? '✓ κύλισε ' + y : '✗ ΔΕΝ ΚΥΛΗΣΕ')
    console.log(`  ${label} @${w}x${h}  content=${m.docH} view=${m.viewH} overflow=${need>0?need:0}px  scrollEl=${m.scrollingEl}  ${verdict}`)
    await ctx.close()
  }
}

const fill = async (p) => { await skipAuth(p); await p.click('.esso'); await p.click('.btn--primary'); await p.waitForSelector('.clock__num') }

const SIZES = [[1280,800],[1440,900],[1280,600]]
console.log('— Onboarding —');       await probe('onboard', SIZES, null)
console.log('— Μετρητής —');         await probe('clock',   SIZES, fill)
console.log('— Άδειες —');           await probe('leave',   SIZES, async p => { await fill(p); await p.click('[data-tab="leave"]') })
console.log('— Ταμείο —');          await probe('money',   SIZES, async p => { await fill(p); await p.click('[data-tab="money"]') })
console.log('— Προφίλ (+login) —');  await probe('profile', SIZES, async p => { await fill(p); await p.click('[data-tab="profile"]') })
console.log('— Απόρρητο —');         await probe('privacy', SIZES, async p => { await p.goto('http://localhost:4173/privacy', {waitUntil:'networkidle'}) })
await b.close()
