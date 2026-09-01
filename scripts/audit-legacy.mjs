/**
 * Παλιά προφίλ σε νέο build.
 *
 * Η εφαρμογή είναι local-first: το προφίλ ζει στη συσκευή και μπορεί να έχει
 * γραφτεί από έκδοση μηνών πριν. Κάθε νέο πεδίο είναι μια ευκαιρία για
 * `Cannot read properties of undefined` — που εδώ δεν σημαίνει σφάλμα σε μια
 * οθόνη, σημαίνει λευκή οθόνη και χαμένα δεδομένα για κάποιον που δεν έκανε
 * τίποτα λάθος.
 *
 * Οι δοκιμές μονάδας δεν το πιάνουν, γιατί τα fixture τους φτιάχνονται πάντα
 * από το τρέχον `DEFAULT_PROFILE`. Εδώ φορτώνονται σχήματα προηγούμενων
 * εκδόσεων, όπως ακριβώς θα τα έβρισκε ο browser.
 */
import { chromium } from 'playwright-core'
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: EXEC })
let fails = 0
const check = (l, ok, x='') => { if(!ok) fails++; console.log(`${ok?'ok  ':'FAIL'} ${l}${x?' — '+x:''}`) }

// Το σχήμα της πρώτης έκδοσης: μετρητής αδείας, σκέτη μονάδα, καμία λίστα.
for (const [label, legacy] of Object.entries({
  'v1 (counter + unit, no lists)': {
    name:'Old', enlistDate:'2026-02-24', months:12, borderUnit:false,
    unit:'ΚΕΝ Σπάρτης', leaveTaken:6, bloodDonations:1, lang:'el', updatedAt: 1,
  },
  'v2 (lists, no postings or budget)': {
    name:'Mid', enlistDate:'2026-02-24', months:12, borderUnit:false, unit:'',
    leaveTaken:0, leaves:[{id:'lv',kind:'regular',from:'2026-05-01',to:'2026-05-03'}],
    duties:[{id:'dt',kind:'guard',date:'2026-05-10',hours:2}],
    bloodDonations:0, lang:'el', startingBalance:0,
    expenses:[{id:'e',amount:500,category:'food',date:'2026-05-02'}],
    recurring:[], deletedIds:[], updatedAt: 1,
  },
  'bare minimum': { enlistDate:'2026-02-24', months:12 },
})) {
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, locale:'el-GR' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const at = m.location()?.url
    errs.push(at ? `${m.text()} @ ${at}` : m.text())
  })
  await page.addInitScript((p) => localStorage.setItem('army_app.profile.v1', JSON.stringify(p)), legacy)
  await page.goto('http://localhost:4173', { waitUntil:'networkidle' })
  const shown = await page.waitForSelector('.clock__num', { timeout: 8000 }).catch(() => null)
  check(`${label}: opens without a white screen`, shown !== null)
  for (const tab of ['leave','duty','money','profile']) {
    await page.click(`[data-tab="${tab}"]`).catch(() => {})
    await page.waitForTimeout(350)
    check(`${label}: ${tab} tab renders`, (await page.$$('.band')).length > 0)
  }
  // Η παλιά μονάδα πρέπει να γίνει τοποθέτηση, όχι να χαθεί.
  if (legacy.unit) {
    check(`${label}: legacy unit became a posting`, await page.isVisible('.ps__item'))
  }
  // Το ζωντανό αρχείο ανακοινώσεων μπορεί να λείπει από το GitHub· η εφαρμογή
  // πέφτει πίσω στο αντίγραφο του build και δεν σπάει.
  const unexpected = errs.filter(e => !e.includes('raw.githubusercontent.com'))
  check(`${label}: no console errors`, unexpected.length === 0, unexpected.slice(0,2).join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails ? 1 : 0)
