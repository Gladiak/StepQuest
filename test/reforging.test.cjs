'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
const {generateItem,insertItem}=require('../lib/game-items.cjs');
const {equipmentPrice,salePrice}=require('../lib/item-economy.cjs');
const C=require('../lib/game-catalog.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-reforging-')),file=path.join(dir,'game.sqlite'),chars=createCharactersRepository(file),hero=chars.create({name:'Thorin',classId:'guardian',sex:'male'}),game=createGameRepository(file,{rng:()=>.5}),db=new DatabaseSync(file);
 game.state(hero.id);db.prepare('UPDATE characters SET coins=1000000,steps=100000 WHERE id=?').run(hero.id);
 t.after(()=>{game.close();db.close();chars.close();fs.rmSync(dir,{recursive:true,force:true});});
 const state=()=>game.state(hero.id),level=n=>db.prepare('UPDATE hero_progress SET level=? WHERE character_id=?').run(n,hero.id);
 const request=itemId=>{const quote=state().smith.reforges.find(q=>q.id===itemId);return {requestId:randomUUID(),itemId,version:quote.version,token:quote.token};};
 return {hero,chars,game,db,state,level,request};
}
test('reforging raises old gear to hero level, preserves historical depth scaling and charges the quoted premium once',t=>{
 const f=fixture(t);f.level(30);
 const item=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:5,depth:205,rarity:'rare',propertyCount:2,rng:()=>.5,source:'smith'});insertItem(f.db,f.hero.id,item);
 f.game.equip(f.hero.id,item.id);f.game.refineItem(f.hero.id,{requestId:randomUUID(),itemId:item.id,rank:0});
 f.db.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(item.id,f.hero.id,'ember-fury',JSON.stringify([{attribute_id:'attack_flat',value:10}]),new Date().toISOString());
 const before=f.state(),quote=before.smith.reforges.find(q=>q.id===item.id),request=f.request(item.id);
 assert.equal(quote.fromLevel,5);assert.equal(quote.targetLevel,30);assert.ok(quote.upgradeCost>0);assert.equal(quote.cost,quote.baseCost+quote.upgradeCost);
 const after=f.game.reforgeItem(f.hero.id,request),reforged=after.equipment.weapon;
 assert.equal(reforged.level,30);assert.equal(reforged.id,item.id);assert.equal(reforged.generationDepth,205);assert.equal(reforged.depthMultiplier,3);
 assert.equal(reforged.rarity,'rare');assert.equal(reforged.rolls.length,item.rolls.length);assert.equal(reforged.refinement.rank,1);assert.deepEqual(reforged.enchantment,before.equipment.weapon.enchantment);
 assert.ok(reforged.baseStats.attack>before.equipment.weapon.baseStats.attack);assert.equal(after.hero.coins,before.hero.coins-quote.cost);assert.equal(after.hero.steps,before.hero.steps);assert.equal(after.smith.xp,before.smith.xp);
 assert.equal(reforged.price,quote.newPrice);assert.ok(quote.cost>reforged.sellPrice-before.equipment.weapon.sellPrice,'upgrading then selling must not produce coins');
 const next=after.smith.reforges.find(q=>q.id===item.id);assert.equal(next.upgradeCost,0);assert.equal(next.baseCost,Math.max(25,Math.ceil(reforged.price*.35)));
 assert.deepEqual(f.game.reforgeItem(f.hero.id,request),after);
 f.level(31);const replay=f.game.reforgeItem(f.hero.id,request);assert.equal(replay.equipment.weapon.level,30);assert.equal(replay.hero.coins,after.hero.coins);
});
test('reforging at the same level keeps the base price and existing depth multiplier',t=>{
 const f=fixture(t);f.level(20);const item=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:20,depth:77,rarity:'rare',rng:()=>.5});insertItem(f.db,f.hero.id,item);
 const quote=f.state().smith.reforges.find(q=>q.id===item.id);assert.equal(quote.upgradeCost,0);assert.equal(quote.cost,Math.max(25,Math.ceil(item.price*.35)));
 const after=f.game.reforgeItem(f.hero.id,f.request(item.id)).inventory.find(i=>i.id===item.id);assert.equal(after.level,20);assert.equal(after.price,item.price);assert.equal(after.depthMultiplier,item.depthMultiplier);
});
test('starter equipment can grow without changing how new starter items are generated',t=>{
 const f=fixture(t),original=f.state().equipment.weapon;f.level(20);
 const after=f.game.reforgeItem(f.hero.id,f.request(original.id)).equipment.weapon;
 assert.equal(after.level,20);assert.equal(after.templateId,original.templateId);assert.equal(after.rarity,'common');assert.equal(after.rolls.length,0);assert.ok(after.baseStats.attack>original.baseStats.attack);
 const fresh=generateItem(C.TEMPLATES.find(t=>t.id===original.templateId),{level:20});assert.equal(fresh.level,1);assert.equal(fresh.price,1);
});
test('a level change invalidates a reforge quote, and unavailable or foreign gear cannot be charged',t=>{
 const f=fixture(t);f.level(20);const item=f.state().equipment.weapon,request=f.request(item.id);f.level(21);const before=f.state();
 assert.throws(()=>f.game.reforgeItem(f.hero.id,request),e=>e.code==='STALE_REFORGE');assert.deepEqual(f.state(),before);
 assert.throws(()=>f.game.reforgeItem(f.hero.id,{...f.request(item.id),token:'forged'}),e=>e.code==='STALE_REFORGE');
 const other=f.chars.create({name:'Elara',classId:'arcanist',sex:'female'});f.game.state(other.id);
 assert.throws(()=>f.game.reforgeItem(other.id,f.request(item.id)));assert.equal(f.state().hero.coins,before.hero.coins);
 const future=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:50});insertItem(f.db,f.hero.id,future);
 assert.equal(f.state().smith.reforges.find(q=>q.id===future.id).eligible,false);assert.throws(()=>f.game.reforgeItem(f.hero.id,f.request(future.id)),/non utilizzabile/);
});
test('failed reforge updates roll back the wallet, item level, value and version together',t=>{
 const f=fixture(t);f.level(30);const item=f.state().equipment.weapon,request=f.request(item.id),before=f.state();
 f.db.exec("CREATE TRIGGER fail_reforge BEFORE UPDATE ON item_instances BEGIN SELECT RAISE(ABORT,'test failure'); END;");
 assert.throws(()=>f.game.reforgeItem(f.hero.id,request));assert.deepEqual(f.state(),before);
 f.db.exec('DROP TRIGGER fail_reforge');assert.equal(f.game.reforgeItem(f.hero.id,request).equipment.weapon.level,30);
});
test('level upgrade premiums cover resale gains at all equipment rarities and set prices',()=>{
 for(const rank of [0,1,2,3,4,5])for(const isSet of [false,true])for(const [from,to]of [[1,2],[5,45],[30,430],[430,450]]){
  const oldPrice=equipmentPrice(from,rank,isSet),newPrice=equipmentPrice(to,rank,isSet),fee=Math.max(25,Math.ceil(oldPrice*.35))+Math.ceil((newPrice-oldPrice)*.35);
  assert.ok(newPrice>oldPrice);assert.ok(fee>salePrice(newPrice)-salePrice(oldPrice));
 }
});
