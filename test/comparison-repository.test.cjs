'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
const {generateItem,insertItem}=require('../lib/game-items.cjs');
const C=require('../lib/game-catalog.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-comparison-')),file=path.join(dir,'save.sqlite');
 const chars=createCharactersRepository(file),hero=chars.create({name:'Elara',classId:'guardian',sex:'female'}),game=createGameRepository(file,{rng:()=>.5}),db=new DatabaseSync(file);
 const state=game.state(hero.id);
 t.after(()=>{game.close();db.close();chars.close();fs.rmSync(dir,{recursive:true,force:true});});return {game,hero,chars,db,state};
}
test('comparison input: validates ownership, batch size and context without changing the save',t=>{
 const f=fixture(t),input={context:f.state.comparisonContext,itemIds:[f.state.merchant.offers[0].id]};
 const data=f.game.comparisonInput(f.hero.id,input);assert.equal(data.items.length,1);assert.deepEqual(f.game.state(f.hero.id),f.state);
 const other=f.chars.create({name:'Thorin',classId:'guardian',sex:'male'}),foreign=f.game.state(other.id).equipment.weapon.id;
 assert.throws(()=>f.game.comparisonInput(f.hero.id,{...input,itemIds:[foreign]}),/non disponibile/);
 for(const itemIds of [[],Array(25).fill(input.itemIds[0]),[input.itemIds[0],input.itemIds[0]],[5]])assert.throws(()=>f.game.comparisonInput(f.hero.id,{...input,itemIds}),/non valida/);
 f.db.prepare('UPDATE characters SET coins=coins+5 WHERE id=?').run(f.hero.id);
 assert.equal(f.game.state(f.hero.id).comparisonContext,input.context,'coin changes must not invalidate comparisons');
 f.db.prepare('UPDATE hero_progress SET stage=stage+1 WHERE character_id=?').run(f.hero.id);
 assert.throws(()=>f.game.comparisonInput(f.hero.id,input),error=>error.code==='STALE_COMPARISON');
});
test('comparison input: ring replacements include real set thresholds and capped effective stats',t=>{
 const f=fixture(t),ring=generateItem(C.TEMPLATES.find(t=>t.id==='ring-0'));
 ring.rolls=[{attribute_id:'accuracy_percent',value:106,min:1,max:108,rarity:'mythic'}];insertItem(f.db,f.hero.id,ring);
 const state=f.game.state(f.hero.id),batch=f.game.comparisonInput(f.hero.id,{context:state.comparisonContext,itemIds:[ring.id]});
 assert.deepEqual(batch.items[0].comparisons.map(c=>c.slot),['ring1','ring2']);
 for(const c of batch.items[0].comparisons){assert.equal(c.input.after.accuracy,100);assert.equal(c.input.before.accuracy,95);}
 const item=state.inventory.find(i=>i.id===ring.id),after=f.game.equip(f.hero.id,{itemId:ring.id,slot:'ring1'});
 assert.deepEqual(batch.items[0].comparisons[0].input.after,after.hero.stats);
 assert.notEqual(after.comparisonContext,state.comparisonContext);
});
