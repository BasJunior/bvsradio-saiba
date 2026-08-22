import assert from 'node:assert/strict'
import {
  SIGNUP_ROLES,
  isSignupRole,
  profileRoleForSignup,
} from '../src/lib/signup-roles.ts'

const expectedRoles = ['artist', 'producer', 'writer', 'show_creator', 'listener']
const roleValues = SIGNUP_ROLES.map((role) => role.value)

assert.deepEqual(roleValues, expectedRoles, 'beta signup cards changed order or membership unexpectedly')
assert.equal(new Set(roleValues).size, expectedRoles.length, 'signup roles must be unique')

for (const role of expectedRoles) {
  assert.equal(isSignupRole(role), true, `${role} should be accepted at signup`)
}

for (const invalid of ['', 'admin', 'administrator', 'editor', 'Producer', null, undefined]) {
  assert.equal(isSignupRole(invalid), false, `${String(invalid)} must not be accepted at signup`)
}

assert.equal(profileRoleForSignup('producer'), 'listener', 'producer keeps listener profile role plus is_producer')
assert.equal(profileRoleForSignup('artist'), 'artist')
assert.equal(profileRoleForSignup('writer'), 'writer')
assert.equal(profileRoleForSignup('show_creator'), 'show_creator')
assert.equal(profileRoleForSignup('listener'), 'listener')

console.log('signup role contract: ok')
