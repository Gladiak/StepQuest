'use strict';
// Dati esclusivi del database temporaneo del test Electron. Nessun IPC di debug esposto.
const {DatabaseSync}=require('node:sqlite');
const {scopeForKey}=require('../lib/steps-repository.cjs');
const {today,shiftDate}=require('../lib/dates.cjs');
const C=require('../lib/game-catalog.cjs');
const {generateItem,insertItem}=require('../lib/game-items.cjs');
exports.seedSteps=repository=>{const scope=scopeForKey('electron-smoke-isolated-fixture'),date=today();repository.activate(scope);repository.save(scope,{from:date,to:date,fetchedAt:new Date().toISOString(),days:[{date,steps:10000,goal:6000,distanceMeters:7000}]});const yesterday=shiftDate(date,-1);repository.save(scope,{from:yesterday,to:yesterday,fetchedAt:new Date().toISOString(),days:[{date:yesterday,steps:5000,goal:6000,distanceMeters:3500}]});};
exports.showcase=(filename,hero)=>{
 const db=new DatabaseSync(filename);const created={};let seed=41;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 try{db.exec('BEGIN IMMEDIATE');for(const rarity of C.RARITIES.filter(r=>r.id!=='unique')){let item;do{item=generateItem(C.TEMPLATES.find(t=>t.id===hero.class_id+'-weapon-0'),{rarity:rarity.id,level:1,rng,source:'test-showcase'});}while(item.rolls.length!==rarity.max);insertItem(db,hero.id,item);created[rarity.id]=item.id;}
  const set=C.SETS.find(s=>s.class_id===hero.class_id),setItem=generateItem(C.TEMPLATES.find(t=>t.id===set.id+'-weapon'),{level:5,rarity:'rare',rng,source:'test-showcase'});insertItem(db,hero.id,setItem);created.set=setItem.id;db.exec('COMMIT');return created;
 }finally{db.close();}
};

exports.jewelry=(filename,hero)=>{const db=new DatabaseSync(filename),result={};try{db.exec('BEGIN IMMEDIATE');for(const [key,template,stats]of [['ring1','ring-0',{attack:2}],['ring2','ring-1',{attack:10}],['amulet','amulet-0',{health:15}],['replacement','ring-2',{attack:5}]]){const item=generateItem(C.TEMPLATES.find(t=>t.id===template),{source:'test-jewelry'});item.baseStats=stats;insertItem(db,hero.id,item);result[key]=item.id;}db.exec('COMMIT');return result;}finally{db.close();}};

exports.expeditionStories=()=>{const {makePlan,ROUTES}=require('../lib/expedition-catalog.cjs');return [0,1,2,3].map(index=>makePlan(ROUTES[0],1,()=>(index+.1)/4)[2]);};
exports.setExpeditionStory=(filename,id,node)=>{const db=new DatabaseSync(filename);try{const row=db.prepare('SELECT plan FROM expeditions WHERE id=?').get(id),plan=JSON.parse(row.plan),original=plan[2];plan[2]=node;db.prepare('UPDATE expeditions SET plan=? WHERE id=?').run(JSON.stringify(plan),id);return original;}finally{db.close();}};

exports.junkSale=(filename,hero)=>{
 const db=new DatabaseSync(filename),ids={};try{db.exec('BEGIN IMMEDIATE');
 for(const [key,template,level]of [['inferior',hero.class_id+'-weapon-0',1],['food','food-0',1],['future',hero.class_id+'-weapon-0',hero.level+10]]){
  const item=generateItem(C.TEMPLATES.find(t=>t.id===template),{level,source:'test-junk-sale'});if(key==='inferior')item.baseStats={attack:1};insertItem(db,hero.id,item);ids[key]=item.id;
 }db.exec('COMMIT');return ids;}finally{db.close();}
};
exports.heroState=(filename,id,values)=>{const db=new DatabaseSync(filename);try{const before={hp:db.prepare('SELECT hp FROM hero_progress WHERE character_id=?').get(id).hp,coins:db.prepare('SELECT coins FROM characters WHERE id=?').get(id).coins};db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(values.hp,id);db.prepare('UPDATE characters SET coins=? WHERE id=?').run(values.coins,id);db.exec('COMMIT');return before;}finally{db.close();}};

exports.dailyWellness=filename=>{const db=new DatabaseSync(filename);try{const scope=db.prepare("SELECT value FROM app_state WHERE name='active_scope'").get().value,date=today();const m={date,fetchedAt:new Date().toISOString(),moderate:30,vigorous:15,sleepScore:85,sleepSeconds:28000,stress:null,stressDate:shiftDate(date,-1)};db.prepare('INSERT INTO daily_wellness VALUES(?,?,?,?) ON CONFLICT(scope_id,calendar_date) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').run(scope,date,JSON.stringify(m),m.fetchedAt);}finally{db.close();}};

exports.uniqueSet=(filename,heroId=null)=>{const db=new DatabaseSync(filename);try{const hero=heroId?db.prepare('SELECT * FROM characters WHERE id=?').get(heroId):db.prepare('SELECT * FROM characters ORDER BY created_at LIMIT 1').get(),set=C.SETS.find(s=>s.unique&&s.class_id===hero.class_id);const item=generateItem(C.TEMPLATES.find(t=>t.id===set.id+'-weapon'),{level:30,depth:60,rarity:'unique',rng:()=>.5,source:'test-unique'});insertItem(db,hero.id,item);return item.id;}finally{db.close();}};

exports.weakenBattle=(filename,id,guaranteeLoot=false)=>{const db=new DatabaseSync(filename);try{db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(id);if(guaranteeLoot){const heroId=db.prepare('SELECT character_id FROM battles WHERE id=?').get(id).character_id;db.prepare('INSERT INTO loot_progress VALUES(?,2) ON CONFLICT(character_id) DO UPDATE SET dry_wins=2').run(heroId);}}finally{db.close();}};

exports.alchemy=(filename,heroId=null)=>{const db=new DatabaseSync(filename);try{const hero=heroId?db.prepare('SELECT * FROM characters WHERE id=?').get(heroId):db.prepare('SELECT * FROM characters ORDER BY created_at LIMIT 1').get();for(const r of require('../lib/alchemy-catalog.cjs').REAGENTS)db.prepare('INSERT INTO reagent_inventory VALUES(?,?,3) ON CONFLICT(character_id,reagent_id) DO UPDATE SET quantity=3').run(hero.id,r.id);return hero.id;}finally{db.close();}};

exports.reagentReceipt=(filename,battleId)=>{const db=new DatabaseSync(filename);try{const b=db.prepare('SELECT * FROM battles WHERE id=?').get(battleId),rewards=JSON.parse(b.rewards),r=require('../lib/alchemy-catalog.cjs').REAGENTS.find(r=>r.id==='sulfur');rewards.reagents=[{id:r.id,name:r.name,quantity:1}];db.prepare('UPDATE battles SET rewards=? WHERE id=?').run(JSON.stringify(rewards),battleId);db.prepare('INSERT INTO reagent_inventory VALUES(?,?,1) ON CONFLICT(character_id,reagent_id) DO UPDATE SET quantity=quantity+1').run(b.character_id,r.id);}finally{db.close();}};

exports.raritySale=(filename,heroId=null)=>{const db=new DatabaseSync(filename);try{const hero=heroId?db.prepare('SELECT * FROM characters WHERE id=?').get(heroId):db.prepare('SELECT * FROM characters ORDER BY created_at LIMIT 1').get(),ids={};for(const r of C.RARITIES){const t=C.TEMPLATES.find(t=>t.id===(r.id==='unique'?'guardian-set-3-weapon':hero.class_id+'-weapon-0')),item=generateItem(t,{rarity:r.id,level:r.id==='unique'?30:1,rng:()=>.5,source:'rarity-sale-fixture'});insertItem(db,hero.id,item);ids[r.id]=item.id;}const protectedItem=generateItem(C.TEMPLATES.find(t=>t.id===hero.class_id+'-weapon-0'),{source:'rarity-sale-protected'});insertItem(db,hero.id,protectedItem);db.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(protectedItem.id,hero.id,'flame','[{"attribute_id":"attack_percent","value":5}]',new Date().toISOString());ids.enchanted=protectedItem.id;return ids;}finally{db.close();}};

exports.stepProgression=(filename,heroId)=>{const db=new DatabaseSync(filename);try{db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE hero_progress SET level=30,stage=60 WHERE character_id=?').run(heroId);db.prepare('UPDATE characters SET steps=30000 WHERE id=?').run(heroId);for(const [slot,template]of [['feet','boots-0'],['ring1','ring-0'],['ring2','ring-1'],['amulet','amulet-0']]){const item=generateItem(C.TEMPLATES.find(t=>t.id===template),{rarity:'rare',level:30,depth:60,rng:()=>.5,source:'test-step-progression'});insertItem(db,heroId,item);db.prepare('INSERT INTO equipped_items VALUES(?,?,?) ON CONFLICT(character_id,slot) DO UPDATE SET item_id=excluded.item_id').run(heroId,slot,item.id);}db.exec('COMMIT');}finally{db.close();}};
