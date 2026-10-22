import test from 'node:test';
import assert from 'node:assert/strict';
import { fuelEconomy, safetyRatings, fuelMeasures, menuItems, starRating } from '../lib/enrichment.js';

const vehicle={ModelYear:'2003',Make:'HONDA',Model:'Accord'};
const response=value=>new Response(JSON.stringify(value));
const menu=items=>response({menuItem:items});
const car=id=>({id,year:'2003',make:'Honda',model:'Accord',fuelType1:'Regular Gasoline',city08:'19',highway08:'27',comb08:'22',displ:'3.0',cylinders:'6',trany:'Automatic 5-spd',drive:'Front-Wheel Drive'});
const options=[{text:'Auto, 6 cyl',value:'1'},{text:'Manual, 6 cyl',value:'2'}];
function epaFetch(overrides={}) {
  return async url=>{
    const path=new URL(url).pathname;
    if(overrides[path])return overrides[path]();
    if(path.endsWith('/menu/make'))return menu({text:'Honda',value:'Honda'});
    if(path.endsWith('/menu/model'))return menu({text:'Accord',value:'Accord'});
    if(path.endsWith('/menu/options'))return menu(options);
    return response(car(path.split('/').pop()));
  };
}

test('EPA menus normalize singleton and empty responses but reject malformed data',()=>{
  assert.equal(menuItems({menuItem:{text:'Honda',value:'Honda'}}).length,1);
  assert.deepEqual(menuItems({}),[]);
  assert.deepEqual(menuItems({menuItem:[]}),[]);
  assert.throws(()=>menuItems({wrong:'format'}));
});

test('EPA returns multiple configurations without assigning one to the VIN',async()=>{
  const result=await fuelEconomy(vehicle,epaFetch());
  assert.equal(result.status,'available');
  assert.equal(result.records.length,2);
  assert.match(result.match,/not confirmed/);
  assert.equal(result.records[0].measures[0].combined,22);
  assert.equal(result.records[0].url,'https://www.fueleconomy.gov/ws/rest/vehicle/1');
  assert.equal(result.requests.length,5);
});

test('EPA identity mismatch rejects the incorrect configuration and preserves a valid one',async()=>{
  const result=await fuelEconomy(vehicle,epaFetch({'/ws/rest/vehicle/2':()=>response({...car('2'),year:'2004'})}));
  assert.equal(result.status,'partial');
  assert.equal(result.count,2);
  assert.equal(result.records.length,1);
});

test('EPA absence, older coverage, and source errors have distinct status',async()=>{
  const absent=await fuelEconomy(vehicle,epaFetch({'/ws/rest/vehicle/menu/model':()=>menu({text:'Civic',value:'Civic'})}));
  assert.equal(absent.status,'available');
  assert.equal(absent.records.length,0);
  assert.match(absent.note,/No matching/);
  const old=await fuelEconomy({...vehicle,ModelYear:'1983'},()=>{throw new Error('Must not fetch');});
  assert.equal(old.status,'not-covered');
  const failed=await fuelEconomy(vehicle,async()=>new Response('Offline',{status:503}));
  assert.equal(failed.status,'unavailable');
});

test('EPA preserves gasoline MPG, electric MPGe, and separate PHEV fuel modes',()=>{
  assert.equal(fuelMeasures(car('1'))[0].unit,'MPG');
  const ev=fuelMeasures({fuelType1:'Electricity',comb08:'110',city08:'120',highway08:'99'})[0];
  assert.equal(ev.unit,'MPGe');assert.equal(ev.combined,110);
  const phev=fuelMeasures({fuelType1:'Regular Gasoline',fuelType2:'Electricity',comb08:'40',combA08:'100'});
  assert.equal(phev.length,2);assert.equal(phev[0].unit,'MPG');assert.equal(phev[1].unit,'MPGe');
  assert.equal(fuelMeasures({fuelType1:'Diesel',comb08:'-1',city08:'0'})[0].combined,null);
});

test('NHTSA not-rated and zero fields are never converted to a safety score',()=>{
  for(const value of ['Not Rated','0',0,'',null,undefined,'6']) assert.equal(starRating(value),null);
  assert.equal(starRating('5'),5);
});

const variant=(id,body)=>({VehicleId:id,VehicleDescription:`2003 Honda Accord ${body}`});
const rating=id=>({...variant(id,'2-DR.'),ModelYear:2003,Make:'HONDA',Model:'ACCORD',OverallRating:'Not Rated',OverallFrontCrashRating:'5',OverallSideCrashRating:'4',RolloverRating:'0',FrontCrashDriversideRating:'5'});
test('NHTSA ratings preserve variant identity, unrated values and individual-source failures',async()=>{
  const result=await safetyRatings(vehicle,async url=>url.includes('/modelyear/')?response({Results:[variant(1,'2-DR.'),variant(2,'4-DR.')]}):url.includes('/VehicleId/1')?response({Results:[rating(1)]}):new Response('',{status:503}));
  assert.equal(result.status,'partial');assert.equal(result.records.length,1);assert.equal(result.count,2);
  assert.equal(result.records[0].ratings.overall,null);assert.equal(result.records[0].ratings.front,5);
  assert.equal(result.records[0].ratings.rollover,null);
});

test('NHTSA wrong-vehicle detail is rejected and a valid empty variant list stays empty',async()=>{
  const wrong=await safetyRatings(vehicle,async url=>url.includes('/modelyear/')?response({Results:[variant(1,'2-DR.')]}):response({Results:[{...rating(1),Model:'CIVIC'}]}));
  assert.equal(wrong.status,'unavailable');assert.equal(wrong.records.length,0);
  const empty=await safetyRatings(vehicle,async()=>response({Results:[]}));
  assert.equal(empty.status,'available');assert.equal(empty.count,0);
});
