'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs'),{generateItem,insertItem}=require('../lib/game-items.cjs'),{prepareSave}=require('../lib/save-protection.cjs'),C=require('../lib/game-catalog.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-merchant-')),file=path.join(dir,'save.sqlite'),chars=createCharactersRepository(file),hero=chars.create({name:'Elara',classId:'guardian',sex:'female'}),db=new DatabaseSync(file);let game=createGameRepository(file,{rng:()=>.5});game.state(hero.id);
 t.after(()=>{game.close();db.close();chars.close();fs.rmSync(dir,{recursive:true,force:true});});return {file,hero,db,get game(){return game;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5});},fund(){db.prepare('UPDATE characters SET coins=1000000,steps=100000 WHERE id=?').run(hero.id);}};
}
test('merchant separates five categories in the requested order and stocks every category',t=>{
 const f=fixture(t),s=f.game.state(f.hero.id);assert.deepEqual(s.merchant.categories.map(c=>[c.id,c.name]),[['weapons','Armi'],['armor','Armature'],['accessories','Accessori'],['potions','Pozioni'],['food','Cibo']]);assert.equal(s.merchant.offers.length,12);
 for(const c of C.MERCHANT_CATEGORIES)assert.equal(s.merchant.offers.filter(i=>i.category===c.id).length,c.stock);
 assert.ok(s.merchant.offers.filter(i=>i.category==='accessories').every(i=>['ring','amulet'].includes(i.slot)&&!i.effect));assert.ok(s.merchant.offers.filter(i=>i.category==='food').every(i=>i.slot==='food'&&i.effect.kind==='food'));assert.ok(s.merchant.offers.filter(i=>i.category==='potions').every(i=>i.effect&&i.effect.kind!=='food'));
});
test('all accessory, set and food templates use the same categories in memory and SQLite',t=>{
 const f=fixture(t);for(const template of C.TEMPLATES){const stored=f.db.prepare('SELECT category FROM item_templates WHERE id=?').get(template.id);assert.equal(stored.category,template.category,template.id);if(['ring','amulet'].includes(template.slot))assert.equal(template.category,'accessories');if(template.slot==='food')assert.equal(template.category,'food');}
});
test('v9 migration relabels existing stock and inventory without changing items, prices, wallet or a paid battle',t=>{
 const f=fixture(t);f.fund();for(const id of ['ring-0','amulet-0','food-0'])insertItem(f.db,f.hero.id,generateItem(C.TEMPLATES.find(t=>t.id===id),{level:15}));f.game.startBattle(f.hero.id,'normal');
 const snapshot=()=>Object.fromEntries(['item_instances','merchant_offers','equipped_items','characters','wallet_events','battles'].map(table=>[table,f.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()])),before=snapshot();
 f.db.exec("UPDATE item_templates SET category='supplies' WHERE slot IN ('ring','amulet','food');DELETE FROM game_migrations WHERE version=10;");const backup=prepareSave(f.file);assert.ok(backup);f.reopen();const after=f.game.state(f.hero.id);assert.deepEqual(snapshot(),before);assert.ok(after.inventory.filter(i=>['ring','amulet'].includes(i.slot)).every(i=>i.category==='accessories'));assert.equal(after.inventory.find(i=>i.slot==='food').category,'food');assert.equal(after.battle.status,'active');assert.equal(prepareSave(f.file),null);
 const old=new DatabaseSync(backup,{readOnly:true});try{assert.equal(old.prepare("SELECT category FROM item_templates WHERE id='food-0'").get().category,'supplies');}finally{old.close();}f.reopen();assert.deepEqual(snapshot(),before);
});
test('level-900 refresh supplies all five sections and preserves already purchased items and ordinary rarity rules',t=>{
 const f=fixture(t);f.fund();const bought=f.game.state(f.hero.id).merchant.offers.find(i=>i.category==='food');f.game.buy(f.hero.id,bought.id);f.db.prepare('UPDATE hero_progress SET level=900,stage=1100 WHERE character_id=?').run(f.hero.id);const before=f.game.state(f.hero.id);const s=f.game.refreshMerchant(f.hero.id);assert.equal(s.hero.coins,before.hero.coins-2710);assert.equal(s.merchant.offers.length,12);assert.ok(s.inventory.some(i=>i.id===bought.id));
 for(const c of C.MERCHANT_CATEGORIES)assert.equal(s.merchant.offers.filter(i=>i.category===c.id).length,c.stock);for(const i of s.merchant.offers){assert.equal(i.level,900);assert.notEqual(i.rarity,'unique');if(i.effect){assert.equal(i.rarity,'common');assert.equal(i.depthMultiplier,1);}else assert.equal(i.depthMultiplier,3);}
 f.reopen();assert.deepEqual(f.game.state(f.hero.id).merchant,s.merchant);
});
test('accessory and food purchases retain their distinct equipment and consumption rules',t=>{
 const f=fixture(t);f.fund();const s=f.game.state(f.hero.id),accessory=s.merchant.offers.find(i=>i.category==='accessories'),slot=accessory.slot==='ring'?'ring1':'amulet';const equipped=f.game.buyAndEquip(f.hero.id,{itemId:accessory.id,slot});assert.equal(equipped.equipment[slot].id,accessory.id);const food=s.merchant.offers.find(i=>i.category==='food');assert.throws(()=>f.game.buyAndEquip(f.hero.id,{itemId:food.id,slot:'ring1'}));assert.ok(f.game.state(f.hero.id).merchant.offers.some(i=>i.id===food.id));assert.ok(f.game.buy(f.hero.id,food.id).inventory.some(i=>i.id===food.id));
});
