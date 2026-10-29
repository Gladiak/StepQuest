'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const {createStepsRepository}=require('../lib/steps-repository.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const {rollItem,generateItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs'),{dropChance}=require('../lib/combat-balance.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-balance-test-')),file=path.join(dir,'game.sqlite'),steps=createStepsRepository(file),characters=createCharactersRepository(file),sql=new DatabaseSync(file),game=createGameRepository(file,{rng:()=>.5}),hero=characters.create({name:'Thorin',classId:'guardian',sex:'male'});game.state(hero.id);t.after(()=>{game.close();sql.close();characters.close();steps.close();fs.rmSync(dir,{recursive:true,force:true});});return {hero,sql,game,fund:()=>sql.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id)};}
test('allenamento: facile resta accessibile dopo profondità alte, senza élite nascoste né avanzamento',t=>{
 const f=fixture(t);f.fund();f.sql.prepare('UPDATE hero_progress SET level=5,stage=20 WHERE character_id=?').run(f.hero.id);f.game.rest(f.hero.id);
 const preview=f.game.state(f.hero.id).challenges.find(p=>p.id==='easy');assert.equal(preview.stage,5);assert.equal(preview.advances,false);assert.equal(preview.dropChance,.65);
 const before=f.game.startBattle(f.hero.id,'easy');assert.equal(before.battle.stage,preview.stage);assert.equal(before.battle.enemy.elite,false);assert.equal(before.battle.enemy.dropChance,.65);
 const result=f.game.autoBattle(f.hero.id,{battleId:before.battle.id,round:0});assert.equal(result.battle.status,'won');assert.equal(result.hero.stage,20);
});
test('difficoltà: normale senza picco automatico a profondità5, élite esplicita e preview coerente',t=>{
 const f=fixture(t);f.fund();f.sql.prepare('UPDATE hero_progress SET stage=5 WHERE character_id=?').run(f.hero.id);
 const previews=f.game.state(f.hero.id).challenges;let state=f.game.startBattle(f.hero.id,'normal');assert.equal(state.battle.enemy.elite,false);assert.equal(state.battle.enemy.level,5);assert.equal(state.battle.enemy.dropChance,.85);
 state=f.game.act(f.hero.id,{battleId:state.battle.id,round:0,action:'flee'});state=f.game.startBattle(f.hero.id,'elite');
 assert.equal(state.battle.enemy.elite,true);assert.equal(state.battle.enemy.level,previews.find(p=>p.id==='elite').stage);assert.equal(state.battle.enemy.dropChance,1);
 assert.equal(previews.find(p=>p.id==='elite').minimumRarity,'uncommon');
});
test('drop: élite garantite almeno non comuni e soglie rarità rispettate in estrazioni ripetibili',()=>{
 let seed=781;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(const level of [1,4,8,15])for(const elite of [false,true]){const counts={};for(let n=0;n<4000;n++){
  const item=rollItem('guardian',level,{rng,elite,source:'monster'});counts[item.rarity]=(counts[item.rarity]||0)+1;
  if(elite){assert.notEqual(item.rarity,'common');assert.equal(item.effect,null);}if(level<4)assert.ok(['common','uncommon'].includes(item.rarity));if(level<8)assert.notEqual(item.rarity,'mythic');if(level<15)assert.notEqual(item.rarity,'legendary');
 }if(level===15&&!elite){assert.ok(counts.common>800&&counts.common<1200);assert.ok(counts.mythic>170&&counts.mythic<320);assert.ok(counts.legendary>0&&counts.legendary<75);}}
 assert.equal(dropChance('easy'),.65);assert.equal(dropChance('normal'),.85);assert.equal(dropChance('elite',100),1);assert.equal(dropChance('normal',100),.95);
});
test('riposo: paga HP mancanti una volta, vita piena senza costo e rollback del pagamento',t=>{
 const f=fixture(t);f.fund();f.sql.prepare('UPDATE hero_progress SET hp=50 WHERE character_id=?').run(f.hero.id);
 let state=f.game.state(f.hero.id);assert.deepEqual(state.restPlan,{kind:'full',cost:65,healing:65,targetHp:115});
 state=f.game.rest(f.hero.id);assert.equal(state.hero.hp,115);assert.equal(state.hero.coins,9935);assert.equal(state.restCost,0);f.game.rest(f.hero.id);assert.equal(f.game.state(f.hero.id).hero.coins,9935);
 f.sql.prepare('UPDATE hero_progress SET hp=50 WHERE character_id=?').run(f.hero.id);f.sql.exec("CREATE TRIGGER fail_rest BEFORE UPDATE OF hp ON hero_progress BEGIN SELECT RAISE(ABORT,'rollback'); END");
 assert.throws(()=>f.game.rest(f.hero.id));assert.equal(f.game.state(f.hero.id).hero.coins,9935);assert.equal(f.game.state(f.hero.id).hero.hp,50);
});
test('soccorso: senza monete recupera solo35%, poi richiede cibo o pagamento senza bloccare il gioco',t=>{
 const f=fixture(t);f.sql.prepare('UPDATE hero_progress SET hp=1 WHERE character_id=?').run(f.hero.id);
 let state=f.game.rest(f.hero.id);assert.equal(state.hero.hp,41);assert.equal(state.hero.coins,0);assert.equal(state.restPlan.kind,'full');assert.equal(state.restCost,74);assert.throws(()=>f.game.rest(f.hero.id));
 f.sql.prepare('UPDATE characters SET steps=1000 WHERE id=?').run(f.hero.id);state=f.game.startAutoBattle(f.hero.id,{difficulty:'easy',requestId:randomUUID()});assert.equal(state.battle.status,'won');
});
test('riposo: saldo insufficiente senza soccorso e viaggio attivo non cambiano vita o portafoglio',t=>{
 const f=fixture(t);f.sql.prepare('UPDATE hero_progress SET hp=70 WHERE character_id=?').run(f.hero.id);assert.throws(()=>f.game.rest(f.hero.id));assert.equal(f.game.state(f.hero.id).hero.hp,70);
 f.fund();let state=f.game.startExpedition(f.hero.id,{route:'grove',requestId:randomUUID()});const before=state.hero;
 assert.throws(()=>f.game.rest(f.hero.id));assert.equal(f.game.state(f.hero.id).hero.hp,before.hp);assert.equal(f.game.state(f.hero.id).hero.coins,before.coins);
 state=f.game.returnExpedition(f.hero.id,{id:state.expedition.id,version:state.expedition.version});assert.equal(state.hero.hp,before.hp);
});
test('cibo: cura economica fuori scontro, meno costosa del riposo per gli stessi HP',()=>{
 for(const level of [1,8,25]){const food=generateItem(C.TEMPLATES.find(t=>t.id==='food-0'),{level});assert.ok(food.price<food.effect.amount);if(level===1){assert.equal(food.price,14);assert.equal(food.effect.amount,25);}}
});
