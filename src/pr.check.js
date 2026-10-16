// Run: node src/pr.check.js
import assert from 'node:assert/strict'
import { prTracker } from './pr.js'

const isPr = prTracker()
assert.equal(isPr(100, 5), true, 'first set is a PR')
assert.equal(isPr(100, 5), false, 'repeat is not')
assert.equal(isPr(100, 6), true, 'more reps at same weight')
assert.equal(isPr(80, 10), false, 'first time at a lighter weight is not')
assert.equal(isPr(80, 9), false, 'fewer reps is not')
assert.equal(isPr(80, 11), true, 'more reps at a lighter weight already lifted')
assert.equal(isPr(105, 1), true, 'heavier weight')

console.log('pr: ok')
