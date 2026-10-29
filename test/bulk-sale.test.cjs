'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const {generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-bulk-')),file=path.join(dir,'game.sqlite'),characters=createCharactersRepository(file),hero=characters.create({name:'Thorin',classId:'guardian',sex:'male'}),sql=new DatabaseSync(file);
 let game=createGameRepository(file,{rng:()=>.5});game.state(hero.id);
 t.after(()=>{game.close();sql.close();characters.close();fs.rmSync(dir,{recursive:true,force:true});});
 const add=(template,baseStats,options={})=>{const item=generateItem(C.TEMPLATES.find(t=>t.id===template),{rng:()=>.5,...options});if(baseStats)item.baseStats=baseStats;insertItem(sql,hero.id,item);return item;};
 return {hero,sql,characters,add,get game(){return game;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5});}};
}
const request=preview=>({token:preview.token,requestId:randomUUID()});
test('vendita in blocco: seleziona solo pezzi dominati, preserva indossati, cibo, pozioni, set e vantaggi alternativi',t=>{
 const f=fixture(t);f.sql.prepare('UPDATE hero_progress SET level=5 WHERE character_id=?').run(f.hero.id);
 const weak=f.add('guardian-weapon-0',{attack:2});
 const food=f.add('food-0'),potion=f.add('potion-heal-0'),future=f.add('guardian-weapon-0',{attack:1},{level:20}),set=f.add('guardian-set-0-weapon',{attack:1},{level:5,rarity:'rare'}),foreign=f.add('arcanist-weapon-0',{attack:1});
 const utility=f.add('guardian-weapon-0',{attack:2});
 const rolls=[{attribute_id:'gold_bonus_percent',value:10,min:10,max:10,rarity:'uncommon',affix_id:C.AFFIXES[0].id}];f.sql.prepare('UPDATE item_instances SET rolls=? WHERE id=?').run(JSON.stringify(rolls),utility.id);
 const preview=f.game.previewJunkSale(f.hero.id);assert.deepEqual(preview.items.map(i=>i.id),[weak.id]);assert.equal(preview.coins,Math.floor(weak.price*.25));
 const before=f.game.state(f.hero.id),after=f.game.sellJunk(f.hero.id,request(preview));assert.equal(after.hero.coins,before.hero.coins+preview.coins);assert.deepEqual(after.equipment,before.equipment);
 for(const item of [food,potion,future,set,foreign,utility])assert.ok(after.inventory.some(i=>i.id===item.id));assert.ok(!after.inventory.some(i=>i.id===weak.id));
});
test('vendita in blocco: entrambi gli anelli contano; un oggetto utile a uno slot o uno slot libero resta',t=>{
 const f=fixture(t),strong=f.add('ring-0',{attack:10}),small=f.add('ring-1',{attack:2});
 f.game.equip(f.hero.id,{itemId:strong.id,slot:'ring1'});f.game.equip(f.hero.id,{itemId:small.id,slot:'ring2'});
 const middle=f.add('ring-2',{attack:5}),weak=f.add('ring-3',{attack:1}),amulet=f.add('amulet-0',{});
 assert.deepEqual(f.game.previewJunkSale(f.hero.id).items.map(i=>i.id),[weak.id]);
 f.game.unequip(f.hero.id,'ring2');assert.equal(f.game.previewJunkSale(f.hero.id).items.length,0);
 assert.ok(f.game.state(f.hero.id).inventory.some(i=>i.id===middle.id));assert.ok(f.game.state(f.hero.id).inventory.some(i=>i.id===amulet.id));
});
test('vendita in blocco: prezzo dal server, retry idempotente e persistenza',t=>{
 const f=fixture(t);f.add('guardian-weapon-0',{attack:2});f.add('guardian-body-0-0',{defense:0});
 const preview=f.game.previewJunkSale(f.hero.id),input={...request(preview),coins:999999,items:['inventato']};assert.equal(preview.items.length,2);
 const after=f.game.sellJunk(f.hero.id,input);assert.equal(after.hero.coins,preview.coins);assert.equal(after.inventory.length,2);
 assert.deepEqual(f.game.sellJunk(f.hero.id,input),after);assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind='bulk_sale'").get().n,1);
 f.reopen();assert.deepEqual(f.game.sellJunk(f.hero.id,input),after);assert.equal(f.game.previewJunkSale(f.hero.id).items.length,0);
});
test('vendita in blocco: anteprima stale dopo cambio equipaggiamento o nuovi candidati non vende nulla',t=>{
 const f=fixture(t),weak=f.add('guardian-weapon-0',{attack:2}),preview=f.game.previewJunkSale(f.hero.id);
 f.game.equip(f.hero.id,weak.id);let before=f.game.state(f.hero.id);assert.throws(()=>f.game.sellJunk(f.hero.id,request(preview)),e=>e.code==='STALE_SALE');assert.deepEqual(f.game.state(f.hero.id),before);
 f.game.equip(f.hero.id,before.inventory.find(i=>i.source==='starter'&&i.slot==='weapon').id);const next=f.game.previewJunkSale(f.hero.id);f.add('guardian-weapon-1',{attack:1});before=f.game.state(f.hero.id);
 assert.throws(()=>f.game.sellJunk(f.hero.id,request(next)),e=>e.code==='STALE_SALE');assert.deepEqual(f.game.state(f.hero.id),before);
});
test('vendita in blocco: errore di cancellazione ripristina oggetti e ricavo nella stessa transazione',t=>{
 const f=fixture(t);f.add('guardian-weapon-0',{attack:2});f.add('guardian-weapon-1',{attack:1});const preview=f.game.previewJunkSale(f.hero.id),before=f.game.state(f.hero.id),input=request(preview);
 f.sql.exec("CREATE TRIGGER reject_bulk BEFORE DELETE ON item_instances BEGIN SELECT RAISE(ABORT,'rollback'); END");
 assert.throws(()=>f.game.sellJunk(f.hero.id,input));assert.deepEqual(f.game.state(f.hero.id),before);assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind='bulk_sale'").get().n,0);
 f.sql.exec('DROP TRIGGER reject_bulk');assert.equal(f.game.sellJunk(f.hero.id,input).hero.coins,preview.coins);
});
test('vendita in blocco: appartenenza, input, anteprima vuota e battaglia sono validati dal motore',t=>{
 const f=fixture(t);const empty=f.game.previewJunkSale(f.hero.id);assert.throws(()=>f.game.sellJunk(f.hero.id,request(empty)));
 f.add('guardian-weapon-0',{attack:2});const preview=f.game.previewJunkSale(f.hero.id),other=f.characters.create({name:'Elara',classId:'ranger',sex:'female'}),input=request(preview);
 assert.throws(()=>f.game.sellJunk(other.id,input),e=>e.code==='STALE_SALE');
 for(const bad of [null,{},'bad',{token:preview.token,requestId:'no'}, {token:'no',requestId:randomUUID()}])assert.throws(()=>f.game.sellJunk(f.hero.id,bad));
 f.sql.prepare('UPDATE characters SET steps=1000 WHERE id=?').run(f.hero.id);let battle=f.game.startBattle(f.hero.id,'normal');assert.throws(()=>f.game.previewJunkSale(f.hero.id));assert.throws(()=>f.game.sellJunk(f.hero.id,input));
 f.game.act(f.hero.id,{battleId:battle.battle.id,round:0,action:'flee'});f.game.sellJunk(f.hero.id,input);assert.throws(()=>f.game.sellJunk(other.id,input),/altro eroe/);
});

const rarityFilter=(rarity='common',includeConsumables=false)=>({rarities:Array.isArray(rarity)?rarity:[rarity],includeConsumables});
const rarityRequest=preview=>({...preview.filter,token:preview.token,requestId:randomUUID()});
test('vendita per rarità: tutte le rarità includono anche miglioramenti, set e oggetti futuri; mai indossati o incantati',t=>{
 const f=fixture(t);let protectedId;
 for(const r of C.RARITIES){const template=r.id==='unique'?'guardian-set-3-weapon':'guardian-weapon-0';const item=f.add(template,{attack:100},{rarity:r.id,level:r.id==='unique'?30:5});const preview=f.game.previewRaritySale(f.hero.id,rarityFilter(r.id));assert.ok(preview.items.some(i=>i.id===item.id),r.id);assert.ok(preview.items.every(i=>i.rarity===r.id));}
 const enchanted=f.add('guardian-weapon-0',{attack:1});protectedId=enchanted.id;f.sql.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(enchanted.id,f.hero.id,'flame',JSON.stringify([{attribute_id:'attack_percent',value:30}]),new Date().toISOString());
 const before=f.game.state(f.hero.id),preview=f.game.previewRaritySale(f.hero.id,rarityFilter()),after=f.game.sellRarity(f.hero.id,rarityRequest(preview));assert.equal(after.hero.coins,before.hero.coins+preview.coins);assert.deepEqual(after.equipment,before.equipment);assert.ok(after.inventory.some(i=>i.id===protectedId));for(const item of preview.items)assert.ok(!after.inventory.some(i=>i.id===item.id));
});
test('vendita per rarità: consumabili esclusi inizialmente, inclusi solo dal filtro esplicito e reagenti conservati',t=>{
 const f=fixture(t),food=f.add('food-0'),potion=f.add('potion-heal-0'),gear=f.add('guardian-weapon-0');f.sql.prepare('INSERT INTO reagent_inventory VALUES(?,?,2)').run(f.hero.id,'ember');const gearOnly=f.game.previewRaritySale(f.hero.id,rarityFilter());assert.deepEqual(gearOnly.items.map(i=>i.id),[gear.id]);const all=f.game.previewRaritySale(f.hero.id,rarityFilter('common',true));assert.deepEqual(new Set(all.items.map(i=>i.id)),new Set([food.id,potion.id,gear.id]));const after=f.game.sellRarity(f.hero.id,rarityRequest(all));assert.equal(after.inventory.length,2);assert.equal(after.alchemy.reagents.find(r=>r.id==='ember').quantity,2);
});
test('vendita per rarità: anteprima scaduta dopo equipaggiamento o incantamento blocca tutta la vendita',t=>{
 const f=fixture(t),a=f.add('guardian-weapon-0'),b=f.add('guardian-weapon-1'),preview=f.game.previewRaritySale(f.hero.id,rarityFilter());f.game.equip(f.hero.id,a.id);const before=f.game.state(f.hero.id);assert.throws(()=>f.game.sellRarity(f.hero.id,rarityRequest(preview)),e=>e.code==='STALE_SALE');assert.deepEqual(f.game.state(f.hero.id),before);
 const next=f.game.previewRaritySale(f.hero.id,rarityFilter());f.sql.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(b.id,f.hero.id,'flame','[]',new Date().toISOString());const enchanted=f.game.state(f.hero.id);assert.throws(()=>f.game.sellRarity(f.hero.id,rarityRequest(next)),e=>e.code==='STALE_SALE');assert.deepEqual(f.game.state(f.hero.id),enchanted);
});
test('vendita per rarità: richiesta idempotente persistente, prezzo autorevole e filtri non intercambiabili',t=>{
 const f=fixture(t);f.add('guardian-weapon-0');const preview=f.game.previewRaritySale(f.hero.id,rarityFilter()),input={...rarityRequest(preview),items:[],coins:999999},after=f.game.sellRarity(f.hero.id,input);assert.equal(after.hero.coins,preview.coins);assert.deepEqual(f.game.sellRarity(f.hero.id,input),after);f.reopen();assert.deepEqual(f.game.sellRarity(f.hero.id,input),after);assert.throws(()=>f.game.sellRarity(f.hero.id,{...input,rarities:['rare']}));assert.throws(()=>f.game.sellRarity(f.hero.id,{...input,includeConsumables:true}));
});
test('vendita per rarità: transazione atomica, input validato, nessun aggiramento del filtro o del proprietario',t=>{
 const f=fixture(t);f.add('guardian-weapon-0');f.add('guardian-weapon-1');const preview=f.game.previewRaritySale(f.hero.id,rarityFilter()),input=rarityRequest(preview),before=f.game.state(f.hero.id);f.sql.exec("CREATE TRIGGER fail_rarity BEFORE DELETE ON item_instances BEGIN SELECT RAISE(ABORT,'rollback'); END");assert.throws(()=>f.game.sellRarity(f.hero.id,input));assert.deepEqual(f.game.state(f.hero.id),before);f.sql.exec('DROP TRIGGER fail_rarity');
 for(const filter of [undefined,null,{},'common',rarityFilter('fake'),{rarity:'common',includeConsumables:'yes'}])assert.throws(()=>f.game.previewRaritySale(f.hero.id,filter));
 assert.throws(()=>f.game.sellRarity(f.hero.id,{...input,rarities:['rare']}),e=>e.code==='STALE_SALE');assert.throws(()=>f.game.sellRarity(f.hero.id,{...input,includeConsumables:true}),e=>e.code==='STALE_SALE');assert.deepEqual(f.game.state(f.hero.id),before);
 const other=f.characters.create({name:'Elara',classId:'ranger',sex:'female'});assert.throws(()=>f.game.sellRarity(other.id,input));
 f.sql.prepare('UPDATE characters SET steps=1000 WHERE id=?').run(f.hero.id);const battle=f.game.startBattle(f.hero.id,'normal');assert.throws(()=>f.game.previewRaritySale(f.hero.id,rarityFilter()));assert.throws(()=>f.game.sellRarity(f.hero.id,input));f.game.act(f.hero.id,{battleId:battle.battle.id,round:0,action:'flee'});f.game.sellRarity(f.hero.id,input);assert.throws(()=>f.game.sellRarity(other.id,input),/altro eroe/);
});
test('vendita per rarità: la preparazione alchemica protegge il pezzo prima e dopo la scelta',t=>{
 const f=fixture(t),item=f.add('guardian-weapon-0');f.sql.prepare('UPDATE characters SET steps=1000 WHERE id=?').run(f.hero.id);f.sql.prepare('INSERT INTO reagent_inventory VALUES(?,?,1)').run(f.hero.id,'ember');const requestId=randomUUID();f.game.prepareEnchantment(f.hero.id,{requestId,itemId:item.id,recipeId:'flame',boost:false,stabilizer:false});assert.ok(!f.game.previewRaritySale(f.hero.id,rarityFilter()).items.some(i=>i.id===item.id));f.game.applyEnchantment(f.hero.id,{attemptId:requestId,choice:0});assert.ok(!f.game.previewRaritySale(f.hero.id,rarityFilter('common',true)).items.some(i=>i.id===item.id));
});
test('vendita per rarità: checkbox multiple, ordine canonico, una vendita e selezione vuota senza danni',t=>{
 const f=fixture(t),a=f.add('guardian-weapon-0',null,{rarity:'common'}),b=f.add('guardian-weapon-0',null,{rarity:'uncommon'}),c=f.add('guardian-weapon-0',null,{rarity:'rare'});
 const preview=f.game.previewRaritySale(f.hero.id,rarityFilter(['uncommon','common']));assert.deepEqual(preview.filter.rarities,['common','uncommon']);assert.deepEqual(new Set(preview.items.map(i=>i.id)),new Set([a.id,b.id]));
 assert.equal(preview.token,f.game.previewRaritySale(f.hero.id,rarityFilter(['common','uncommon'])).token);
 const input=rarityRequest(preview),after=f.game.sellRarity(f.hero.id,input);assert.equal(after.hero.coins,preview.coins);assert.ok(after.inventory.some(i=>i.id===c.id));assert.deepEqual(f.game.sellRarity(f.hero.id,{...input,rarities:['uncommon','common']}),after);
 const empty=f.game.previewRaritySale(f.hero.id,rarityFilter([]));assert.equal(empty.items.length,0);assert.throws(()=>f.game.sellRarity(f.hero.id,rarityRequest(empty)));assert.deepEqual(f.game.state(f.hero.id),after);
 for(const rarities of [['common','common'],['fake'],null,'common',[1]])assert.throws(()=>f.game.previewRaritySale(f.hero.id,{rarities,includeConsumables:false}));
});
