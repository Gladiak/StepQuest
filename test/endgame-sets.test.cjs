'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),C=require('../lib/game-catalog.cjs');
const {generateItem,rollItem,insertItem}=require('../lib/game-items.cjs');
const {createStepsRepository}=require('../lib/steps-repository.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-endgame-')),file=path.join(dir,'game.sqlite'),steps=createStepsRepository(file),chars=createCharactersRepository(file),sql=new DatabaseSync(file);let game=createGameRepository(file,{rng:()=>.5});t.after(()=>{game.close();sql.close();chars.close();steps.close();fs.rmSync(dir,{force:true,recursive:true});});return {file,sql,chars,get game(){return game;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5});}};}
test('cinque set per classe: due collezioni uniche complete, soglie cumulative e colore verde',()=>{
 for(const cls of Object.keys(C.CLASSES)){const sets=C.SETS.filter(s=>s.class_id===cls);assert.equal(sets.length,5);assert.equal(sets.filter(s=>s.unique).length,2);for(const s of sets.filter(s=>s.unique)){assert.deepEqual([...new Set(s.bonuses.map(b=>b.pieces))],[2,3,4,5]);assert.equal(C.TEMPLATES.filter(t=>t.set_id===s.id).length,5);}}
 assert.equal(C.RARITIES.find(r=>r.id==='unique').weight,0);
});
test('drop: esclusione da mercante, normali e allenamento; gate livello/profondità e soglia0,1%',()=>{
 for(const [level,depth,elite,source]of [[29,100,true,'monster'],[45,59,true,'monster'],[45,100,false,'monster'],[45,100,true,'merchant']])assert.notEqual(rollItem('guardian',level,{depth,elite,source,rng:()=>0}).rarity,'unique');
 const first=rollItem('guardian',30,{depth:60,elite:true,source:'monster',rng:()=>0});assert.equal(first.rarity,'unique');assert.equal(first.set_id,'guardian-set-3');assert.ok(first.rolls.every(r=>r.value>0));
 let firstCall=true;const boundary=rollItem('guardian',45,{depth:100,elite:true,source:'monster',rng:()=>{if(firstCall){firstCall=false;return .001;}return .5;}});assert.notEqual(boundary.rarity,'unique');
 const highest=rollItem('guardian',45,{depth:100,elite:true,source:'monster',rng:(()=>{const v=[0,.99];return ()=>v.length?v.shift():.5;})()});assert.equal(highest.set_id,'guardian-set-4');
});
test('scalatura: moltiplicatore persistente, tetto3x, consumabili e corredo invariati',t=>{
 const f=fixture(t),hero=f.chars.create({name:'Thorin',classId:'guardian',sex:'male'}),template=C.TEMPLATES.find(t=>t.id==='guardian-weapon-0');
 const normal=generateItem(template,{level:10,depth:10,rarity:'rare',rng:()=>.5}),deep=generateItem(template,{level:10,depth:110,rarity:'rare',rng:()=>.5});assert.equal(deep.depthMultiplier,2);assert.equal(deep.baseStats.attack,normal.baseStats.attack*2);assert.ok(deep.rolls[0].max>normal.rolls[0].max);
 assert.equal(generateItem(template,{level:10,depth:100000}).depthMultiplier,3);
 for(const id of ['starter-guardian','food-0'])assert.equal(generateItem(C.TEMPLATES.find(t=>t.id===id),{level:10,depth:100}).depthMultiplier,1);
 insertItem(f.sql,hero.id,deep);const before=f.game.state(hero.id).inventory.find(i=>i.id===deep.id);f.sql.prepare('UPDATE hero_progress SET stage=200 WHERE character_id=?').run(hero.id);f.reopen();const after=f.game.state(hero.id).inventory.find(i=>i.id===deep.id);for(const k of ['baseStats','rolls','generationDepth','depthMultiplier','level'])assert.deepEqual(after[k],before[k]);
});
test('set completi: forte aumento reale, bonus cumulativi, nessun doppio conteggio anelli e requisiti classe',t=>{
 const f=fixture(t);for(const cls of Object.keys(C.CLASSES)){
 const hero=f.chars.create({name:'Eroe '+cls,classId:cls,sex:'male'});f.game.state(hero.id);f.sql.prepare('UPDATE hero_progress SET level=45,stage=100 WHERE character_id=?').run(hero.id);const before=f.game.state(hero.id).hero.stats;
 const set=C.SETS.find(s=>s.class_id===cls&&s.id.endsWith('-4'));for(const template of C.TEMPLATES.filter(t=>t.set_id===set.id)){const item=generateItem(template,{level:45,depth:100,rarity:'unique',rng:()=>.5});insertItem(f.sql,hero.id,item);f.game.equip(hero.id,item.id);}
 const state=f.game.state(hero.id);assert.equal(state.sets[0].pieces,5);assert.equal(state.sets[0].bonuses.filter(b=>b.active).length,7);assert.ok(state.hero.stats.attack>before.attack*2);assert.ok(state.hero.stats.health>before.health*1.7);
 const duplicate=generateItem(C.TEMPLATES.find(t=>t.id===set.id+'-ring'),{level:45,depth:100,rarity:'unique',rng:()=>.5});insertItem(f.sql,hero.id,duplicate);assert.equal(f.game.equip(hero.id,{itemId:duplicate.id,slot:'ring2'}).sets[0].pieces,5);
 f.chars.remove(hero.id,hero.name);
 }
});
test('migrazione v7: conserva istanze, portafoglio e scontri, aggiunge catalogo e colonne una sola volta',t=>{
 const f=fixture(t),hero=f.chars.create({name:'Thorin',classId:'guardian',sex:'male'});f.sql.prepare('UPDATE characters SET steps=1000 WHERE id=?').run(hero.id);const before=f.game.startBattle(hero.id,'normal');
 f.sql.exec("DELETE FROM game_migrations WHERE version>=8; ALTER TABLE item_instances DROP COLUMN generation_depth; ALTER TABLE item_instances DROP COLUMN depth_multiplier; DELETE FROM item_templates WHERE set_id LIKE '%-set-3' OR set_id LIKE '%-set-4'; DELETE FROM set_bonuses WHERE set_id LIKE '%-set-3' OR set_id LIKE '%-set-4'; DELETE FROM item_sets WHERE id LIKE '%-set-3' OR id LIKE '%-set-4'; DELETE FROM item_rarities WHERE id='unique';");f.reopen();const after=f.game.state(hero.id);assert.deepEqual(after.inventory,before.inventory);assert.deepEqual(after.battle,before.battle);assert.deepEqual(after.hero,before.hero);assert.equal(after.classSets.length,5);f.reopen();assert.equal(f.game.state(hero.id).library.sets,30);
});

test('frequenza unica: estrazioni ripetibili molto rare anche a fine gioco',()=>{
 let seed=7241,unique=0;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let n=0;n<10000;n++){const item=rollItem('guardian',45,{depth:100,elite:true,source:'monster',rng});if(item.rarity==='unique')unique++;}
 assert.ok(unique>=2&&unique<=24,`Unici su 10000 vittorie: ${unique}`);
});
