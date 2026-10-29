'use strict';
const {raritySelection}=require('./rarity-selection.cjs');
function createLootFilter({db,rarities,outsideBattle,money,GameError}){
 rarities=rarities.slice().sort((a,b)=>a.rank-b.rank);
 db.exec('CREATE TABLE IF NOT EXISTS loot_filter_migrations(version INTEGER PRIMARY KEY) STRICT;');
 const version=db.prepare('SELECT max(version) version FROM loot_filter_migrations').get().version||0;
 if(version>1)throw new Error('Versione filtro bottino non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
  CREATE TABLE loot_filters(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),keep_rarities TEXT NOT NULL CHECK(json_valid(keep_rarities))) STRICT;
  INSERT INTO loot_filter_migrations VALUES(1);COMMIT;`);
 function validate(input){
  if(!input||typeof input.enabled!=='boolean')throw new GameError('Filtro di rarità non valido.');
  const keepRarities=raritySelection(input.keepRarities,rarities,GameError);
  if(input.enabled&&!keepRarities.length)throw new GameError('Seleziona almeno una rarità da conservare.');
  return {enabled:input.enabled,keepRarities};
 }
 function read(id){
  const row=db.prepare('SELECT * FROM loot_filters WHERE character_id=?').get(id);
  return row?validate({enabled:!!row.enabled,keepRarities:JSON.parse(row.keep_rarities)}):{enabled:false,keepRarities:rarities.map(r=>r.id)};
 }
 function save(id,input){
  outsideBattle(id);const filter=validate(input);
  db.prepare('INSERT INTO loot_filters VALUES(?,?,?) ON CONFLICT(character_id) DO UPDATE SET enabled=excluded.enabled,keep_rarities=excluded.keep_rarities').run(id,Number(filter.enabled),JSON.stringify(filter.keepRarities));
 }
 // Only newly generated IDs are eligible. A saved battle without a snapshot keeps all loot.
 function apply(id,reference,snapshot,items,source='monster'){
  if(!snapshot?.enabled)return {drops:items.map(i=>i.id),autoSold:[],autoSaleCoins:0};
  const filter=validate(snapshot),drops=[],autoSold=[];
  const remove=db.prepare(`DELETE FROM item_instances WHERE id=? AND character_id=? AND location='inventory' AND source=?
   AND NOT EXISTS(SELECT 1 FROM equipped_items WHERE item_id=?)
   AND NOT EXISTS(SELECT 1 FROM item_enchantments WHERE item_id=?)
   AND NOT EXISTS(SELECT 1 FROM alchemy_attempts WHERE item_id=? AND choice_index IS NULL)`);
  for(const item of items){
   if(filter.keepRarities.includes(item.rarity)){drops.push(item.id);continue;}
   const result=remove.run(item.id,id,source,item.id,item.id,item.id);
   if(result.changes!==1){drops.push(item.id);continue;}
   autoSold.push({id:item.id,name:item.name,rarity:item.rarity,sellPrice:Math.max(1,Math.floor(item.price*.25))});
  }
  const autoSaleCoins=autoSold.reduce((sum,item)=>sum+item.sellPrice,0);
  if(autoSold.length)money(id,'loot_auto_sale',0,autoSaleCoins,'loot-auto-sale:'+reference);
  return {drops,autoSold,autoSaleCoins};
 }
 return {read,save,apply,applyExpedition:(id,expeditionId,items)=>apply(id,'expedition:'+expeditionId,read(id),items,'expedition')};
}
module.exports={createLootFilter};
