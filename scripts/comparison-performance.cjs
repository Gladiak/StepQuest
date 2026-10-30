'use strict';
// Synthetic saves only. Reports measured latency, not hardware-independent limits.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
const {createComparisonService}=require('../lib/comparison-service.cjs');
const {generateItem,insertItem}=require('../lib/game-items.cjs');
const C=require('../lib/game-catalog.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sq-comparison-perf-')),rows=[];
 try{
  for(const worst of [false,true]){
   const file=path.join(directory,worst?'stalled.sqlite':'normal.sqlite'),chars=createCharactersRepository(file),hero=chars.create({name:'PerfHero',classId:'guardian',sex:'male'}),game=createGameRepository(file,{rng:()=>.5}),db=new DatabaseSync(file),service=createComparisonService();
   try{
    game.state(hero.id);
    if(worst){
     db.prepare('UPDATE hero_progress SET level=430,stage=871 WHERE character_id=?').run(hero.id);
     const amulet=generateItem(C.TEMPLATES.find(t=>t.id==='amulet-0'));amulet.baseStats={attack:-861,health:1000000,defense:50000,regeneration:1000};amulet.rolls=[];insertItem(db,hero.id,amulet);game.equip(hero.id,{itemId:amulet.id,slot:'amulet'});
    }
    db.exec('BEGIN');for(let n=0;n<2000;n++){const item=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'));item.baseStats={attack:8+n%37};insertItem(db,hero.id,item);}db.exec('COMMIT');
    let start=performance.now();const state=game.state(hero.id),stateMs=performance.now()-start;
    const itemIds=state.inventory.filter(item=>!item.equippedSlot&&!item.effect).slice(0,12).map(item=>item.id);
    start=performance.now();const batch=game.comparisonInput(hero.id,{context:state.comparisonContext,itemIds}),inputMs=performance.now()-start;
    const jobs=batch.items.flatMap(item=>item.comparisons.filter(c=>c.eligible&&!c.equipped).map(c=>c.input));
    let heartbeat=0;const timer=setInterval(()=>heartbeat++,1);
    start=performance.now();const results=await Promise.all(jobs.map(input=>service.assess(input))),coldMs=performance.now()-start;clearInterval(timer);
    start=performance.now();await Promise.all(jobs.map(input=>service.assess(input)));const cachedMs=performance.now()-start;
    assert.ok(heartbeat>0,'worker calculation must leave the event loop responsive');assert.equal(results.length,12);assert.equal(service.diagnostics().pending,0);
    rows.push({case:worst?'250-turn stalemates':'short encounters',inventory:state.inventory.length,visible:12,stateMs:+stateMs.toFixed(2),inputMs:+inputMs.toFixed(2),workerColdMs:+coldMs.toFixed(2),workerCachedMs:+cachedMs.toFixed(2),heartbeat,cacheEntries:service.diagnostics().cacheEntries});
   }finally{service.close();game.close();db.close();chars.close();}
  }
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/comparison-performance.json'),JSON.stringify({runtime:process.version,rows},null,2)+'\n');console.log(JSON.stringify(rows));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
