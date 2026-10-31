'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {createStepsRepository}=require('../lib/steps-repository.cjs');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-economy-')),file=path.join(dir,'game.sqlite');
 const steps=createStepsRepository(file),characters=createCharactersRepository(file),sql=new DatabaseSync(file);let game=createGameRepository(file,{rng:()=>.5});
 const hero=characters.create({name:'Thorin',classId:'guardian',sex:'male'});game.state(hero.id);
 t.after(()=>{game.close();sql.close();characters.close();steps.close();fs.rmSync(dir,{recursive:true,force:true});});
 return {hero,sql,get game(){return game;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5});},fund(steps=1000,coins=100){sql.prepare('UPDATE characters SET steps=?,coins=? WHERE id=?').run(steps,coins,hero.id);}};
}
test('economia: 50 passi producono 20 monete, conversioni multiple e piccoli resti',t=>{
 const f=fixture(t);f.fund(175,0);
 let state=f.game.exchange(f.hero.id);assert.equal(state.hero.steps,125);assert.equal(state.hero.coins,20);
 state=f.game.exchange(f.hero.id,100);assert.equal(state.hero.steps,25);assert.equal(state.hero.coins,60);
 for(const amount of [25,49,51,75,100])assert.throws(()=>f.game.exchange(f.hero.id,amount));
 assert.equal(f.game.state(f.hero.id).hero.steps,25);assert.equal(f.game.state(f.hero.id).hero.coins,60);
});
test('economia: ogni modalità costa 25 passi, senza doppio costo al retry',t=>{
 const f=fixture(t);
 for(const difficulty of ['easy','normal','elite']){
  f.fund(25);f.game.rest(f.hero.id);const request={difficulty,requestId:randomUUID()};
  const state=f.game.startAutoBattle(f.hero.id,request);assert.equal(state.hero.steps,0);
  assert.equal(state.challenges.find(c=>c.id===difficulty).cost,25);
  assert.deepEqual(f.game.startAutoBattle(f.hero.id,request),state);
 }
 f.fund(24);f.game.rest(f.hero.id);assert.throws(()=>f.game.startBattle(f.hero.id,'normal'));
 assert.equal(f.game.state(f.hero.id).hero.steps,24);
});
test('economia: spedizioni 50/75/100 passi, costo unico per quattro tappe e nessun rimborso al rientro',t=>{
 const f=fixture(t);f.fund();
 for(const [route,cost]of [['grove',50],['ruins',75],['pass',100]]){
  const before=f.game.state(f.hero.id).hero.steps,request={route,requestId:randomUUID()};
  let state=f.game.startExpedition(f.hero.id,request);assert.equal(state.hero.steps,before-cost);
  assert.equal(state.expedition.route.cost,cost);assert.equal(state.expedition.total,4);
  assert.deepEqual(f.game.startExpedition(f.hero.id,request),state);
  state=f.game.returnExpedition(f.hero.id,{id:state.expedition.id,version:state.expedition.version});assert.equal(state.hero.steps,before-cost);
 }
});
test('migrazione economia v5: nuove tariffe, senza cambiare saldi, storico o scontro già pagato',t=>{
 const f=fixture(t);f.fund();
 // Carica un catalogo con tariffe precedenti prima di simulare l’aggiornamento.
 f.sql.exec("UPDATE game_rules SET value=CASE id WHEN 'encounter_steps' THEN 75 WHEN 'exchange_steps' THEN 100 WHEN 'exchange_coins' THEN 10 ELSE value END;");
 f.sql.exec("INSERT INTO game_rules VALUES('fixture_unrelated',99)");
 f.reopen();f.game.exchange(f.hero.id,100);const old=f.game.startBattle(f.hero.id,'normal');
 assert.equal(old.hero.steps,825);assert.equal(old.hero.coins,110);
 const snapshot=()=>Object.fromEntries(['characters','hero_progress','wallet_events','step_claims','daily_steps','item_instances','equipped_items','merchant_offers','battles','expeditions'].map(table=>[table,f.sql.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 const before=snapshot();f.sql.exec('DELETE FROM game_migrations WHERE version>=6');f.reopen();
 const state=f.game.state(f.hero.id);assert.deepEqual(snapshot(),before);assert.deepEqual(state.battle,old.battle);
 assert.equal(state.rules.encounter_steps,25);assert.equal(state.rules.exchange_steps,50);assert.equal(state.rules.exchange_coins,20);assert.equal(state.rules.fixture_unrelated,99);
 assert.equal(f.sql.prepare('SELECT max(version) v FROM game_migrations').get().v,10);
 f.reopen();assert.deepEqual(snapshot(),before);
});
test('migrazione mercato v6: rinnovo ridotto, scorte e saldo intatti, prezzo esatto anche senza fondi',t=>{
 const f=fixture(t);f.fund();
 f.sql.exec("UPDATE game_rules SET value=CASE id WHEN 'merchant_refresh_base' THEN 30 WHEN 'merchant_refresh_per_level' THEN 10 ELSE value END;");
 f.reopen();const before=f.game.state(f.hero.id);assert.equal(before.merchant.refreshCost,40);
 const events=f.sql.prepare('SELECT * FROM wallet_events').all();
 f.sql.exec('DELETE FROM game_migrations WHERE version>=7');f.reopen();
 const after=f.game.state(f.hero.id);assert.equal(after.merchant.refreshCost,13);
 assert.deepEqual(after.merchant.offers,before.merchant.offers);assert.deepEqual(after.hero,before.hero);assert.deepEqual(f.sql.prepare('SELECT * FROM wallet_events').all(),events);
 f.fund(1000,12);assert.throws(()=>f.game.refreshMerchant(f.hero.id));assert.deepEqual(f.game.state(f.hero.id).merchant.offers,after.merchant.offers);
 f.fund(1000,13);const refreshed=f.game.refreshMerchant(f.hero.id);assert.equal(refreshed.hero.coins,0);assert.equal(refreshed.merchant.revision,before.merchant.revision+1);
 for(const [level,cost]of [[5,25],[15,55]]){f.sql.prepare('UPDATE hero_progress SET level=? WHERE character_id=?').run(level,f.hero.id);assert.equal(f.game.state(f.hero.id).merchant.refreshCost,cost);}
 f.reopen();assert.equal(f.game.state(f.hero.id).merchant.refreshCost,55);
});
