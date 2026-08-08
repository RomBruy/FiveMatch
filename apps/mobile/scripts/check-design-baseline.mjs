import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(scriptsDir, '..')
const baseline = JSON.parse(fs.readFileSync(path.join(scriptsDir, 'design-baseline.json'), 'utf8'))
const packageJson = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'package.json'), 'utf8'))

const failures = []

for (const relativePath of baseline.requiredFiles) {
  if (!fs.existsSync(path.join(mobileRoot, relativePath))) {
    failures.push(`Missing preserved design-system file: ${relativePath}`)
  }
}

for (const section of ['dependencies', 'devDependencies']) {
  const currentNames = Object.keys(packageJson[section] ?? {})
  const approvedNames = new Set(baseline[section] ?? [])
  for (const name of currentNames) {
    if (!approvedNames.has(name)) {
      failures.push(`New direct ${section} entry requires documented review: ${name}`)
    }
  }
}

const layoutPath = path.join(mobileRoot, 'app', '(app)', '_layout.tsx')
const layout = fs.readFileSync(layoutPath, 'utf8')
const screenTags = layout.match(/<Tabs\.Screen[\s\S]*?\/>/g) ?? []
const visibleTabs = screenTags
  .filter((tag) => !/href\s*:\s*null/.test(tag))
  .map((tag) => tag.match(/name="([^"]+)"/)?.[1])
  .filter(Boolean)

if (JSON.stringify(visibleTabs) !== JSON.stringify(baseline.visibleTabs)) {
  failures.push(
    `Visible tab baseline changed. Expected ${JSON.stringify(baseline.visibleTabs)}, received ${JSON.stringify(visibleTabs)}`,
  )
}

if (failures.length > 0) {
  console.error('PR-055 design baseline failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  console.error('Document and approve any unavoidable deviation before updating design-baseline.json.')
  process.exitCode = 1
} else {
  console.log(
    `PR-055 design baseline passed (${baseline.requiredFiles.length} primitives, ${visibleTabs.length} tabs, ${baseline.dependencies.length + baseline.devDependencies.length} direct dependencies).`,
  )
}
