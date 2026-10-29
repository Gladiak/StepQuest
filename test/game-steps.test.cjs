'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createStepsRepository,scopeForKey}=require('../lib/steps-repository.cjs');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
const {createStepsService}=require('../lib/steps-service.cjs');
const {createGameStepsService}=require('../lib/game-steps-service.cjs');
const {dateRange}=require('../lib/dates.cjs');
const {GarminError}=require('../lib/garmin.cjs');
const key='fixture-import',scope=scopeForKey(key),range={from:'2026-10-29',to:'2026-10-29'};
const snapshot=(from,to,steps)=>({from,to,fetchedAt:'2026-10-29T12:00:00Z',days:dateRange(from,to).map(date=>({date,steps,goal:null,distanceMeters:null}))});
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-import-')),file=path.join(dir,'game.sqlite');
 const repository=createStepsRepository(file),characters=createCharactersRepository(file),game=createGameRepository(file,{rng:()=>.5}),sql=new DatabaseSync(file);
 const hero=characters.create({name:'Thorin',classId:'guardian',sex:'male'});let selected=hero.id,day='2026-10-29';
 t.after(()=>{game.close();sql.close();characters.close();repository.close();fs.rmSync(dir,{recursive:true,force:true});});
 const service=client=>createGameStepsService({game,repository,stepsService:createStepsService({repository,client,apiKey:key}),actor:()=>selected,today:()=>day});
 return {file,repository,characters,game,sql,hero,service,select:id=>{selected=id;},setDay:value=>{day=value;}};
}
test('import giornaliero: solo oggi, incrementi rispetto all’ultimo accredito anche dopo aver speso passi',async t=>{
 const f=fixture(t);let steps=100;const calls=[];
 f.repository.save(scope,snapshot('2026-10-28','2026-10-28',900));
 const service=f.service({getSteps:async(from,to)=>{calls.push({from,to});return snapshot(from,to,steps);}});
 let result=await service.sync();assert.equal(result.hero.steps,100);assert.equal(result.stepsImport.credited,100);assert.equal(result.stepsImport.dailyTotal,100);
 result=await service.sync();assert.equal(result.hero.steps,100);assert.equal(result.stepsImport.credited,0);
 f.game.exchange(f.hero.id,100);
 steps=150;result=await service.sync();assert.equal(result.hero.steps,50);assert.equal(result.stepsImport.credited,50);
 steps=80;result=await service.sync();assert.equal(result.hero.steps,50);assert.equal(result.stepsImport.credited,0);
 steps=160;result=await service.sync();assert.equal(result.hero.steps,60);assert.equal(result.stepsImport.credited,10);
 assert.ok(calls.every(call=>call.from==='2026-10-29'&&call.to==='2026-10-29'));
 assert.equal(f.sql.prepare("SELECT count(*) n FROM step_claims WHERE calendar_date='2026-10-28'").get().n,0);
});
test('import giornaliero: a mezzanotte usa la nuova data senza recuperare giorni precedenti',async t=>{
 const f=fixture(t),calls=[],service=f.service({getSteps:async(from,to)=>{calls.push({from,to});return snapshot(from,to,100);}});
 assert.equal((await service.sync()).hero.steps,100);f.setDay('2026-10-30');
 assert.equal((await service.sync()).hero.steps,200);assert.equal((await service.sync()).stepsImport.credited,0);
 assert.deepEqual(calls,[range,{from:'2026-10-30',to:'2026-10-30'},{from:'2026-10-30',to:'2026-10-30'}]);
});
test('import giornaliero: zero e assenza di dati non creano accrediti',async t=>{
 const f=fixture(t);let steps=null;
 const service=f.service({getSteps:async(from,to)=>snapshot(from,to,steps)});
 let result=await service.sync();assert.equal(result.stepsImport.credited,0);assert.equal(result.stepsImport.dailyTotal,null);assert.equal(result.stepsImport.totalDays,1);
 steps=0;result=await service.sync();assert.equal(result.stepsImport.dailyTotal,0);assert.equal(result.hero.steps,0);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM wallet_events').get().n,0);
});
test('import giornaliero: intervalli forniti dal renderer rifiutati prima della rete',async t=>{
 const f=fixture(t);let calls=0;const service=f.service({getSteps:async()=>{calls++;}});
 for(const input of [null,{},'bad',range,{from:'2026-10-28',to:'2026-10-29'}])await assert.rejects(service.sync(input),e=>e.code==='INVALID_DATE');
 assert.equal(calls,0);assert.equal(f.game.state(f.hero.id).hero.steps,0);
});
test('import: offline recupera solo la cache di oggi; senza cache non inventa un successo',async t=>{
 const f=fixture(t),service=f.service({getSteps:async()=>{throw new GarminError('NETWORK','Rete assente.');}});
 await assert.rejects(service.sync(),e=>e.code==='NETWORK');
 f.repository.save(scope,snapshot(range.from,range.from,400));
 const result=await service.sync();assert.equal(result.hero.steps,400);assert.equal(result.stepsImport.offline,true);assert.equal(result.stepsImport.storedDays,1);assert.equal(result.stepsImport.totalDays,1);
 assert.equal((await service.sync()).stepsImport.credited,0);
});
test('import: cambio eroe durante il download conserva l’archivio senza assegnare i passi',async t=>{
 const f=fixture(t),other=f.characters.create({name:'Elara',classId:'ranger',sex:'female'});
 const service=f.service({getSteps:async(from,to)=>{f.select(other.id);return snapshot(from,to,300);}});
 await assert.rejects(service.sync(),/Personaggio cambiato/);
 assert.equal(f.repository.read(scope,range.from,range.to).cache.storedDays,1);
 assert.equal(f.game.state(f.hero.id).hero.steps,0);assert.equal(f.game.state(other.id).hero.steps,0);
 assert.equal(f.game.claimSteps(other.id,scope).hero.steps,300);assert.throws(()=>f.game.claimSteps(f.hero.id,scope));
});
test('import: accredito fallito fa rollback dei riscatti e può essere recuperato offline',async t=>{
 const f=fixture(t),service=f.service({getSteps:async(from,to)=>snapshot(from,to,200)});
 f.sql.exec("CREATE TRIGGER reject_claim BEFORE INSERT ON wallet_events BEGIN SELECT RAISE(ABORT,'rollback'); END");
 await assert.rejects(service.sync());assert.equal(f.game.state(f.hero.id).hero.steps,0);assert.equal(f.sql.prepare('SELECT count(*) n FROM step_claims').get().n,0);
 f.sql.exec('DROP TRIGGER reject_claim');
 const offline=f.service({getSteps:async()=>{throw new GarminError('NETWORK','Rete assente.');}});
 assert.equal((await offline.sync()).stepsImport.credited,200);
});

test('import giornaliero: una nuova sessione conserva il totale già accreditato',async t=>{
 const f=fixture(t),client={getSteps:async(from,to)=>snapshot(from,to,300)};
 assert.equal((await f.service(client).sync()).stepsImport.credited,300);
 const nextGame=createGameRepository(f.file,{rng:()=>.5});
 try{
  const service=createGameStepsService({game:nextGame,repository:f.repository,stepsService:createStepsService({repository:f.repository,client,apiKey:key}),actor:()=>f.hero.id,today:()=>'2026-10-29'});
  const result=await service.sync();assert.equal(result.stepsImport.credited,0);assert.equal(result.hero.steps,300);
 }finally{nextGame.close();}
});
