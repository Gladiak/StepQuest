'use strict';
const {generateItem,insertItem,pick,weighted}=require('./game-items.cjs');
const costFor=(level,type)=>400+Math.min(600,Math.floor(level/10)*100)+(type==='set'?200:0);
function createResearch({db,data,rng,progress,getHero,outsideBattle,filterRewards,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS research_migrations(version INTEGER PRIMARY KEY) STRICT;');
 const version=db.prepare('SELECT max(version) version FROM research_migrations').get().version||0;
 if(version>1)throw new Error('Versione ricerca non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE expedition_research(expedition_id TEXT PRIMARY KEY REFERENCES expeditions(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,target TEXT NOT NULL CHECK(json_valid(target)),options TEXT CHECK(options IS NULL OR json_valid(options)),choice INTEGER CHECK(choice BETWEEN 0 AND 1)) STRICT;
 CREATE UNIQUE INDEX one_research_reward ON expedition_research(character_id) WHERE options IS NOT NULL AND choice IS NULL;
 INSERT INTO research_migrations VALUES(1);COMMIT;`);
 function catalog(id){const p=progress(id),hero=getHero(id);return {slotCost:costFor(p.level,'slot'),setCost:costFor(p.level,'set'),minimumRarity:p.level>=4?'rare':'uncommon',sets:data.SETS.filter(s=>!s.unique&&s.class_id===hero.class_id&&s.min_level<=p.level).map(s=>({id:s.id,name:s.name})),slots:['weapon','body','feet','ring','amulet']};}
 function targetFor(id,input){
  if(!input||!['slot','set'].includes(input.type)||typeof input.id!=='string')throw new GameError('Obiettivo di ricerca non valido.');
  const choices=catalog(id);if(!(input.type==='slot'?choices.slots:choices.sets.map(s=>s.id)).includes(input.id))throw new GameError('Obiettivo di ricerca non disponibile.');
  return {type:input.type,id:input.id};
 }
 function pending(id){const row=db.prepare('SELECT * FROM expedition_research WHERE character_id=? AND options IS NOT NULL AND choice IS NULL').get(id);return row?{expeditionId:row.expedition_id,target:JSON.parse(row.target),options:JSON.parse(row.options)}:null;}
 function start(id,expeditionId,target){db.prepare('INSERT INTO expedition_research VALUES(?,?,?,NULL,NULL)').run(expeditionId,id,JSON.stringify(target));}
 function matches(expeditionId,target){const row=db.prepare('SELECT target FROM expedition_research WHERE expedition_id=?').get(expeditionId);return !!row&&row.target===JSON.stringify({type:target?.type,id:target?.id});}
 function prepare(e){
  const row=db.prepare('SELECT * FROM expedition_research WHERE expedition_id=?').get(e.id);if(!row)throw new GameError('Ricerca non trovata.');if(row.options)return;
  const target=JSON.parse(row.target),level=progress(e.character_id).level,hero=getHero(e.character_id);
  let pool=data.TEMPLATES.filter(t=>!t.starter&&!t.effect&&t.min_level<=level&&(!t.class_id||t.class_id===hero.class_id)&&(target.type==='set'?t.set_id===target.id:!t.set_id&&t.slot===target.id));
  if(!pool.length)throw new GameError('Obiettivo di ricerca non disponibile.');
  const tiers=level<4?[{id:'uncommon',weight:1}]:[{id:'rare',weight:75},...(level>=8?[{id:'mythic',weight:22}]:[]),...(level>=15?[{id:'legendary',weight:3}]:[])];
  const options=[];for(let index=0;index<2;index++){const template=pick(rng,pool);options.push(generateItem(template,{rarity:weighted(rng,tiers).id,level,depth:e.start_stage,rng,catalog:data,source:'expedition'}));if(pool.length>1)pool=pool.filter(t=>t.id!==template.id);}
  db.prepare('UPDATE expedition_research SET options=? WHERE expedition_id=?').run(JSON.stringify(options),e.id);
 }
 function choose(id,input){
  outsideBattle(id);if(typeof input?.expeditionId!=='string'||!Number.isInteger(input.choice)||input.choice<0||input.choice>1)throw new GameError('Scelta di ricerca non valida.');
  const row=db.prepare('SELECT r.*,e.status,e.rewards,e.log FROM expedition_research r JOIN expeditions e ON e.id=r.expedition_id WHERE r.expedition_id=? AND r.character_id=?').get(input.expeditionId,id);
  if(!row||row.status!=='completed'||!row.options)throw new GameError('Premio di ricerca non disponibile.');
  if(row.choice!==null){if(row.choice!==input.choice)throw new GameError('Premio di ricerca già scelto.');return;}
  const item=JSON.parse(row.options)[input.choice];insertItem(db,id,item);const loot=filterRewards(id,row.expedition_id,[item]);
  db.prepare('UPDATE expedition_research SET choice=? WHERE expedition_id=?').run(input.choice,row.expedition_id);
  const log=JSON.parse(row.log);log.push('Premio della ricerca riscattato.');if(loot.autoSold.length)log.push(`Filtro bottino: venduti ${loot.autoSold.length} oggetti · +${loot.autoSaleCoins} monete.`);
  db.prepare('UPDATE expeditions SET rewards=?,log=?,version=version+1 WHERE id=?').run(JSON.stringify({...JSON.parse(row.rewards),...loot,researchPending:false}),JSON.stringify(log),row.expedition_id);
 }
 return {catalog,targetFor,pending,start,matches,prepare,choose,costFor,target:expeditionId=>{const row=db.prepare('SELECT target FROM expedition_research WHERE expedition_id=?').get(expeditionId);return row?JSON.parse(row.target):null;}};
}
module.exports={createResearch,costFor};
