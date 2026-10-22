import test from 'node:test';
import assert from 'node:assert/strict';
import { research } from '../lib/research.js';

const vin='1HGCM82633A004352';
const decoded={Make:'HONDA',Model:'Accord',ModelYear:'2003',ErrorCode:'0'};
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const decoder=value=>json({Results:[value]});

test('invalid input never makes an upstream request',async()=>{
  for(const [input,year] of [['bad',''],[vin,'1900'],[vin,'2020&make=other']]) await assert.rejects(research(input,year,()=>{throw new Error('Must not fetch');}),error=>error.status===400);
});

test('successful source provenance, complete recalls, and complaint excerpt limit are retained',async()=>{
  const urls=[];
  const result=await research(vin,'2003',async url=>{
    urls.push(String(url));
    if(url.includes('vpic')) return decoder(decoded);
    if(url.includes('fueleconomy')) return json({menuItem:[]});
    if(url.includes('SafetyRatings')) return json({Results:[]});
    return json({results:url.includes('/recalls/')?[{NHTSACampaignNumber:'test'}]:Array.from({length:62},(_,i)=>({odiNumber:i,summary:'Allegation'}))});
  });
  assert.equal(urls.length,5);
  assert.ok(urls[0].includes('modelyear=2003'));
  assert.ok(urls[1].includes('modelYear=2003'));
  assert.equal(result.recalls.records.length,1);
  assert.equal(result.complaints.count,62);
  assert.equal(result.complaints.records.length,50);
  assert.ok(result.recalls.checkedAt);
  assert.equal(result.fuel.status,'available');
  assert.equal(result.ratings.status,'available');
});

test('empty results, source failure, and unchecked sources cannot collapse into the same state',async()=>{
  const partial=await research(vin,'',async url=>{
    if(url.includes('vpic')) return decoder(decoded);
    if(url.includes('/recalls/')) return json({results:[]});
    return new Response('Unavailable',{status:503});
  });
  assert.equal(partial.recalls.status,'available');
  assert.equal(partial.recalls.count,0);
  assert.equal(partial.complaints.status,'unavailable');
  assert.equal(partial.complaints.count,null);
  const incomplete=await research(vin,'',async()=>decoder({Make:'HONDA',ErrorCode:'7',ErrorText:'Incomplete VIN decode'}));
  assert.equal(incomplete.recalls.status,'not-checked');
  assert.equal(incomplete.recalls.count,null);
  assert.match(incomplete.warnings[0],/Incomplete/);
});

test('decode outage is an explicit error and malformed safety data is not an empty success',async()=>{
  await assert.rejects(research(vin,'',async()=>{throw new Error('offline');}),error=>error.status===502 && /unavailable/.test(error.message));
  const malformed=await research(vin,'',async url=>url.includes('vpic')?decoder(decoded):json({Message:'Unexpected'}));
  assert.equal(malformed.recalls.status,'unavailable');
  assert.equal(malformed.recalls.count,null);
});

test('year mismatch and decoder warnings remain visible',async()=>{
  const result=await research(vin,'2004',async url=>url.includes('vpic')?decoder({...decoded,ErrorCode:'1',ErrorText:'Check Digit does not calculate properly'}):json({results:[]}));
  assert.equal(result.warnings.length,2);
  assert.match(result.warnings.join(' '),/differs from the decoded year/);
});
