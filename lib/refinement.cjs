'use strict';
const COSTS=[300,600,1000,1500,2200],PERCENT=6;
const round=value=>Math.round(value*100)/100;
const multiplier=rank=>1+rank*PERCENT/100;
const costFor=(rank,level)=>Math.round(COSTS[rank]*(1+Math.min(2,Math.floor(level/10)*.2)));
function createRefinement({db,data,ownItem,requireUsable,outsideBattle,money,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS refinement_migrations(version INTEGER PRIMARY KEY) STRICT;');
 const version=db.prepare('SELECT max(version) version FROM refinement_migrations').get().version||0;
 if(version>1)throw new Error('Versione rifinitura non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE item_refinements(item_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 5)) STRICT;
 INSERT INTO refinement_migrations VALUES(1);COMMIT;`);
 function decorate(item,knownRank){
  const rank=knownRank??(db.prepare('SELECT rank FROM item_refinements WHERE item_id=?').get(item.id)?.rank||0),m=multiplier(rank),next=multiplier(Math.min(COSTS.length,rank+1));
  const scale=value=>value>0?round(value*m):value;
  const changes=[];
  for(const [stat,value]of Object.entries(item.baseStats))if(value>0)changes.push({label:data.STATS[stat].label,unit:data.STATS[stat].percent?'percent':'flat',before:scale(value),after:round(value*next)});
  for(const roll of item.rolls)if(roll.value>0){const a=data.ATTRIBUTES.find(a=>a.id===roll.attribute_id);changes.push({label:a.label,unit:a.unit,before:scale(roll.value),after:round(roll.value*next)});}
  return {...item,name:item.name+(rank?' +'+rank:''),baseStats:Object.fromEntries(Object.entries(item.baseStats).map(([key,value])=>[key,scale(value)])),rolls:item.rolls.map(r=>r.value>0?{...r,value:scale(r.value),min:scale(r.min),max:scale(r.max)}:r),refinement:{rank,maxRank:COSTS.length,percent:rank*PERCENT,multiplier:m,nextMultiplier:next,nextCost:rank<COSTS.length?costFor(rank,item.level):null,eligible:!item.effect&&['weapon','body','feet','ring','amulet'].includes(item.slot)&&changes.length>0,changes}};
 }
 function refine(id,input){
  outsideBattle(id);
  if(db.prepare("SELECT 1 FROM expeditions WHERE character_id=? AND status='active'").get(id))throw new GameError('Rientra dalla spedizione prima di usare il laboratorio.');
  if(typeof input?.requestId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.requestId)||typeof input.itemId!=='string'||!Number.isInteger(input.rank)||input.rank<0||input.rank>=COSTS.length)throw new GameError('Richiesta di rifinitura non valida.');
  const reference='refinement:'+input.requestId,kind=`refinement:${input.itemId}:${input.rank+1}`,prior=db.prepare('SELECT character_id,kind FROM wallet_events WHERE reference=?').get(reference);
  if(prior){if(prior.character_id!==id||prior.kind!==kind)throw new GameError('Richiesta di rifinitura non valida.');return;}
  const item=ownItem(id,input.itemId);requireUsable(id,item);
  if(!db.prepare('SELECT 1 FROM equipped_items WHERE character_id=? AND item_id=?').get(id,item.id))throw new GameError('Indossa il pezzo prima di rifinirlo.');
  if(item.alchemyPending)throw new GameError('Completa prima la preparazione alchemica di questo oggetto.');
  if(!item.refinement.eligible)throw new GameError('Questo pezzo non ha statistiche positive da rifinire.');
  if(item.refinement.rank!==input.rank)throw new GameError('Il grado è cambiato. Riapri la rifinitura.','STALE_REFINEMENT');
  money(id,kind,-item.refinement.nextCost,0,reference);
  db.prepare('INSERT INTO item_refinements VALUES(?,?,?) ON CONFLICT(item_id) DO UPDATE SET rank=excluded.rank').run(item.id,id,input.rank+1);
 }
 return {decorate,refine,rules:{maxRank:COSTS.length,percentPerRank:PERCENT,costs:COSTS}};
}
module.exports={createRefinement,costFor};
