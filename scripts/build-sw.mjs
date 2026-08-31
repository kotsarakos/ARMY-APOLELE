/*
 * Μετά το vite build: γράφει στη dist/sw.js τη λίστα των πραγματικών assets
 * (που έχουν hash στο όνομα) και ένα build id για ακύρωση της cache.
 *
 * Χωρίς αυτό ο service worker αποθηκεύει μόνο το HTML — η εφαρμογή ανοίγει
 * offline αλλά μένει λευκή, επειδή λείπουν JS και CSS.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const DIST = 'dist'
const SW = join(DIST, 'sw.js')

function walk(dir, base = '') {
  const out = []
  for (const name of readdirSync(join(DIST, dir))) {
    const rel = join(dir, name)
    if (statSync(join(DIST, rel)).isDirectory()) out.push(...walk(rel, base))
    else out.push('/' + rel.split(/[\\/]/).join('/'))
  }
  return out
}

const assets = walk('assets').filter((f) => /\.(js|css|woff2?)$/.test(f))
// Τα lazy Firebase chunks είναι ~700 kB· δεν τα κατεβάζουμε προληπτικά σε
// κινητό δίκτυο. Μπαίνουν στην cache όταν και αν ζητηθούν.
const shell = assets.filter((f) => !f.includes('index.esm'))

const src = readFileSync(SW, 'utf8')
const buildId = createHash('sha1').update(shell.join('|')).digest('hex').slice(0, 8)

const out = src
  .replace('__BUILD_ID__', buildId)
  .replace('[/* __ASSETS__ */]', JSON.stringify(shell))

writeFileSync(SW, out)
console.log(`  sw.js: build ${buildId}, precache ${shell.length} assets`)
shell.forEach((f) => console.log(`    ${f}`))
console.log(`  (${assets.length - shell.length} lazy chunks θα μπουν στην cache κατά ζήτηση)`)
