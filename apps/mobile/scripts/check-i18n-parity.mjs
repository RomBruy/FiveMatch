// i18n parity gate (Story 9.12, AC 5): en.json and fr.json must expose the exact
// same key set. Runs as part of `pnpm lint` so CI's `turbo lint` enforces it.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const load = (lang) => JSON.parse(readFileSync(join(root, '..', 'src', 'i18n', `${lang}.json`), 'utf8'))

const fr = load('fr')
const en = load('en')

const frKeys = new Set(Object.keys(fr))
const enKeys = new Set(Object.keys(en))

const missingInEn = [...frKeys].filter((k) => !enKeys.has(k))
const missingInFr = [...enKeys].filter((k) => !frKeys.has(k))

if (missingInEn.length > 0 || missingInFr.length > 0) {
  if (missingInEn.length > 0) console.error(`Missing in en.json: ${missingInEn.join(', ')}`)
  if (missingInFr.length > 0) console.error(`Missing in fr.json: ${missingInFr.join(', ')}`)
  process.exit(1)
}

console.log(`i18n parity OK — ${frKeys.size} keys in fr.json and en.json`)
