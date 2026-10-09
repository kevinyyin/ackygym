// Run: node src/legacyRoutes.check.js
import assert from 'node:assert/strict'
import { ROUTE_PATHS, LEGACY_REDIRECTS } from './legacyRoutes.js'

for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
  assert.ok(ROUTE_PATHS.includes(to), `${from} → ${to} targets a route that doesn't exist`)
  assert.ok(!(to in LEGACY_REDIRECTS), `${from} → ${to} is a redirect chain`)
  assert.ok(!ROUTE_PATHS.includes(from), `${from} is both legacy and live`)
}

console.log('legacyRoutes: ok')
