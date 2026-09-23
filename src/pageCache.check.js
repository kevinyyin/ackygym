// Run: node src/pageCache.check.js
import assert from 'node:assert/strict'
import { cacheRead, cacheWrite, clearPageCache } from './pageCache.js'

assert.deepEqual(cacheRead('a', 'fallback'), { hit: false, value: 'fallback' })
cacheWrite('a', [1, 2])
assert.deepEqual(cacheRead('a', 'fallback'), { hit: true, value: [1, 2] })
cacheWrite('a', [])
assert.deepEqual(cacheRead('a', 'fallback'), { hit: true, value: [] }, 'empty results are still a hit')
clearPageCache()
assert.deepEqual(cacheRead('a', 'fallback'), { hit: false, value: 'fallback' })

console.log('pageCache: ok')
