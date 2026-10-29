'use strict';
// Dati temporanei e semi fissi: nessun accesso ai salvataggi o a Garmin.
const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createStepsRepository}=require('../lib/steps-repository.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const {generateItem,insertItem,rollItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
let balance;try{balance=require('../lib/combat-balance.cjs');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const samples=100,dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-combat-audit-'));
const report={samplesPerScenario:samples,gear:'arma e armatura comuni del livello, senza affissi',strategy:'attacchi automatici, vita piena, nessun consumabile',depthPolicy:'profondità pari al livello oppure doppia; il corredo comune resta del livello dell’eroe',rows:[],drops:[]};
function seeded(seed){return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);}
try{for(const cls of Object.keys(C.CLASSES)){
 const file=path.join(dir,cls+'.sqlite'),steps=createStepsRepository(file),characters=createCharactersRepository(file),sql=new DatabaseSync(file);let rng=seeded(1);
 const game=createGameRepository(file,{rng:()=>rng()});
 try{for(const level of [1,4,8,15]){
  const hero=characters.create({name:'Viandante',classId:cls,sex:'male'});game.state(hero.id);
  sql.prepare('UPDATE hero_progress SET level=? WHERE character_id=?').run(level,hero.id);
  if(level>1)for(const slot of ['weapon','body']){const template=C.TEMPLATES.find(t=>!t.starter&&!t.set_id&&t.class_id===cls&&t.slot===slot);const item=generateItem(template,{level,rng:seeded(42)});insertItem(sql,hero.id,item);game.equip(hero.id,{itemId:item.id,slot});}
  for(const depthMultiplier of [1,2])for(const difficulty of ['easy','normal','elite']){
   const depth=level*depthMultiplier;let won=0,rounds=0,health=0,drops=0;
   for(let sample=0;sample<samples;sample++){
    rng=seeded(1000+sample);sql.prepare('UPDATE hero_progress SET xp=0,level=?,stage=?,hp=1000000 WHERE character_id=?').run(level,depth,hero.id);sql.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id);game.rest(hero.id);
    const state=game.startAutoBattle(hero.id,{difficulty,requestId:require('node:crypto').randomUUID()});won+=state.battle.status==='won';rounds+=state.battle.round;health+=state.hero.hp/state.hero.stats.health*100;drops+=state.battle.rewards?.drops.length||0;
    sql.prepare("DELETE FROM item_instances WHERE character_id=? AND source='monster'").run(hero.id);
   }
   report.rows.push({class:cls,level,depth,difficulty,winPercent:won/samples*100,meanRounds:+(rounds/samples).toFixed(1),meanRemainingHpPercent:+(health/samples).toFixed(1),observedDropPercent:drops/samples*100});
  }
  characters.remove(hero.id,'Viandante');
 }}finally{game.close();sql.close();characters.close();steps.close();}
}
for(const level of [1,4,8,15])for(const difficulty of ['easy','normal','elite']){
 const rng=seeded(1241+level),counts=Object.fromEntries(C.RARITIES.map(r=>[r.id,0]));let items=0,consumables=0;
 const chance=balance?balance.dropChance(difficulty,0):difficulty==='elite'?1:.65;
 for(let sample=0;sample<10000;sample++){if(rng()>=chance)continue;const item=rollItem('guardian',level,{rng,source:'monster',elite:difficulty==='elite'});counts[item.rarity]++;items++;consumables+=!!item.effect;}
 report.drops.push({level,difficulty,samples:10000,itemPercent:items/100,rarityPercent:Object.fromEntries(Object.entries(counts).map(([id,n])=>[id,+(n/Math.max(1,items)*100).toFixed(2)])),consumablePercent:+(consumables/Math.max(1,items)*100).toFixed(2)});
}
}finally{fs.rmSync(dir,{recursive:true,force:true});}
const option=process.argv.indexOf('--output'),output=option>=0?process.argv[option+1]:'artifacts/combat-balance.json';fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({file:output,scenarios:report.rows.length,simulatedBattles:report.rows.length*samples,dropRolls:120000}));
