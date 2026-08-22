import assert from 'node:assert/strict'
import fs from 'node:fs'

const pulse = fs.readFileSync('src/app/api/pulse/route.ts', 'utf8')
const showFollow = fs.readFileSync('src/components/ShowFollowButton.tsx', 'utf8')

assert.match(showFollow, /const id = `show-\$\{slug\}`/, 'Show follows must keep their canonical show-<slug> id')
assert.match(showFollow, /kind: 'show'/, 'Show follows must remain typed as show objects')
assert.match(showFollow, /href: `\/shows\/\$\{slug\}`/, 'Show follows must keep their public programme route')

assert.match(pulse, /type FollowedTargets = \{[\s\S]*creators: Set<string>;[\s\S]*shows: Set<string>;/, 'Pulse must track creator and show follows separately')
assert.match(pulse, /function followedShowSlug\(/, 'Pulse must decode saved show follows')
assert.match(pulse, /showSlugFromRoute\(String\(item\.href \|\| ""\)\)/, 'Pulse should prefer the canonical saved show route')
assert.match(pulse, /id\.startsWith\("show-"\) \? id\.slice\(5\)/, 'Pulse must support the show-<slug> id fallback')
assert.match(pulse, /row\.subject_kind !== "show"/, 'Follow matching must preserve non-show creator behavior')
assert.match(pulse, /followed\.shows\.has\(slug\)/, 'Show activity must match followed programme slugs')
assert.match(pulse, /rows\.filter\(\(row\) => matchesFollow\(row, followed\)\)/, 'Following scope must prioritize all followed object types')
assert.match(pulse, /reason: matchesFollow\(row, followed\)[\s\S]*\? "following"/, 'Matched show events must be labelled as following')
assert.match(pulse, /followed\.creators\.size \|\| followed\.shows\.size[\s\S]*\? "following"/, 'Pulse scope must recognize show-only follows')

console.log('flow pulse show-follow contract: ok')
