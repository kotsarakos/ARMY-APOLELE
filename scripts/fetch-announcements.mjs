/**
 * Κατεβάζει τις ανακοινώσεις της Στρατολογίας σε στατικό JSON.
 *
 * Τρέχει σε GitHub Action, όχι στον browser, για δύο λόγους:
 *
 *  1. Το feed δεν στέλνει `Access-Control-Allow-Origin`, οπότε ο browser δεν
 *     επιτρέπεται να το διαβάσει απευθείας.
 *  2. Η εφαρμογή είναι local-first. Ένας διακομιστής που θα έκανε το ίδιο
 *     θα σήμαινε ότι κάθε άνοιγμα της εφαρμογής περνά από κάπου· εδώ το
 *     αποτέλεσμα είναι ένα αρχείο, ίδιο για όλους, χωρίς αίτημα ανά χρήστη.
 *
 * Το αποτέλεσμα γράφεται στο `public/announcements.json`, οπότε ταξιδεύει
 * μαζί με το build και δουλεύει και offline. Το ίδιο αρχείο σερβίρεται και
 * από το raw.githubusercontent.com, που το χρησιμοποιεί η εφαρμογή για να
 * φρεσκάρει χωρίς νέο deploy — δες src/lib/announcements.ts.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FEED = 'https://www.stratologia.gr/rss.xml'
const SITE = 'https://www.stratologia.gr/'
const OUT = new URL('../public/announcements.json', import.meta.url)

/** Πόσες κρατάμε. Η υπηρεσία δημοσιεύει λίγες φορές τον χρόνο. */
const MAX_ITEMS = 8
const MAX_SUMMARY = 220

/**
 * Ο ιστότοπος τρέχει Drupal με το THEME DEBUG ανοιχτό, οπότε τυπώνει σχόλια
 * HTML **πριν** από τη δήλωση `<?xml`. Αυτό κάνει το feed άκυρο XML και κάθε
 * αυστηρός parser το απορρίπτει. Κόβουμε ό,τι προηγείται.
 */
function cleanXml(raw) {
  const start = raw.indexOf('<?xml')
  return start > 0 ? raw.slice(start) : raw
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
}

function decodeOnce(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/**
 * Το feed είναι διπλά κωδικοποιημένο: το `&amp;nbsp;` γίνεται `&nbsp;` στο
 * πρώτο πέρασμα και κενό μόνο στο δεύτερο. Δύο περάσματα φτάνουν και δεν
 * μπορούν να τρέξουν ατέρμονα.
 */
function decode(text) {
  const once = decodeOnce(text)
  return once === text ? once : decodeOnce(once)
}

/**
 * Το κείμενο ενός στοιχείου, καθαρό από CDATA, σχόλια και HTML.
 *
 * Η **σειρά είναι ουσιώδης**: το `<description>` περιέχει το HTML σε
 * κωδικοποιημένη μορφή (`&lt;!-- ... --&gt;`), οπότε αν αφαιρέσουμε πρώτα τα
 * σχόλια δεν βρίσκουμε τίποτα — και μετά η αποκωδικοποίηση τα ξαναφέρνει ως
 * ορατό κείμενο. Αποκωδικοποιούμε πρώτα, καθαρίζουμε μετά.
 *
 * Χωρίς αυτό, η περίληψη κάθε ανακοίνωσης ήταν το THEME DEBUG του Drupal:
 * λίστες αρχείων twig από τον ιστότοπό τους.
 */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  const unwrapped = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decode(unwrapped)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Το Drupal δεν αποδίδει μια περίληψη — αποδίδει ολόκληρο τον κόμβο. Έτσι το
 * `<description>` ξεκινά με τον τίτλο ξανά, το username του συντάκτη και τη
 * σφραγίδα ώρας, και μόνο μετά έρχεται το κείμενο:
 *
 *   «Νέος Νόμος… rodopoulou.g Τετ, 01/14/2026 - 08:07 Δημοσιεύτηκε ο Νόμος…»
 *
 * Η σφραγίδα είναι το πιο αξιόπιστο σημάδι για το πού αρχίζει η ουσία.
 */
function stripDrupalByline(text, title) {
  const stamp = text.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}:\d{2}\s*/)
  if (stamp) return text.slice(stamp.index + stamp[0].length).trim()
  // Χωρίς σφραγίδα, τουλάχιστον δεν επαναλαμβάνουμε τον τίτλο.
  return text.startsWith(title) ? text.slice(title.length).trim() : text
}

function shorten(text, max) {
  if (text.length <= max) return text
  // Κόβουμε σε όριο λέξης, ώστε να μη μένει μισή λέξη πριν τα αποσιωπητικά.
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** 'Wed, 14 Jan 2026 10:00:00 +0200' → '2026-01-14'. Κενό αν δεν διαβάζεται. */
function isoDate(pubDate) {
  const d = new Date(pubDate)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(([, block]) => {
      const link = tag(block, 'link')
      const title = tag(block, 'title')
      const body = stripDrupalByline(tag(block, 'description'), title)
      return {
        // Ο σύνδεσμος είναι σταθερός ανά ανακοίνωση και κάνει καλό κλειδί·
        // αν λείψει, πέφτουμε στον τίτλο ώστε να μη χαθεί η εγγραφή.
        id: link || title,
        title,
        summary: shorten(body, MAX_SUMMARY),
        link,
        date: isoDate(tag(block, 'pubDate')),
      }
    })
    .filter((i) => i.title && i.link)
    .slice(0, MAX_ITEMS)
}

async function main() {
  const res = await fetch(FEED, {
    headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`${FEED} → HTTP ${res.status}`)

  const items = parseFeed(cleanXml(await res.text()))
  if (items.length === 0) throw new Error('το feed διαβάστηκε αλλά δεν είχε καμία ανακοίνωση')

  const next = { source: SITE, feed: FEED, checkedAt: new Date().toISOString(), items }

  // Η `checkedAt` αλλάζει σε κάθε τρέξιμο. Αν συγκρίναμε ολόκληρο το αρχείο,
  // θα γραφόταν commit κάθε μέρα χωρίς να έχει αλλάξει τίποτε ουσιαστικό.
  const changed = !existsSync(OUT) ||
    JSON.stringify(JSON.parse(readFileSync(OUT, 'utf8')).items) !== JSON.stringify(items)

  if (!changed) {
    console.log(`καμία αλλαγή — ${items.length} ανακοινώσεις, η νεότερη ${items[0].date}`)
    return
  }

  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(`γράφτηκαν ${items.length} ανακοινώσεις, η νεότερη ${items[0].date}`)
  for (const i of items) console.log(`  · ${i.date}  ${i.title.slice(0, 70)}`)
}

/**
 * Δοκιμή του parser πάνω σε αποθηκευμένο, πραγματικό feed.
 *
 * Το ζητούμενο δεν είναι να δούμε αν ο ιστότοπος απαντά — αυτό το δείχνει το
 * ίδιο το Action. Είναι να κλειδώσουμε τις ιδιομορφίες που ήδη βρήκαμε:
 * σχόλια πριν τη δήλωση XML, HTML διπλά κωδικοποιημένο μέσα στην περιγραφή,
 * και το byline του Drupal μπροστά από το κείμενο. Καθεμιά τους, αν σπάσει,
 * δεν ρίχνει τίποτα — απλώς γεμίζει την εφαρμογή με σκουπίδια.
 */
function selfTest() {
  const fixture = new URL('../tests/fixtures/stratologia-rss.xml', import.meta.url)
  let fails = 0
  const check = (label, ok, extra = '') => {
    if (!ok) fails++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`)
  }

  const raw = readFileSync(fixture, 'utf8')
  check('το fixture κρατά το ελάττωμα που διορθώνουμε',
    raw.indexOf('THEME DEBUG') < raw.indexOf('<?xml'))

  const items = parseFeed(cleanXml(raw))
  check('διαβάστηκαν ανακοινώσεις', items.length === 2, String(items.length))

  for (const i of items) {
    check(`«${i.title.slice(0, 32)}…» έχει σύνδεσμο https`, i.link.startsWith('https://'))
    check('  ημερομηνία σε ISO', /^\d{4}-\d{2}-\d{2}$/.test(i.date), i.date)
    check('  καμία ετικέτα HTML στην περίληψη', !/[<>]/.test(i.summary))
    check('  κανένα σχόλιο THEME DEBUG', !i.summary.includes('THEME DEBUG'))
    check('  καμία διαδρομή twig', !i.summary.includes('.twig'))
    check('  καμία υπολειπόμενη οντότητα', !/&[a-z]+;|&#\d+;/i.test(i.summary))
    check('  δεν επαναλαμβάνει τον τίτλο', !i.summary.startsWith(i.title.slice(0, 25)))
    check('  δεν κρατά το byline του συντάκτη',
      !/\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}:\d{2}/.test(i.summary))
    check('  η περίληψη έχει περιεχόμενο', i.summary.length > 40, String(i.summary.length))
    check(`  δεν ξεπερνά τους ${MAX_SUMMARY} χαρακτήρες`, i.summary.length <= MAX_SUMMARY + 1)
  }

  console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
  process.exit(fails ? 1 : 0)
}

const invoked = process.argv[1] && import.meta.url === new URL(`file://${fileURLToPath(import.meta.url)}`).href

if (process.argv.includes('--selftest')) selfTest()
else if (invoked) {
  main().catch((err) => {
    console.error('απέτυχε:', err.message)
    process.exit(1)
  })
}
