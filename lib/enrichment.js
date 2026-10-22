const EPA = 'https://www.fueleconomy.gov/ws/rest';
const NHTSA = 'https://api.nhtsa.gov/SafetyRatings';
const normalized = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

async function json(url, fetchImpl, signal) {
  const response = await fetchImpl(url, { headers:{Accept:'application/json'}, signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]) });
  if (!response.ok) throw new Error('Source unavailable');
  return response.json();
}

export function menuItems(data) {
  if (data && Object.keys(data).length === 0) return [];
  if (!data || !Object.hasOwn(data,'menuItem')) throw new Error('Unexpected menu format');
  if (data.menuItem === null || data.menuItem === '') return [];
  const items = Array.isArray(data.menuItem) ? data.menuItem : [data.menuItem];
  if (items.some(item => !item || typeof item.text !== 'string' || !['string','number'].includes(typeof item.value))) throw new Error('Invalid menu items');
  return items;
}

export function fuelMeasures(record) {
  const measure = (fuel, city, highway, combined) => ({
    fuel,
    unit: /electricity|natural gas|cng/i.test(fuel) ? 'MPGe' : 'MPG',
    city:positive(city), highway:positive(highway), combined:positive(combined)
  });
  const measures = [measure(record.fuelType1 || record.fuelType || 'Fuel not supplied',record.city08,record.highway08,record.comb08)];
  if (record.fuelType2) measures.push(measure(record.fuelType2,record.cityA08,record.highwayA08,record.combA08));
  return measures;
}

export function starRating(value) { return /^[1-5]$/.test(String(value)) ? Number(value) : null; }

function source(name,url) { return {name,url,checkedAt:new Date().toISOString(),status:'available',count:0,records:[],truncated:false}; }
function unavailable(result) { return {...result,status:result.records.length ? 'partial' : 'unavailable',error:'Some source data could not be retrieved. Retry to refresh.',count:result.count || null}; }

export async function fuelEconomy(vehicle, fetchImpl = fetch) {
  const result=source('EPA / DOE FuelEconomy.gov','https://www.fueleconomy.gov/feg/findacar.shtml');
  result.match='model configurations; exact VIN configuration not confirmed';
  result.requests=[];
  const signal=AbortSignal.timeout(28000);
  const get = async url => { result.requests.push(url); return json(url,fetchImpl,signal); };
  if (Number(vehicle.ModelYear)<1984) return {...result,status:'not-covered',note:'EPA vehicle data start with model year 1984.'};
  try {
    const makes=menuItems(await get(`${EPA}/vehicle/menu/make?${new URLSearchParams({year:vehicle.ModelYear})}`));
    const make=makes.find(item=>normalized(item.text)===normalized(vehicle.Make));
    if (!make) return {...result,note:'No matching make was returned for this model year.'};
    const models=menuItems(await get(`${EPA}/vehicle/menu/model?${new URLSearchParams({year:vehicle.ModelYear,make:make.value})}`));
    const exact=models.filter(item=>normalized(item.text)===normalized(vehicle.Model));
    // Only use explicit model-name extensions when there is no exact model label.
    const candidates=exact.length ? exact : models.filter(item=>item.text.toLowerCase().startsWith(`${vehicle.Model.toLowerCase()} `));
    if (!candidates.length) return {...result,note:'No matching EPA model name was found. No alternative model was substituted.'};
    result.matchedModels=candidates.map(item=>item.text);
    const selectedModels=candidates.slice(0,4);
    let failed=false;
    const optionGroups=await Promise.all(selectedModels.map(async model=>{
      try { return menuItems(await get(`${EPA}/vehicle/menu/options?${new URLSearchParams({year:vehicle.ModelYear,make:make.value,model:model.value})}`)).map(item=>({...item,model:model.text})); }
      catch { failed=true; return []; }
    }));
    const options=[...new Map(optionGroups.flat().map(item=>[String(item.value),item])).values()];
    result.count=options.length;
    result.truncated=candidates.length>4 || options.length>12;
    // A small worker pool keeps a single lookup from flooding the public API.
    const selected=options.slice(0,12);
    let next=0;
    const rows=Array(selected.length);
    await Promise.all(Array.from({length:Math.min(3,selected.length)},async()=>{
      while(next<selected.length) {
        const index=next++; const option=selected[index];
        try {
          if (!/^\d+$/.test(String(option.value))) throw new Error('Invalid EPA ID');
          const url=`${EPA}/vehicle/${option.value}`;
          const record=await get(url);
          if (String(record.id)!==String(option.value) || normalized(record.make)!==normalized(make.text) || normalized(record.model)!==normalized(option.model) || String(record.year)!==String(vehicle.ModelYear)) throw new Error('EPA identity mismatch');
          rows[index]={id:String(record.id),description:option.text,model:record.model,engine:record.displ ? `${record.displ} L${record.cylinders ? `, ${record.cylinders} cylinders` : ''}` : record.evMotor || 'Not supplied',transmission:record.trany || 'Not supplied',drive:record.drive || 'Not supplied',measures:fuelMeasures(record),electricRange:positive(record.fuelType1==='Electricity' ? record.range : record.fuelType2==='Electricity' ? record.rangeA : null),electricity:positive(record.combE),url,sourceUrl:`https://www.fueleconomy.gov/feg/noframes/${record.id}.shtml`};
        } catch { failed=true; }
      }
    }));
    result.records=rows.filter(Boolean);
    return failed ? unavailable(result) : result;
  } catch { return unavailable(result); }
}

export async function safetyRatings(vehicle, fetchImpl = fetch) {
  const url=`${NHTSA}/modelyear/${encodeURIComponent(vehicle.ModelYear)}/make/${encodeURIComponent(vehicle.Make)}/model/${encodeURIComponent(vehicle.Model)}?format=json`;
  const result=source('NHTSA 5-Star Safety Ratings',url);
  result.match='model variants; exact VIN configuration not confirmed';
  const signal=AbortSignal.timeout(28000);
  try {
    const data=await json(url,fetchImpl,signal);
    if (!Array.isArray(data.Results)) throw new Error('Unexpected safety response');
    result.count=data.Results.length;
    result.truncated=result.count>12;
    let failed=false;let next=0;
    const variants=data.Results.slice(0,12);const rows=Array(variants.length);
    await Promise.all(Array.from({length:Math.min(3,variants.length)},async()=>{
      while(next<variants.length) {
        const index=next++;const variant=variants[index];
        try {
          if (!/^\d+$/.test(String(variant.VehicleId))) throw new Error('Invalid safety ID');
          const recordUrl=`${NHTSA}/VehicleId/${variant.VehicleId}?format=json`;
          const details=await json(recordUrl,fetchImpl,signal);
          const record=details.Results?.[0];
          if (!record || String(record.VehicleId)!==String(variant.VehicleId) || String(record.ModelYear)!==String(vehicle.ModelYear) || normalized(record.Make)!==normalized(vehicle.Make) || normalized(record.Model)!==normalized(vehicle.Model)) throw new Error('Safety identity mismatch');
          rows[index]={id:variant.VehicleId,description:record.VehicleDescription || variant.VehicleDescription,url:recordUrl,ratings:{overall:starRating(record.OverallRating),front:starRating(record.OverallFrontCrashRating),side:starRating(record.OverallSideCrashRating),rollover:starRating(record.RolloverRating),frontDriver:starRating(record.FrontCrashDriversideRating),frontPassenger:starRating(record.FrontCrashPassengersideRating)}};
        } catch { failed=true; }
      }
    }));
    result.records=rows.filter(Boolean);
    if (!result.count) result.note='No tested variants were returned for this year, make, and model.';
    return failed ? unavailable(result) : result;
  } catch { return unavailable(result); }
}
