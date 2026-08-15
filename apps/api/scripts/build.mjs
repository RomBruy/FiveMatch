import { build } from 'esbuild'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

// Every real npm dependency stays external: sharp and pg ship native binaries and
// the AWS SDKs lazy-load files at runtime, none of which survive being inlined.
// Workspace packages are the deliberate exception — @fivematch/types resolves to
// raw TypeScript (its `main` is src/index.ts), so bundling it is what stops the
// compiled output from require()-ing a .ts file at runtime. The API imports real
// values from it (ErrorCode, the zod schemas, the frozen algorithm constants),
// so it cannot simply be dropped as type-only.
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
].filter((name) => !name.startsWith('@fivematch/'))

await build({
  entryPoints: ['src/index.ts'],
  // ESM output, and the .mjs extension is load-bearing: apps/api has no
  // "type": "module" (adding one would change how vitest and drizzle.config.ts
  // are loaded), so a dist/index.js would be treated as CommonJS. Emitting ESM
  // is what lets expo-server-sdk work at all — as CJS it broke twice, first on
  // require()-ing an ESM package and then on its internal import.meta.url.
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  // Picked up explicitly for the `paths` mapping, which is how both
  // '@fivematch/types' and its '/algorithm-constants' subpath resolve.
  tsconfig: 'tsconfig.json',
  external,
  logLevel: 'info',
})
