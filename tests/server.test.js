import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.js';

async function fixture(t,fn){
  const server=createApp(fn);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const complete={recalls:{status:'available'},complaints:{status:'available'},fuel:{status:'available'},ratings:{status:'available'}};

test('only public assets are served and writes are rejected',async t=>{
  const base=await fixture(t,()=>complete);
  const home=await fetch(base);
  assert.equal(home.status,200);
  assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.match(await home.text(),/Get to know the car/);
  for(const path of ['/server.js','/LICENSE','/.git/config','/docs/plan.md']) assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/api/research',{method:'POST'})).status,405);
});

test('fully successful repeated lookups are cached; partial results can be retried',async t=>{
  let calls=0;
  const base=await fixture(t,async vin=>{calls++;return vin==='partial'?{...complete,complaints:{status:'unavailable'}}:complete;});
  for(let i=0;i<2;i++) await fetch(base+'/api/research?vin=complete');
  assert.equal(calls,1);
  for(let i=0;i<2;i++) await fetch(base+'/api/research?vin=partial');
  assert.equal(calls,3);
});

test('source error status and actionable message survive the HTTP boundary',async t=>{
  const base=await fixture(t,async()=>{throw Object.assign(new Error('NHTSA is unavailable'),{status:502});});
  const response=await fetch(base+'/api/research?vin=test');
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'NHTSA is unavailable'});
});
