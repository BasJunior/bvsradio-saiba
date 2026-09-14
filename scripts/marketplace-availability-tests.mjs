import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the component's actual timezone conversion with browser Intl semantics.
const source = readFileSync(new URL('../src/components/MarketplaceAvailabilityDesk.tsx', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function zonedInputIso('), source.indexOf('\nfunction label('));
const code = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const context = vm.createContext({ Intl, Date });
vm.runInContext(code, context);
const convert = context.zonedInputIso;
assert.equal(convert('2027-01-15', '10:00', 'Africa/Harare'), '2027-01-15T08:00:00.000Z');
assert.equal(convert('2027-01-15', '10:00', 'Europe/Berlin'), '2027-01-15T09:00:00.000Z');
assert.equal(convert('2027-07-15', '10:00', 'Europe/Berlin'), '2027-07-15T08:00:00.000Z');
assert.equal(convert('2027-03-28', '02:30', 'Europe/Berlin'), '', 'DST nonexistent time must be rejected');
assert.equal(convert('2027-02-30', '10:00', 'UTC'), '', 'Invalid calendar date must be rejected');
assert.equal(convert('2027-01-15', '10:00', 'invalid/timezone'), '');
assert.equal(convert('', '', 'UTC'), '');
console.log('PASS: availability timezone conversion, DST gaps, invalid dates and zones');
