'use strict';
// Legge solo equipaggiamento/progressi; combatte esclusivamente in un database temporaneo.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const {createStepsRepository}=require('../lib/steps-repository.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const input=process.argv.includes('--player')?path.join(os.homedir(),'Library/Application Support/StepQuest/stepquest.sqlite'):null;
const index=process.argv.indexOf('--output');const output=index>=0?process.argv[index+1]:'artifacts/elite-balance.json';
if(!input)throw new Error('Usa --player per una verifica in sola lettura del corredo corrente.');
const original=new DatabaseSync(input,{readOnly:true});const profile=original.prepare('SELECT c.*,p.level,p.stage FROM characters c JOIN hero_progress p ON p.character_id=c.id ORDER BY c.played_seconds DESC LIMIT 1').get();const gear=original.prepare('SELECT i.*,e.slot AS equipped_slot FROM equipped_items e JOIN item_instances i ON i.id=e.item_id WHERE e.character_id=?').all(profile.id);original.close();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-elite-audit-')),file=path.join(dir,'game.sqlite'),steps=createStepsRepository(file),chars=createCharactersRepository(file),db=new DatabaseSync(file);let seed=1;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),game=createGameRepository(file,{rng}),hero=chars.create({name:'Simulatore',classId:profile.class_id,sex:profile.sex});game.state(hero.id);
const report={gear:process.argv.includes('--upgraded')?'corredo attuale migliorato scegliendo i soli upgrade fra 40 drop normali, nessun Unico':'corredo attuale',level:profile.level,depth:profile.stage,class:profile.class_id,samplesPerScenario:100,strategy:'Attacchi automatici, corredo attuale, nessun consumabile né bonus Garmin',rows:[]};
try{
 db.prepare('DELETE FROM equipped_items WHERE character_id=?').run(hero.id);db.prepare('DELETE FROM item_instances WHERE character_id=?').run(hero.id);
 for(const item of gear){const row={...item,id:randomUUID(),character_id:hero.id};delete row.equipped_slot;const columns=Object.keys(row).filter(k=>db.prepare('PRAGMA table_info(item_instances)').all().some(c=>c.name===k));db.prepare(`INSERT INTO item_instances(${columns.join(',')}) VALUES(${columns.map(()=>'?')})`).run(...columns.map(k=>row[k]));db.prepare('INSERT INTO equipped_items VALUES(?,?,?)').run(hero.id,item.equipped_slot,row.id);}
 if(process.argv.includes('--upgraded')){seed=3073;db.prepare('UPDATE hero_progress SET level=?,stage=? WHERE character_id=?').run(profile.level,profile.stage,hero.id);const {rollItem,insertItem}=require('../lib/game-items.cjs');for(let n=0;n<40;n++){const item=rollItem(profile.class_id,profile.level,{depth:profile.stage,rng,source:'monster'});item.source='test-upgraded';insertItem(db,hero.id,item);const view=game.state(hero.id).inventory.find(i=>i.id===item.id);if(view.comparison?.eligible&&view.comparison.gainPercent>.5)game.equip(hero.id,{itemId:item.id,slot:view.comparison.slot});}for(const row of db.prepare("SELECT id FROM item_instances WHERE character_id=? AND location='inventory' AND id NOT IN (SELECT item_id FROM equipped_items WHERE character_id=?)").all(hero.id,hero.id))db.prepare('DELETE FROM item_instances WHERE id=?').run(row.id);}
 for(const route of [null,'grove','ruins','pass'])for(const health of [1,.7,.5]){let wins=0,rounds=0,hp=0,drops=0;
  for(let sample=0;sample<100;sample++){
   seed=1000+sample;db.prepare('UPDATE hero_progress SET level=?,xp=0,stage=?,hp=1000000 WHERE character_id=?').run(profile.level,profile.stage,hero.id);db.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id);game.rest(hero.id);const max=game.state(hero.id).hero.stats.health;db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(Math.floor(max*health),hero.id);
   let state;if(!route)state=game.startAutoBattle(hero.id,{difficulty:'elite',requestId:randomUUID()});else{
    state=game.startExpedition(hero.id,{route,requestId:randomUUID()});db.prepare('UPDATE expeditions SET step=3 WHERE id=?').run(state.expedition.id);state=game.state(hero.id);state=game.chooseExpedition(hero.id,{id:state.expedition.id,version:state.expedition.version,option:'guardian',automatic:true});
   }
   wins+=state.battle.status==='won';rounds+=state.battle.round;hp+=state.hero.hp/max*100;drops+=state.battle.rewards?.drops.length||0;
   db.prepare("DELETE FROM item_instances WHERE character_id=? AND source IN ('monster','expedition')").run(hero.id);
  }
  report.rows.push({route:route||'elite',startingHpPercent:health*100,winPercent:wins,meanRounds:+(rounds/100).toFixed(1),meanHpPercent:+(hp/100).toFixed(1),meanBattleDrops:+(drops/100).toFixed(2)});
 }
}finally{game.close();db.close();chars.close();steps.close();fs.rmSync(dir,{force:true,recursive:true});}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
