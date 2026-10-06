import assert from 'node:assert/strict';
import { creatorGrowth, creatorGrowthAccess, promotionCaption } from '../src/lib/creator-growth.ts';
for (const profile of [{ role: 'artist', is_producer: true }, { role: 'admin', is_producer: true }, { role: 'admin' }]) {
  assert.equal(creatorGrowthAccess(profile, 'producer').role, 'producer');
  assert.equal(creatorGrowthAccess(profile, 'artist').role, 'artist');
}
assert.equal(creatorGrowthAccess({ role: 'listener', is_producer: true }, 'artist').role, 'producer');
assert.equal(creatorGrowthAccess({ role: 'artist' }, 'producer').role, 'artist');
assert.equal(creatorGrowthAccess({ role: 'show_creator' }, 'artist').role, 'show_creator');
assert.equal(creatorGrowthAccess({ role: 'artist', is_producer: true }, 'unknown').role, 'artist');
const zero = { live: 0, promotions: 0, listeners: 0, sales: 0, activeWeeks: 0 };
assert.equal(creatorGrowth(zero,'artist').current.name,'Launch');
assert.equal(creatorGrowth(zero,'artist').current.stars,0);
const launch = { live: 1, promotions: 1, listeners: 10, sales: 1, activeWeeks: 2 };
assert.equal(creatorGrowth(launch,'artist').current.name,'Momentum');
assert.deepEqual(creatorGrowth(launch,'artist').completed,['Launch']);
assert.equal(creatorGrowth({...launch, sales: 0},'artist').current.name,'Launch');
assert.equal(creatorGrowth({...launch, listeners: 9},'artist').current.name,'Launch');
assert.equal(creatorGrowth({...launch, activeWeeks: 1},'artist').current.name,'Launch');
assert.equal(creatorGrowth({...launch, listeners: 0},'producer').current.name,'Momentum');
assert.equal(creatorGrowth({...launch, listeners: 0, sales: 0},'show_creator').current.name,'Momentum');
const all = { live: 5, promotions: 5, listeners: 1000, sales: 10, activeWeeks: 8 };
assert.equal(creatorGrowth(all,'artist').current,null);
assert.equal(creatorGrowth(all,'artist').rewardStatus,'not_launched');
assert.match(promotionCaption({id:'x',kind:'beat',title:'Example',path:'/beat/x'}),/buy your beat licence/);
assert.match(promotionCaption({id:'x',kind:'track',title:'Example',path:'/song/x'}),/Listen, save/);
console.log('Creator growth: progression, role goals, partial completion and no automatic cash reward passed.');
