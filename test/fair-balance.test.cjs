'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const {createStepsRepository}=require('../lib/steps-repository.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs'),{generateItem,insertItem,rollItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs'),{combatStage,enemyStats}=require('../lib/combat-balance.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-fair-')),file=path.join(dir,'game.sqlite'),steps=createStepsRepository(file),chars=createCharactersRepository(file),db=new DatabaseSync(file);let value=.99,game=createGameRepository(file,{rng:()=>value});const hero=chars.create({name:'Thorin',classId:'guardian',sex:'male'});game.state(hero.id);db.prepare("UPDATE item_instances SET base_stats='{\"attack\":7,\"accuracy\":5}' WHERE character_id=? AND template_id='starter-guardian'").run(hero.id);db.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id);t.after(()=>{game.close();db.close();chars.close();steps.close();fs.rmSync(dir,{force:true,recursive:true});});return {hero,db,get game(){return game;},rng:v=>{value=v;},reopen(){game.close();game=createGameRepository(file,{rng:()=>value});}};}
function win(f,difficulty='normal'){f.game.rest(f.hero.id);const s=f.game.startBattle(f.hero.id,difficulty);f.db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(s.battle.id);const out=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});return out;}
test('crescita: progressione monotona e divario smussato, equip migliore non rinforza i nemici',()=>{
 assert.equal(combatStage(10,10),10);assert.ok(Math.abs(combatStage(47,21)-37.9)<1e-9);assert.ok(enemyStats(47,1,21).attack<enemyStats(47,1).attack);let previous=0;for(let depth=1;depth<=200;depth++){const attack=enemyStats(depth,1,21).attack;assert.ok(attack>=previous);previous=attack;}
});
test('protezione sfortuna: massimo due vittorie vuote, persistenza e premio una sola volta',t=>{
 const f=fixture(t);for(let n=0;n<2;n++){const s=win(f);assert.equal(s.battle.status,'won');assert.equal(s.battle.rewards.drops.length,0);assert.equal(s.lootProgress.dryWins,n+1);}
 f.reopen();assert.equal(f.game.state(f.hero.id).challenges.find(c=>c.id==='normal').dropChance,1);const s=win(f);assert.equal(s.battle.rewards.drops.length,1);assert.equal(s.lootProgress.dryWins,0);assert.deepEqual(f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0}),s);
});
test('élite: due oggetti almeno rari dal livello4, affisso iniziale realmente utile e niente bonus unici extra',t=>{
 const f=fixture(t);f.db.prepare('UPDATE hero_progress SET level=4 WHERE character_id=?').run(f.hero.id);f.rng(.5);const s=win(f,'elite');assert.equal(s.battle.rewards.drops.length,2);for(const id of s.battle.rewards.drops){const item=s.inventory.find(i=>i.id===id);assert.ok(['rare','mythic','legendary'].includes(item.rarity));}
 for(const template of C.TEMPLATES.filter(t=>t.slot==='weapon'&&!t.starter&&!t.set_id).slice(0,10)){const item=generateItem(template,{level:15,rarity:'rare',source:'monster',rng:()=>.5});assert.ok(['attack_flat','attack_percent','magic_damage_flat','critical_percent','speed_percent'].includes(item.rolls[0].attribute_id));}
 assert.notEqual(rollItem('guardian',45,{depth:100,elite:true,allowUnique:false,source:'monster',rng:()=>0}).rarity,'unique');
});
test('premio fallito: rollback dei due oggetti e del contatore, sconfitta non consuma protezione',t=>{
 const f=fixture(t);f.db.prepare('INSERT INTO loot_progress VALUES(?,2)').run(f.hero.id);f.rng(.5);const start=f.game.startBattle(f.hero.id,'elite');f.db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(start.battle.id);f.db.exec("CREATE TRIGGER fail_drop BEFORE INSERT ON item_instances WHEN NEW.source='monster' BEGIN SELECT RAISE(ABORT,'rollback'); END");assert.throws(()=>f.game.autoBattle(f.hero.id,{battleId:start.battle.id,round:0}));assert.equal(f.game.state(f.hero.id).lootProgress.dryWins,2);assert.equal(f.game.state(f.hero.id).battle.status,'active');f.db.exec('DROP TRIGGER fail_drop');const s=f.game.act(f.hero.id,{battleId:start.battle.id,round:0,action:'flee'});assert.equal(s.lootProgress.dryWins,2);
});

test('progressione: élite avanza una sola profondità e non aumenta la forza se miglioro gli oggetti',t=>{
 const f=fixture(t);f.db.prepare('UPDATE hero_progress SET level=10,stage=20 WHERE character_id=?').run(f.hero.id);f.rng(.5);f.game.rest(f.hero.id);let s=f.game.startBattle(f.hero.id,'elite');const enemy=s.battle.enemy;
 f.game.act(f.hero.id,{battleId:s.battle.id,round:0,action:'flee'});const item=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:10,depth:20,rarity:'legendary',rng:()=>.5});item.baseStats={attack:10000};insertItem(f.db,f.hero.id,item);f.game.equip(f.hero.id,item.id);
 s=f.game.startBattle(f.hero.id,'elite');assert.deepEqual(s.battle.enemy,enemy);s=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});assert.equal(s.hero.stage,21);
});
test('spedizione: pattuglia non spinge la profondità, custode completato avanza di uno',t=>{
 const f=fixture(t);f.rng(.5);let s=f.game.startExpedition(f.hero.id,{route:'grove',requestId:randomUUID()});s=f.game.chooseExpedition(f.hero.id,{id:s.expedition.id,version:s.expedition.version,option:'patrol'});f.db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(s.battle.id);s=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});assert.equal(s.hero.stage,1);
 f.db.prepare('UPDATE expeditions SET step=3 WHERE id=?').run(s.expedition.id);s=f.game.state(f.hero.id);s=f.game.chooseExpedition(f.hero.id,{id:s.expedition.id,version:s.expedition.version,option:'guardian'});f.db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(s.battle.id);s=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});assert.equal(s.expedition.status,'completed');assert.equal(s.hero.stage,2);
});
