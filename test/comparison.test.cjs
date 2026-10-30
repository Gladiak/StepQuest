'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSimulator}=require('../lib/comparison-simulation.cjs');
const {createComparisonService}=require('../lib/comparison-service.cjs');
const {STAT_DEFINITIONS}=require('../lib/game-catalog.cjs');
const defaults=Object.fromEntries(Object.entries(STAT_DEFINITIONS).map(([k,v])=>[k,v.base]));
const context={level:430,stage:871,effects:{xpPercent:0,attackPercent:0},rules:{encounter_steps:25,exchange_steps:50,exchange_coins:20}};
const screenshot={...defaults,health:18341,attack:10068.02,defense:7591.14,critical:60,critical_damage:300,dodge:35,life_steal:15,xp_bonus:52};
const candidate={...screenshot,health:20007,attack:9924.59,defense:7843.64,critical_damage:291,dodge:9,life_steal:0,xp_bonus:0};

test('comparison: screenshot regression values XP and sustain instead of recommending extra health',()=>{
 const result=createSimulator().evaluate({before:screenshot,after:candidate,context});
 assert.equal(result.recommendation,'worse');assert.equal(result.arrows,0);
 assert.ok(result.metrics.after.xpPer100Steps<result.metrics.before.xpPer100Steps);
});
test('comparison: life steal and dodge retain value when armor already reduces hits to one damage',()=>{
 const before={...defaults,health:1000,attack:90,defense:50000,life_steal:15,dodge:35};
 const reference={...context,level:45,stage:45};
 const simulator=createSimulator();
 for(const after of [{...before,life_steal:0},{...before,dodge:0}]){
  const result=simulator.evaluate({before,after,context:reference});
  assert.ok(result.metrics.after.restCoins>result.metrics.before.restCoins);
  assert.notEqual(result.recommendation,'better');
 }
});
test('comparison: identical effective stats need no sampling; order/cache do not change results',()=>{
 const simulator=createSimulator();assert.equal(simulator.evaluate({before:screenshot,after:{...screenshot},context}).samples,0);
 const input={before:screenshot,after:candidate,context},first=simulator.evaluate(input);
 simulator.evaluate({before:candidate,after:screenshot,context});assert.deepEqual(simulator.evaluate(input),first);
 assert.deepEqual(createSimulator().evaluate(input),first);
});
test('comparison: neither a stalemate nor dying faster is recommended as a speed improvement',()=>{
 const before={...defaults,health:1000000,attack:1,defense:50000,regeneration:1000};
 const result=createSimulator().evaluate({before,after:{...before,health:100},context});
 assert.equal(result.recommendation,'same');assert.equal(result.reason,'unresolved');assert.equal(result.arrows,0);
});
test('comparison worker: computation leaves the event loop responsive and reuses completed results',async t=>{
 const service=createComparisonService();t.after(()=>service.close());
 const input={before:screenshot,after:candidate,context};
 const pending=service.assess(input),duplicate=service.assess(input);assert.equal(pending,duplicate);
 const first=await Promise.race([pending.then(()=> 'worker'),new Promise(resolve=>setTimeout(()=>resolve('timer'),0))]);assert.equal(first,'timer');
 const result=await pending;assert.equal(result.recommendation,'worse');
 assert.deepEqual(await service.assess(input),result);assert.equal(service.diagnostics().cacheEntries,1);assert.equal(service.diagnostics().pending,0);
});
test('comparison worker: unexpected worker exit rejects pending work and a subsequent request restarts it',async t=>{
 const {Worker}=require('node:worker_threads');let worker;
 const service=createComparisonService({workerFactory:()=>worker=new Worker(require.resolve('../lib/comparison-worker.cjs'))});t.after(()=>service.close());
 const input={before:screenshot,after:candidate,context},pending=service.assess(input),rejected=assert.rejects(pending,/interrotto/);
 await worker.terminate();await rejected;
 assert.equal((await service.assess(input)).recommendation,'worse');
});
test('comparison worker: closing with pending work cancels it without leaving an unresolved promise',async()=>{
 const service=createComparisonService(),pending=service.assess({before:screenshot,after:candidate,context});
 const rejected=assert.rejects(pending,/chiuso/);service.close();await rejected;
 await assert.rejects(service.assess({before:screenshot,after:candidate,context}),/chiuso/);
});
test('comparison worker: a timeout clears pending work and queue growth is bounded',async()=>{
 const {Worker}=require('node:worker_threads');
 const service=createComparisonService({timeoutMs:30,maxQueue:2,workerFactory:()=>new Worker("require('node:worker_threads').parentPort.on('message',()=>{});",{eval:true})});
 const input={before:screenshot,after:candidate,context};
 const first=service.assess(input),second=service.assess({...input,context:{...context,level:431}}),third=service.assess({...input,context:{...context,level:432}});
 const settled=Promise.allSettled([first,second,third]);
 await assert.rejects(service.assess({...input,context:{...context,level:433}}),/attesa/);
 assert.equal(service.diagnostics().queued,2);
 const results=await settled;assert.ok(results.every(r=>r.status==='rejected'));assert.equal(service.diagnostics().pending,0);service.close();
});
