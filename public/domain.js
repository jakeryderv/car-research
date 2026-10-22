export function normalizeVin(input) {
  return String(input ?? '').trim().toUpperCase();
}

export function validateVin(input) {
  const vin = normalizeVin(input);
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return { valid: false, vin, message: 'Enter a 17-character VIN. VINs do not contain I, O, or Q.' };
  }
  const codes = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  const sum = [...vin].reduce((n, c, i) => n + (codes[c] ?? Number(c)) * weights[i], 0);
  const expected = sum % 11 === 10 ? 'X' : String(sum % 11);
  return { valid: true, vin, warning: vin[8] === expected ? '' : 'VIN check digit does not match. Recheck the VIN on the car and title; decoding may be incomplete.' };
}
