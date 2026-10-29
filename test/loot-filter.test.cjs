'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs'),{createLootFilter}=require('../lib/loot-filter.cjs'),{generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-loot-')),file=path.join(dir,'game.sqlite'),characters=createCharactersRepository(file),hero=characters.create({name:'Thorin',classId:'guardian',sex:'male'}),sql=new DatabaseSync(file);let random=.5,game=createGameRepository(file,{rng:()=>random});game.state(hero.id);sql.prepare('UPDATE characters SET steps=10000 WHERE id=?').run(hero.id);
 t.after(()=>{game.close();sql.close();characters.close();fs.rmSync(dir,{recursive:true,force:true});});
 const start=(difficulty='easy')=>{const state=game.startBattle(hero.id,difficulty);sql.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(state.battle.id);return state.battle.id;};
 const win=battleId=>game.act(hero.id,{battleId,round:0,action:'attack'});
 return {sql,hero,characters,start,win,get game(){return game;},rng(value){random=value;},reopen(){game.close();game=createGameRepository(file,{rng:()=>random});}};
}
const keepRare={enabled:true,keepRarities:['rare','mythic','legendary','unique']};
test('filtro bottino: disattivato inizialmente, per eroe, persistente, non vende lo zaino e cancellazione a cascata',t=>{
 const f=fixture(t),before=f.game.state(f.hero.id);assert.equal(before.lootFilter.enabled,false);assert.deepEqual(before.lootFilter.keepRarities,C.RARITIES.slice().sort((a,b)=>a.rank-b.rank).map(r=>r.id));
 const state=f.game.saveLootFilter(f.hero.id,keepRare);assert.deepEqual(state.inventory,before.inventory);assert.equal(state.hero.coins,before.hero.coins);f.reopen();assert.deepEqual(f.game.state(f.hero.id).lootFilter,keepRare);
 const other=f.characters.create({name:'Elara',classId:'ranger',sex:'female'});assert.equal(f.game.state(other.id).lootFilter.enabled,false);f.characters.remove(f.hero.id,'Thorin');assert.equal(f.sql.prepare('SELECT count(*) n FROM loot_filters').get().n,0);
});
test('filtro bottino: input esplicito validato e modifiche vietate durante lo scontro',t=>{
 const f=fixture(t),before=f.game.state(f.hero.id);for(const bad of [null,{},'rare',{enabled:1,keepRarities:['rare']},{enabled:true,keepRarities:[]},{enabled:true,keepRarities:['rare','rare']},{enabled:true,keepRarities:['fake']},{enabled:true,keepRarities:'rare'}])assert.throws(()=>f.game.saveLootFilter(f.hero.id,bad));assert.deepEqual(f.game.state(f.hero.id),before);
 const id=f.start();assert.throws(()=>f.game.saveLootFilter(f.hero.id,keepRare));f.game.act(f.hero.id,{battleId:id,round:0,action:'flee'});assert.deepEqual(f.game.saveLootFilter(f.hero.id,keepRare).lootFilter,keepRare);
});
test('filtro bottino: ricavo normale atomico al termine, solo nuovi drop, riepilogo e retry idempotente',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,keepRare);const before=f.game.state(f.hero.id),id=f.start(),after=f.win(id),r=after.battle.rewards;assert.equal(after.battle.status,'won');assert.ok(r.autoSold.length);assert.equal(r.drops.length,0);assert.ok(r.autoSaleCoins>0);assert.equal(r.autoSaleCoins,r.autoSold.reduce((n,i)=>n+i.sellPrice,0));assert.equal(after.hero.coins,before.hero.coins+r.coins+r.autoSaleCoins);assert.deepEqual(after.inventory,before.inventory);assert.equal(after.lootProgress.dryWins,0);assert.ok(after.battle.log.some(s=>s.startsWith('Filtro bottino:')));
 assert.deepEqual(f.game.autoBattle(f.hero.id,{battleId:id,round:0}),after);assert.throws(()=>f.win(id));f.reopen();assert.deepEqual(f.game.state(f.hero.id),after);assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind='loot_auto_sale'").get().n,1);
});
test('filtro bottino: rarità conservate e disattivazione non alterano i premi',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,{enabled:true,keepRarities:['uncommon','unique']});let r=f.win(f.start()).battle.rewards;assert.equal(r.drops.length,1);assert.equal(r.autoSaleCoins,0);assert.equal(r.autoSold.length,0);assert.equal(f.game.state(f.hero.id).inventory.find(i=>i.id===r.drops[0]).rarity,'uncommon');
 f.game.saveLootFilter(f.hero.id,{enabled:false,keepRarities:['unique']});r=f.win(f.start()).battle.rewards;assert.equal(r.drops.length,1);assert.equal(r.autoSaleCoins,0);
});
test('filtro bottino: snapshot persistito, vecchi combattimenti conservano tutto, fuga senza vendite',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,keepRare);let id=f.start();assert.deepEqual(f.game.state(f.hero.id).battle.buffs.lootFilter,keepRare);
 f.sql.prepare('UPDATE loot_filters SET enabled=0 WHERE character_id=?').run(f.hero.id);f.reopen();assert.equal(f.win(id).battle.rewards.autoSold.length,1);
 id=f.start();const buffs=f.game.state(f.hero.id).battle.buffs;delete buffs.lootFilter;f.sql.prepare('UPDATE battles SET buffs=? WHERE id=?').run(JSON.stringify(buffs),id);assert.equal(f.win(id).battle.rewards.autoSold.length,0);
 f.game.saveLootFilter(f.hero.id,keepRare);id=f.start();const before=f.game.state(f.hero.id);const fled=f.game.act(f.hero.id,{battleId:id,round:0,action:'flee'});assert.equal(fled.battle.rewards,null);assert.equal(fled.hero.coins,before.hero.coins);assert.deepEqual(fled.inventory,before.inventory);
});
test('filtro bottino: errore di accredito ripristina combattimento, ricavi e oggetti',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,keepRare);const id=f.start(),before=f.game.state(f.hero.id);f.sql.exec("CREATE TRIGGER reject_auto_sale BEFORE INSERT ON wallet_events WHEN NEW.kind='loot_auto_sale' BEGIN SELECT RAISE(ABORT,'rollback'); END");assert.throws(()=>f.win(id));assert.deepEqual(f.game.state(f.hero.id),before);assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind='battle'").get().n,0);f.sql.exec('DROP TRIGGER reject_auto_sale');assert.equal(f.win(id).battle.rewards.autoSold.length,1);
});
test('filtro bottino: elite vende entrambi i drop, reagenti e garanzia bottino restano',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,keepRare);f.rng(.01);const r=f.win(f.start('elite')).battle.rewards;assert.equal(r.autoSold.length,2);assert.equal(r.drops.length,0);assert.ok(r.reagents.length);const after=f.game.state(f.hero.id);assert.equal(after.lootProgress.dryWins,0);assert.ok(after.alchemy.reagents.some(r=>r.quantity>0));
});
test('filtro bottino: anche i nuovi consumabili seguono il filtro, mai equipaggiati, incantati o altrui',t=>{
 const f=fixture(t);const other=f.characters.create({name:'Elara',classId:'ranger',sex:'female'});f.game.state(other.id);
 const add=(template,owner=f.hero.id,source='monster')=>{const i=generateItem(C.TEMPLATES.find(t=>t.id===template),{source,rng:()=>.5});insertItem(f.sql,owner,i);return i;};
 const food=add('food-0'),potion=add('potion-heal-0'),enchanted=add('guardian-weapon-0'),equipped=add('guardian-weapon-0'),foreign=add('ring-0',other.id),merchant=add('ring-0',f.hero.id,'merchant');
 f.sql.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(enchanted.id,f.hero.id,'flame','[]',new Date().toISOString());f.game.equip(f.hero.id,equipped.id);
 const filter=createLootFilter({db:f.sql,rarities:C.RARITIES,outsideBattle:()=>{},money:(id,kind,steps,coins)=>f.sql.prepare('UPDATE characters SET coins=coins+? WHERE id=?').run(coins,id),GameError:Error});
 const r=filter.apply(f.hero.id,'unit-test',keepRare,[food,potion,enchanted,equipped,foreign,merchant]);assert.deepEqual(r.autoSold.map(i=>i.id),[food.id,potion.id]);assert.equal(r.autoSaleCoins,Math.floor(food.price*.25)+Math.floor(potion.price*.25));for(const item of [enchanted,equipped,foreign,merchant])assert.ok(f.sql.prepare('SELECT 1 FROM item_instances WHERE id=?').get(item.id));
});
test('filtro bottino: bottino misto conserva rari e unici con valori originali, vende solo le qualità escluse',t=>{
 const f=fixture(t),items=['common','uncommon','rare','unique'].map(rarity=>{const item=generateItem(C.TEMPLATES.find(t=>t.id===(rarity==='unique'?'guardian-set-3-weapon':'guardian-weapon-0')),{rarity,level:30,depth:60,source:'monster',rng:()=>.5});insertItem(f.sql,f.hero.id,item);return item;});
 const original=f.sql.prepare('SELECT * FROM item_instances WHERE id=?').get(items[3].id),filter=createLootFilter({db:f.sql,rarities:C.RARITIES,outsideBattle:()=>{},money:()=>{},GameError:Error});const r=filter.apply(f.hero.id,'mixed',keepRare,items);assert.deepEqual(r.drops,[items[2].id,items[3].id]);assert.deepEqual(r.autoSold.map(i=>i.id),[items[0].id,items[1].id]);assert.deepEqual(f.sql.prepare('SELECT * FROM item_instances WHERE id=?').get(items[3].id),original);
});
test('filtro bottino: spedizione filtra pattuglia, custode e premio finale; saldi e retry persistenti',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,{enabled:true,keepRarities:['unique']});let state=f.game.startExpedition(f.hero.id,{route:'grove',requestId:require('node:crypto').randomUUID()});const inventory=state.inventory;const choice=option=>{state=f.game.chooseExpedition(f.hero.id,{id:state.expedition.id,version:state.expedition.version,option,automatic:false});};
 choice('patrol');f.sql.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(state.battle.id);state=f.win(state.battle.id);assert.equal(state.expedition.status,'active');assert.equal(state.battle.rewards.autoSold.length,1);assert.equal(state.battle.rewards.drops.length,0);f.reopen();assert.deepEqual(f.game.state(f.hero.id),state);
 for(const option of ['bless','herbs','guardian'])choice(option);assert.deepEqual(state.battle.buffs.lootFilter,{enabled:true,keepRarities:['unique']});const coinsBefore=state.hero.coins;f.sql.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(state.battle.id);state=f.win(state.battle.id);
 assert.equal(state.expedition.status,'completed');assert.equal(state.battle.rewards.autoSold.length,2);assert.equal(state.expedition.rewards.drops.length,0);assert.equal(state.expedition.rewards.autoSold.length,1);assert.equal(state.expedition.rewards.autoSold[0].rarity,'uncommon');assert.equal(state.expedition.lootSales.autoSold.length,4);assert.equal(state.expedition.lootSales.autoSaleCoins,state.expedition.lootSales.autoSold.reduce((sum,i)=>sum+i.sellPrice,0));assert.deepEqual(state.inventory.map(i=>i.id),inventory.map(i=>i.id));
 assert.equal(state.hero.coins,coinsBefore+state.battle.rewards.coins+state.battle.rewards.autoSaleCoins+state.expedition.rewards.coins+state.expedition.rewards.autoSaleCoins);assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind='loot_auto_sale'").get().n,3);assert.ok(state.expedition.log.some(line=>line.includes('venduto il premio finale')));
 assert.deepEqual(f.game.autoBattle(f.hero.id,{battleId:state.battle.id,round:0}),state);f.reopen();assert.deepEqual(f.game.state(f.hero.id),state);assert.deepEqual(f.game.returnExpedition(f.hero.id,{id:state.expedition.id,version:state.expedition.version}),state);
});
test('filtro bottino: premio finale conservato se selezionato o con filtro spento, anche con scontro automatico',t=>{
 for(const filter of [{enabled:true,keepRarities:['uncommon','unique']},{enabled:false,keepRarities:['unique']}]){
  const f=fixture(t);f.game.saveLootFilter(f.hero.id,filter);let state=f.game.startExpedition(f.hero.id,{route:'grove',requestId:require('node:crypto').randomUUID()});
  for(const option of ['search','bless','herbs','guardian'])state=f.game.chooseExpedition(f.hero.id,{id:state.expedition.id,version:state.expedition.version,option,automatic:true});
  assert.equal(state.expedition.status,'completed');assert.equal(state.expedition.rewards.autoSaleCoins,0);assert.equal(state.expedition.rewards.autoSold.length,0);assert.equal(state.expedition.rewards.drops.length,1);assert.ok(state.inventory.some(i=>i.id===state.expedition.rewards.drops[0]&&i.rarity==='uncommon'));assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind='loot_auto_sale'").get().n,0);
 }
});
test('filtro bottino: errore sul premio finale annulla vittoria, tutte le vendite e conclusione della spedizione',t=>{
 const f=fixture(t);f.game.saveLootFilter(f.hero.id,{enabled:true,keepRarities:['unique']});let state=f.game.startExpedition(f.hero.id,{route:'grove',requestId:require('node:crypto').randomUUID()});
 for(const option of ['search','bless','herbs','guardian'])state=f.game.chooseExpedition(f.hero.id,{id:state.expedition.id,version:state.expedition.version,option,automatic:false});const id=state.battle.id;f.sql.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(id);const before=f.game.state(f.hero.id);
 f.sql.exec("CREATE TRIGGER reject_final_sale BEFORE INSERT ON wallet_events WHEN NEW.reference LIKE 'loot-auto-sale:expedition:%' BEGIN SELECT RAISE(ABORT,'rollback'); END");assert.throws(()=>f.win(id));assert.deepEqual(f.game.state(f.hero.id),before);assert.equal(f.sql.prepare("SELECT count(*) n FROM wallet_events WHERE kind IN('loot_auto_sale','battle','expedition_reward')").get().n,0);f.sql.exec('DROP TRIGGER reject_final_sale');assert.equal(f.win(id).expedition.rewards.autoSold.length,1);
});
test('filtro bottino: migrazione indipendente conserva saldo, inventario e scontro già iniziato',t=>{
 const f=fixture(t),id=f.start(),before=f.game.state(f.hero.id),buffs={...before.battle.buffs};delete buffs.lootFilter;f.sql.prepare('UPDATE battles SET buffs=? WHERE id=?').run(JSON.stringify(buffs),id);f.sql.exec('DROP TABLE loot_filters;DROP TABLE loot_filter_migrations');f.reopen();const after=f.game.state(f.hero.id);assert.deepEqual(after.inventory,before.inventory);assert.deepEqual(after.hero,before.hero);assert.deepEqual(after.battle,{...before.battle,buffs});assert.equal(after.lootFilter.enabled,false);assert.equal(f.win(id).battle.rewards.autoSold.length,0);
});
