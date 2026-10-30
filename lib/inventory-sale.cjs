'use strict';
const {createHash}=require('node:crypto');
const {raritySelection}=require('./rarity-selection.cjs');

// La selezione prudente conserva anche consumabili, set e vantaggi alternativi.
function weakerItems(state){
 return state.inventory.filter(item=>!item.enchantment&&!item.refinement?.rank&&!item.alchemyPending&&!item.equippedSlot&&!item.effect&&!item.setId&&item.comparisons?.length&&
  item.comparisons.every(c=>c.eligible&&c.current&&c.changes.length&&c.changes.every(change=>change.delta<=0)));
}
function createInventorySale({db,view,outsideBattle,money,GameError}){
 function filterFor(state,input){
  if(!input||typeof input.includeConsumables!=='boolean')throw new GameError('Filtro di rarità non valido.');
  return {rarities:raritySelection(input.rarities,state.rarities,GameError),includeConsumables:input.includeConsumables};
 }
 function preview(id,input=null){
  outsideBattle(id);const state=view(id),filter=input===null?null:filterFor(state,input);
  const candidates=filter?state.inventory.filter(item=>filter.rarities.includes(item.rarity)&&!item.equippedSlot&&!item.enchantment&&!item.refinement?.rank&&!item.alchemyPending&&(filter.includeConsumables||!item.effect)):weakerItems(state);
  const items=candidates.map(({id,name,rarity,level,sellPrice,slot})=>({id,name,rarity,level,sellPrice,slot}));
  const coins=items.reduce((sum,item)=>sum+item.sellPrice,0);
  if(!Number.isSafeInteger(coins))throw new GameError('Ricavo non valido.');
  const token=createHash('sha256').update(JSON.stringify({hero:id,filter,level:state.hero.level,stats:state.hero.stats,equipment:Object.entries(state.equipment).map(([slot,item])=>[slot,item.id]).sort(),items})).digest('hex');
  return {items,coins,token,...(filter?{filter}:{})};
 }
 function sell(id,input,byRarity=false){
  outsideBattle(id);
  if(typeof input?.requestId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.requestId)||typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token))throw new GameError('Richiesta di vendita non valida.');
  const filter=byRarity?filterFor(view(id),input):null,kind=byRarity?`rarity_sale:${filter.rarities.join('+')}:${filter.includeConsumables?'all':'gear'}`:'bulk_sale';
  const reference=(byRarity?'rarity-sale:':'bulk-sale:')+input.requestId,prior=db.prepare('SELECT character_id,kind FROM wallet_events WHERE reference=?').get(reference);
  if(prior){if(prior.character_id!==id)throw new GameError('Vendita riservata a un altro eroe.');if(prior.kind!==kind)throw new GameError('Filtro di rarità non valido.');return;}
  const current=preview(id,filter);
  if(current.token!==input.token)throw new GameError('Lo zaino o l’equipaggiamento sono cambiati. Riapri l’anteprima prima di vendere.','STALE_SALE');
  if(!current.items.length)throw new GameError(byRarity?'Nessun oggetto vendibile per le rarità selezionate.':'Nessun oggetto più debole da vendere.');
  money(id,kind,0,current.coins,reference);
  const remove=db.prepare(`DELETE FROM item_instances WHERE id=? AND character_id=? AND location='inventory'
   AND NOT EXISTS(SELECT 1 FROM equipped_items WHERE item_id=?)
   AND NOT EXISTS(SELECT 1 FROM item_enchantments WHERE item_id=?)
   AND NOT EXISTS(SELECT 1 FROM item_refinements WHERE item_id=? AND rank>0)
   AND NOT EXISTS(SELECT 1 FROM alchemy_attempts WHERE item_id=? AND choice_index IS NULL)`);
  for(const item of current.items){const result=remove.run(item.id,id,item.id,item.id,item.id,item.id);if(result.changes!==1)throw new GameError('Lo zaino è cambiato. Riprova la vendita.','STALE_SALE');}
 }
 return {preview:id=>preview(id),sell:(id,input)=>sell(id,input),previewRarity:(id,input)=>{if(input==null)throw new GameError('Filtro di rarità non valido.');return preview(id,input);},sellRarity:(id,input)=>sell(id,input,true)};
}
module.exports={createInventorySale,weakerItems};
