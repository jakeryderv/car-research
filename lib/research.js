import { validateVin } from '../public/domain.js';
import { fuelEconomy, safetyRatings } from './enrichment.js';

const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
const API = 'https://api.nhtsa.gov';

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(18000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}. Try again later.`);
  const data = await response.json();
  return data;
}

async function safetySource(url, name, fetchImpl) {
  const checkedAt = new Date().toISOString();
  try {
    const data = await getJson(url, fetchImpl);
    if (!Array.isArray(data.results)) throw new Error('Source returned an unexpected format.');
    return { name, url, checkedAt, status: 'available', count: data.results.length, records: data.results };
  } catch (error) {
    return { name, url, checkedAt, status: 'unavailable', count: null, records: [], error: error.name === 'TimeoutError' ? 'Source timed out. Try again later.' : 'Source could not be retrieved. Try again later.' };
  }
}

export async function research(input, year = '', fetchImpl = fetch) {
  const check = validateVin(input);
  if (!check.valid) throw Object.assign(new Error(check.message), { status: 400 });
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1981 || Number(year) > new Date().getFullYear() + 2)) throw Object.assign(new Error('Use a model year from 1981 through the next two years.'), { status: 400 });
  const decodeUrl = `${VPIC}${check.vin}?format=json${year ? `&modelyear=${year}` : ''}`;
  let decoded;
  try {
    const data = await getJson(decodeUrl, fetchImpl);
    decoded = data.Results?.[0];
    if (!decoded || typeof decoded !== 'object') throw new Error('Unexpected response');
  } catch {
    throw Object.assign(new Error('NHTSA VIN decoding is unavailable right now. Please retry shortly. No history conclusion can be drawn from this failure.'), { status: 502 });
  }
  const fields = ['Make','Model','ModelYear','Trim','Series','BodyClass','DriveType','FuelTypePrimary','EngineModel','EngineCylinders','DisplacementL','TransmissionStyle','PlantCountry','PlantCity','Manufacturer','VehicleType'];
  const vehicle = Object.fromEntries(fields.map(key => [key, decoded[key] || '']));
  const warnings = [check.warning];
  if (decoded.ErrorCode && decoded.ErrorCode !== '0') warnings.push(decoded.ErrorText || `NHTSA decoder reported codes ${decoded.ErrorCode}. Verify the vehicle identity.`);
  if (year && vehicle.ModelYear && year !== vehicle.ModelYear) warnings.push('The supplied model year differs from the decoded year. Verify the seller’s listing.');
  const canMatch = vehicle.Make && vehicle.Model && vehicle.ModelYear;
  const query = new URLSearchParams({ make: vehicle.Make, model: vehicle.Model, modelYear: vehicle.ModelYear });
  const missing = name => ({ name, status: 'not-checked', count: null, records: [], error: 'The decoder did not return a complete year, make, and model.' });
  const [recalls, complaints, fuel, ratings] = canMatch ? await Promise.all([
    safetySource(`${API}/recalls/recallsByVehicle?${query}`, 'NHTSA model recalls', fetchImpl),
    safetySource(`${API}/complaints/complaintsByVehicle?${query}`, 'NHTSA model complaints', fetchImpl),
    fuelEconomy(vehicle,fetchImpl),
    safetyRatings(vehicle,fetchImpl)
  ]) : [missing('NHTSA model recalls'), missing('NHTSA model complaints'), missing('EPA / DOE FuelEconomy.gov'), missing('NHTSA 5-Star Safety Ratings')];
  // Keep all recall campaigns. Limit complaint excerpts without hiding the returned count.
  complaints.records = complaints.records.slice(0, 50);
  return { vin: check.vin, checkedAt: new Date().toISOString(), vehicle, warnings: warnings.filter(Boolean), decode: { name: 'NHTSA vPIC', status: 'available', url: decodeUrl, checkedAt: new Date().toISOString() }, recalls, complaints, fuel, ratings };
}
