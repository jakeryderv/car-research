import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVin } from '../public/domain.js';

test('VIN normalization, forbidden letters and check-digit mismatch stay distinct', () => {
  assert.deepEqual(validateVin(' 1hgcm82633a004352 '),{valid:true,vin:'1HGCM82633A004352',warning:''});
  assert.equal(validateVin('1HGCM82633A00435I').valid,false);
  assert.equal(validateVin('1HGCM82633A00435').valid,false);
  assert.equal(validateVin('1HGCM82633A004353').valid,true);
  assert.match(validateVin('1HGCM82633A004353').warning,/check digit/);
});
