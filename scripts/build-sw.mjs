/*
 * After `vite build`: writes the real asset list — the ones with a hash in
 * their name — and a build id for cache busting into dist/sw.js.
 *
 * Without it the service worker caches the HTML alone, and the app opens
 * offline but stays blank, because the JS and CSS are missing.
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
// The lazy Firebase chunks are around 700 kB; they are not precached over a
// mobile connection. They enter the cache if and when they are requested.
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
