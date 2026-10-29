'use strict';
const {DatabaseSync}=require('node:sqlite');
const {combatTurn}=require('./combat-turn.cjs');
const {createSettlement}=require('./settlement.cjs');
const {createDailyEffectsStore}=require('./daily-effects.cjs');
const {today:currentDay}=require('./dates.cjs');
const {dateRange}=require('./dates.cjs');
const {randomUUID}=require('node:crypto');
const C=require('./game-catalog.cjs');
const {dropChance,encounterProfile,enemyStats,restPlan,nextStage}=require('./combat-balance.cjs');
const {ROUTES}=require('./expedition-catalog.cjs');
const createExpeditions=require('./expeditions.cjs');
const {compareStats}=require('./item-comparison.cjs');
const {createAlchemy}=require('./alchemy.cjs');
const {createInventorySale}=require('./inventory-sale.cjs');
const {createRefinement}=require('./refinement.cjs');
const {createResearch}=require('./research.cjs');
const {createLootFilter}=require('./loot-filter.cjs');
const {migrateGame,initializeHero,baseStats}=require('./game-schema.cjs');
const {migrateHeroStepClaims}=require('./hero-step-claims.cjs');
const {random,pick,rollItem,insertItem,effectFor}=require('./game-items.cjs');
class GameError extends Error{constructor(message,code='GAME'){super(message);this.code=code;}}
const experienceNeeded=level=>80+level*40;
function loadCatalog(db){
 const rarities=db.prepare('SELECT * FROM item_rarities ORDER BY rank').all().map(r=>({id:r.id,name:r.name,rank:r.rank,min:r.min_properties,max:r.max_properties,scale:r.roll_scale,weight:r.weight,light:r.color_light,dark:r.color_dark}));
 const attributes=db.prepare('SELECT * FROM attribute_definitions').all();
 const affixes=db.prepare('SELECT * FROM affix_definitions').all().map(a=>({...a,text:a.name,slots:JSON.parse(a.slots_json),rolls:db.prepare('SELECT attribute_id,sign,min_value AS min,max_value AS max,chance FROM affix_ranges WHERE affix_id=? ORDER BY sign DESC').all(a.id)}));
 const templates=db.prepare('SELECT * FROM item_templates').all().map(t=>({...t,unique:!!C.SETS.find(s=>s.id===t.set_id)?.unique,base_stats:JSON.parse(t.base_stats),starter:!!t.starter,effect:t.effect?JSON.parse(t.effect):null}));
 const sets=db.prepare('SELECT * FROM item_sets').all().map(s=>({...s,unique:!!C.SETS.find(x=>x.id===s.id)?.unique,min_depth:C.SETS.find(x=>x.id===s.id)?.min_depth||0,bonuses:db.prepare('SELECT pieces,attribute_id,value,rarity_id AS rarity FROM set_bonuses WHERE set_id=? ORDER BY pieces').all(s.id)}));
 const stats=Object.fromEntries(db.prepare('SELECT * FROM stat_definitions').all().map(s=>[s.id,{label:s.label,base:s.base,cap:s.cap,percent:!!s.is_percent}]));
 const rules=Object.fromEntries(db.prepare('SELECT * FROM game_rules').all().map(r=>[r.id,r.value]));
 return {STATS:stats,RULES:rules,RARITIES:rarities,ATTRIBUTES:attributes,AFFIXES:affixes,TEMPLATES:templates,SETS:sets};
}
function createGameRepository(filename,{rng=random,today=currentDay,now=Date.now}={}){
 const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL;');migrateGame(db);try{migrateHeroStepClaims(db);}catch(error){db.close();throw error;}const data=loadCatalog(db);const daily=createDailyEffectsStore(db,{today,now});
 const getHero=id=>{const hero=db.prepare('SELECT * FROM characters WHERE id=?').get(id);if(!hero)throw new GameError('Personaggio non trovato.');return hero;};
 const progress=id=>db.prepare('SELECT * FROM hero_progress WHERE character_id=?').get(id);
 const active=id=>db.prepare("SELECT * FROM battles WHERE character_id=? AND status='active'").get(id);
 const outsideBattle=id=>{if(active(id)||settlement.arenaActive(id))throw new GameError('Completa lo scontro o ritirati prima di questa azione.');};
 function transaction(action){db.exec('BEGIN IMMEDIATE');try{const result=action();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
 const templateById=new Map(data.TEMPLATES.map(t=>[t.id,t]));
 function itemView(row,metadata=null){
  if(!row)return null;const template=templateById.get(row.template_id);
  return refinement.decorate({id:row.id,templateId:row.template_id,name:row.name,rarity:row.rarity_id,level:row.item_level,price:row.price,sellPrice:Math.max(1,Math.floor(row.price*.25)),slot:template.slot,category:template.category,sprite:template.sprite,classId:template.class_id,setId:template.set_id,baseStats:JSON.parse(row.base_stats),rolls:JSON.parse(row.rolls),effect:effectFor(template,row.item_level),source:row.source,generationDepth:row.generation_depth,depthMultiplier:row.depth_multiplier,enchantment:metadata?(metadata.enchants.get(row.id)||null):alchemy.enchantment(row.id),alchemyPending:metadata?metadata.pending.has(row.id):!!db.prepare('SELECT 1 FROM alchemy_attempts WHERE item_id=? AND choice_index IS NULL').get(row.id)},metadata?(metadata.ranks.get(row.id)||0):undefined);
 }
 const ownItem=(id,itemId)=>{const item=db.prepare("SELECT * FROM item_instances WHERE id=? AND character_id=? AND location='inventory'").get(itemId,id);if(!item)throw new GameError('Questo oggetto non è nel tuo zaino.');return itemView(item);};
 const equipped=(id,metadata=null)=>Object.fromEntries(db.prepare('SELECT e.slot,i.* FROM equipped_items e JOIN item_instances i ON i.id=e.item_id WHERE e.character_id=?').all(id).map(row=>[row.slot,itemView(row,metadata)]));
 function evaluate(id,override=null,context=null){
  const hero=context?.hero||getHero(id),p=context?.progress||progress(id),equipment=override||equipped(id),totals=baseStats(hero.class_id,p.level,data.STATS),adds={},scales={},sets=[];
  const apply=roll=>{const a=data.ATTRIBUTES.find(x=>x.id===roll.attribute_id);if(!a)throw new GameError('Attributo non riconosciuto nel salvataggio.');const target=a.operation==='scale'?scales:adds;target[a.stat]=(target[a.stat]||0)+roll.value;};
  for(const item of Object.values(equipment)){for(const [stat,value]of Object.entries(item.baseStats))adds[stat]=(adds[stat]||0)+value;item.rolls.forEach(apply);item.enchantment?.rolls.forEach(apply);}
  for(const set of data.SETS.filter(s=>s.class_id===hero.class_id)){
   const count=new Set(Object.values(equipment).filter(item=>item.setId===set.id).map(item=>item.templateId)).size;if(!count)continue;
   sets.push({...set,pieces:count,bonuses:set.bonuses.map(b=>({...b,active:count>=b.pieces}))});
   for(const bonus of set.bonuses)if(count>=bonus.pieces)apply({attribute_id:bonus.attribute_id,value:bonus.value});
  }
  const boosts=context&&Object.hasOwn(context,'boosts')?context.boosts:(()=>{const row=db.prepare("SELECT boosts FROM expeditions WHERE character_id=? AND status='active'").get(id);return row?JSON.parse(row.boosts):null;})();if(boosts){scales.attack=(scales.attack||0)+(boosts.attack||0);adds.defense=(adds.defense||0)+(boosts.defense||0);}
  for(const [stat,definition]of Object.entries(data.STATS)){
   const value=(totals[stat]+(adds[stat]||0))*(1+(scales[stat]||0)/100);
   const lower=stat==='health'?1:stat==='attack'?1:stat==='accuracy'?30:stat==='critical_damage'?100:0;
   totals[stat]=Math.max(lower,Math.min(definition.cap,Math.round(value*100)/100));
  }
  totals.health=Math.floor(totals.health);return {stats:totals,equipment,sets};
 }
 function money(id,kind,steps,coins,reference=randomUUID()){
  const hero=getHero(id);if(hero.steps+steps<0||hero.coins+coins<0)throw new GameError('Saldo insufficiente.');
  if(!Number.isSafeInteger(hero.steps+steps)||!Number.isSafeInteger(hero.coins+coins))throw new GameError('Saldo non valido.');
  db.prepare('INSERT INTO wallet_events VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,kind,steps,coins,reference,new Date().toISOString());
  db.prepare('UPDATE characters SET steps=steps+?,coins=coins+? WHERE id=?').run(steps,coins,id);
 }
 function fillMerchant(id){
  const hero=getHero(id),p=progress(id);
  for(const category of ['weapons','weapons','weapons','armor','armor','armor','supplies','supplies','potions','potions','potions','supplies']){
   const item=rollItem(hero.class_id,p.level,{rng,source:'merchant',category,depth:p.stage,catalog:data});insertItem(db,id,item,'merchant');db.prepare('INSERT INTO merchant_offers VALUES(?,?,?)').run(item.id,id,item.price);
  }
 }
 function ensure(id){const hero=getHero(id);initializeHero(db,id,hero.class_id);if(!db.prepare('SELECT 1 FROM merchant_state WHERE character_id=?').get(id)){db.prepare('INSERT INTO merchant_state(character_id) VALUES(?)').run(id);fillMerchant(id);}}
 function battleView(row){return row?{id:row.id,status:row.status,stage:row.stage,enemy:JSON.parse(row.enemy),enemyHp:row.enemy_hp,round:row.round,log:JSON.parse(row.log),buffs:JSON.parse(row.buffs),rewards:row.rewards?JSON.parse(row.rewards):null}:null;}
 function view(id){
  const hero=getHero(id),p=progress(id),metadata={
   enchants:new Map(db.prepare('SELECT * FROM item_enchantments WHERE character_id=?').all(id).map(r=>[r.item_id,{recipeId:r.recipe_id,rolls:JSON.parse(r.rolls),bound:true}])),
   ranks:new Map(db.prepare('SELECT item_id,rank FROM item_refinements WHERE character_id=?').all(id).map(r=>[r.item_id,r.rank])),
   pending:new Set(db.prepare('SELECT item_id FROM alchemy_attempts WHERE character_id=? AND choice_index IS NULL').all(id).map(r=>r.item_id)),
   versions:new Map(db.prepare('SELECT r.item_id,r.version FROM smith_reforges r JOIN item_instances i ON i.id=r.item_id WHERE i.character_id=?').all(id).map(r=>[r.item_id,r.version]))
  },journey=db.prepare("SELECT boosts FROM expeditions WHERE character_id=? AND status='active'").get(id),context={hero,progress:p,boosts:journey?JSON.parse(journey.boosts):null},values=evaluate(id,equipped(id,metadata),context),battle=db.prepare('SELECT * FROM battles WHERE character_id=? ORDER BY rowid DESC LIMIT 1').get(id);
  const withComparison=item=>{
   const slots=C.compatibleSlots(item.slot);if(!slots.length||item.effect)return item;
   const equippedSlot=Object.keys(values.equipment).find(slot=>values.equipment[slot].id===item.id)||null;
   const comparisons=slots.map(slot=>{
    const current=values.equipment[slot],equipment={...values.equipment};
    if(equippedSlot)delete equipment[equippedSlot];equipment[slot]=item;
    const after=current?.id===item.id?values:evaluate(id,equipment,context);
    return {...compareStats(values.stats,after.stats,{item,current,hero:{...hero,level:p.level},stage:p.stage,definitions:data.STATS}),slot};
   });
   const preferred=equippedSlot||slots.find(slot=>!values.equipment[slot])||comparisons.slice().sort((a,b)=>b.gainPercent-a.gainPercent)[0].slot;
   return {...item,equippedSlot,comparisons,comparison:comparisons.find(c=>c.slot===preferred)};
  };
  const recovery=restPlan(p.hp,values.stats.health,hero.coins),pendingResearch=research.pending(id);
  const researchView={...research.catalog(id),pending:pendingResearch?{...pendingResearch,options:pendingResearch.options.map(item=>withComparison(itemView({id:item.id,template_id:item.template_id,name:item.name,rarity_id:item.rarity,item_level:item.level,price:item.price,base_stats:JSON.stringify(item.baseStats),rolls:JSON.stringify(item.rolls),source:item.source,generation_depth:item.generationDepth,depth_multiplier:item.depthMultiplier},metadata)))}:null};
  return {...settlement.view(id,metadata),refinement:refinement.rules,research:researchView,alchemy:alchemy.view(id),lootFilter:lootFilter.read(id),lootProgress:{dryWins:db.prepare('SELECT dry_wins FROM loot_progress WHERE character_id=?').get(id)?.dry_wins||0,guaranteeAfter:3},dailyCondition:{...daily.read(id),battleEffects:active(id)?JSON.parse(active(id).buffs).dailyEffects||{xpPercent:0,healingPercent:0,attackPercent:0}:null},restPlan:recovery,restCost:recovery.cost,fullRestCost:Math.max(0,values.stats.health-p.hp),hero:{...hero,level:p.level,xp:p.xp,xpNeeded:experienceNeeded(p.level),hp:Math.min(p.hp,values.stats.health),stage:p.stage,stats:values.stats},equipment:Object.fromEntries(Object.entries(values.equipment).map(([slot,item])=>[slot,withComparison(item)])),sets:values.sets,classSets:data.SETS.filter(s=>s.class_id===hero.class_id).map(s=>({...s,pieces:values.sets.find(x=>x.id===s.id)?.pieces||0})),
   inventory:db.prepare("SELECT * FROM item_instances WHERE character_id=? AND location='inventory' ORDER BY created_at,id").all(id).map(row=>withComparison(itemView(row,metadata))),
   merchant:{revision:db.prepare('SELECT revision FROM merchant_state WHERE character_id=?').get(id).revision,refreshCost:data.RULES.merchant_refresh_base+p.level*data.RULES.merchant_refresh_per_level,offers:db.prepare('SELECT i.* FROM merchant_offers m JOIN item_instances i ON i.id=m.item_id WHERE m.character_id=? ORDER BY i.created_at,i.id').all(id).map(row=>withComparison(itemView(row,metadata)))},
   expedition:expeditions.view(id),routes:ROUTES,challenges:['easy','normal','elite'].map(difficulty=>({...encounterProfile(p.stage,p.level,difficulty),cost:data.RULES.encounter_steps,dropChance:difficulty!=='elite'&&(db.prepare('SELECT dry_wins FROM loot_progress WHERE character_id=?').get(id)?.dry_wins||0)>=2?1:dropChance(difficulty,values.stats.loot_bonus)})),battle:battleView(battle),enemies:C.ENEMIES.map(({id,name})=>({id,name})),rarities:data.RARITIES,attributes:data.ATTRIBUTES,definitions:data.STATS,rules:data.RULES,slotLabels:C.SLOTS,library:{templates:data.TEMPLATES.length,affixes:data.AFFIXES.length,attributes:data.ATTRIBUTES.length,sets:data.SETS.length},encounterCost:data.RULES.encounter_steps};
 }
 const change=(id,action)=>transaction(()=>{ensure(id);action();return view(id);});
 function requireUsable(id,item){const hero=getHero(id);if(item.classId&&item.classId!==hero.class_id)throw new GameError('Oggetto riservato a un’altra classe.');if(item.level>progress(id).level)throw new GameError(`Richiede il livello ${item.level}.`);}
 function useConsumable(id,item,buffs,inBattle){
  requireUsable(id,item);if(!item.effect)throw new GameError('Questo oggetto non è un consumabile.');const stats=evaluate(id).stats,effect=item.effect;
  if(effect.kind==='food'&&inBattle)throw new GameError('Puoi mangiare soltanto fuori dal combattimento.');
  if(effect.kind==='guard'&&!inBattle)throw new GameError('Usa la pozione protettiva durante uno scontro.');
  if(effect.kind==='antidote'&&!(buffs.poison>0))throw new GameError('Non hai un veleno da rimuovere.');
  if(['heal','food'].includes(effect.kind)&&progress(id).hp>=stats.health)throw new GameError('La tua vita è già al massimo.');
  if(effect.kind==='guard'){buffs.guard=effect.turns;buffs.protection=effect.amount;}
  else if(effect.kind==='antidote'){buffs.poison=0;db.prepare('UPDATE hero_progress SET hp=min(?,hp+?) WHERE character_id=?').run(stats.health,effect.amount,id);}
  else db.prepare('UPDATE hero_progress SET hp=min(?,hp+?) WHERE character_id=?').run(stats.health,Math.round(effect.amount*(1+stats.potion_power/100)*(1+((inBattle?buffs.dailyEffects:daily.read(id).effects)?.healingPercent||0)/100)),id);
  if(effect.kind==='food')daily.relieve(id);
  db.prepare('DELETE FROM item_instances WHERE id=? AND character_id=?').run(item.id,id);
 }
 function reward(id,battle,enemy,log){
  const stats=evaluate(id).stats,p=progress(id),xp=Math.round(enemy.xp*(1+stats.xp_bonus/100)*(1+(JSON.parse(battle.buffs).dailyEffects?.xpPercent||0)/100)),coins=Math.round(enemy.coins*(1+stats.gold_bonus/100));
  money(id,'battle',0,coins,'battle:'+battle.id);
  let remaining=p.xp+xp,level=p.level;while(remaining>=experienceNeeded(level)){remaining-=experienceNeeded(level);level++;}
  db.prepare('UPDATE hero_progress SET level=?,xp=?,stage=max(stage,?) WHERE character_id=?').run(level,remaining,nextStage(p.stage,battle.stage,enemy),id);
  if(level>p.level){const max=evaluate(id).stats.health;db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(max,id);log.push(`Sei salito al livello ${level}. Vita recuperata.`);}
  const generated=[],dry=db.prepare('SELECT dry_wins FROM loot_progress WHERE character_id=?').get(id)?.dry_wins||0;
  const chance=enemy.elite?1:Math.min(.95,(enemy.dropChance??.65)*(1+stats.loot_bonus/100));
  if(enemy.elite||dry>=2||rng()<chance){const hero=getHero(id);for(let n=0;n<(enemy.dropCount||1);n++){const item=rollItem(hero.class_id,Math.max(1,level),{rng,source:'monster',elite:enemy.elite,depth:battle.stage,allowUnique:n===0,catalog:data});insertItem(db,id,item);generated.push(item);}}
  db.prepare('INSERT INTO loot_progress VALUES(?,?) ON CONFLICT(character_id) DO UPDATE SET dry_wins=excluded.dry_wins').run(id,generated.length?0:dry+1);
  const loot=lootFilter.apply(id,battle.id,JSON.parse(battle.buffs).lootFilter,generated);
  for(const item of generated)if(loot.drops.includes(item.id))log.push('Bottino: '+item.name+'.');
  if(loot.autoSold.length)log.push(`Filtro bottino: venduti ${loot.autoSold.length} oggetti · +${loot.autoSaleCoins} monete.`);
  const reagents=alchemy.award(id,enemy);for(const r of reagents)log.push('Reagente: '+r.name+'.');return {xp,coins,...loot,reagents,levels:level-p.level};
 }
 function startEncounter(id,difficulty,battleId=randomUUID(),journey=null){
   outsideBattle(id);if(!['easy','normal','elite'].includes(difficulty))throw new GameError('Sfida non valida.');const hero=getHero(id),p=progress(id);
   const expedition=expeditions.active(id);if(expedition&&journey?.expeditionId!==expedition.id)throw new GameError('Scegli un incontro nella spedizione in corso.');
   const profile=encounterProfile(p.stage,p.level,difficulty),stage=journey?.stage||profile.stage,elite=profile.elite;
   if(p.hp<Math.max(15,evaluate(id).stats.health*.2))throw new GameError('Recupera la vita con Riposa prima di affrontare un altro scontro.');
   const model=journey?.boss?C.ENEMIES[2]:pick(rng,C.ENEMIES),factor=(journey?(elite?1.18:1):profile.factor)*(journey?.factor||1);
   const enemy={...model,balanceVersion:2,level:stage,...enemyStats(stage,factor,p.level),elite,difficulty,heavyMultiplier:elite?1.5:1.65,dropCount:profile.dropCount,dropChance:profile.dropChance};
   if(journey){const traits=[{name:'Famelico',attack:1.15,health:.9,heavyEvery:2},{name:'Corazzato',attack:.9,health:1.15,armor:2,heavyEvery:4},{name:'Velenoso',attack:.9,health:1,poison:true,heavyEvery:3}];const trait=pick(rng,traits);enemy.name=journey.boss?'Custode del sentiero':`${model.name} · ${trait.name}`;enemy.attack=Math.round(enemy.attack*trait.attack);enemy.health=Math.round(enemy.health*trait.health);enemy.defense+=trait.armor||0;enemy.heavyEvery=trait.heavyEvery;enemy.poison=enemy.poison||!!trait.poison;enemy.trait=trait.name;enemy.expeditionId=journey.expeditionId;}
   else money(id,'encounter',-data.RULES.encounter_steps,0,'encounter:'+battleId);
   db.prepare("INSERT INTO battles(id,character_id,status,stage,enemy,enemy_hp,log,buffs,created_at) VALUES(?,?,'active',?,?,?,?,?,?)").run(battleId,id,stage,JSON.stringify(enemy),enemy.health,JSON.stringify([journey?`${enemy.name} difende questa tappa. Nessun costo aggiuntivo.`:`${enemy.name} ti sbarra il sentiero. Spesi ${data.RULES.encounter_steps} passi.`]),JSON.stringify({dailyEffects:daily.read(id).effects,dailyDate:today(),lootFilter:lootFilter.read(id)}),new Date().toISOString());
 }
 function resolveTurn(id,input){
   const battle=active(id);if(!battle||battle.id!==input?.battleId||battle.round!==input.round)throw new GameError('Il turno è già cambiato. Aggiorna lo scontro.','STALE_TURN');
   if(!['attack','defend','potion','flee'].includes(input.action))throw new GameError('Azione non valida.');
   const enemy=JSON.parse(battle.enemy),buffs=JSON.parse(battle.buffs),log=JSON.parse(battle.log),stats=evaluate(id).stats;let hp=progress(id).hp,enemyHp=battle.enemy_hp,status='active',rewards=null;
   if(input.action==='flee'){status='fled';log.push('Ti ritiri al rifugio. Nessun bottino o esperienza.');}
   else{
    if(input.action==='potion'){const item=ownItem(id,input.itemId);useConsumable(id,item,buffs,true);hp=progress(id).hp;log.push(`Usi ${item.name}.`);}
    ({hp,enemyHp,status}=combatTurn({stats,hp,enemy,enemyHp,round:battle.round,buffs,action:input.action,rng,log}));
    db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(hp,id);
    if(status==='won'){rewards=reward(id,battle,enemy,log);log.push(`Vittoria: +${rewards.xp} esperienza e +${rewards.coins} monete.`);}
   }
   db.prepare('UPDATE battles SET status=?,enemy_hp=?,round=round+1,log=?,buffs=?,rewards=?,finished_at=? WHERE id=?').run(status,Math.max(0,enemyHp),JSON.stringify(log.slice(-24)),JSON.stringify(buffs),rewards?JSON.stringify(rewards):null,status==='active'?null:new Date().toISOString(),battle.id);
   expeditions.onBattleFinished(id,battle,status);
 }
 function resolveAutomatically(id,input){
  if(typeof input?.battleId!=='string'||!Number.isSafeInteger(input.round))throw new GameError('Scontro non valido.');
  const battle=active(id);
  if(!battle){const done=db.prepare('SELECT status FROM battles WHERE id=? AND character_id=?').get(input.battleId,id);if(done&&done.status!=='active')return;throw new GameError('Scontro non disponibile.');}
  if(battle.id!==input.battleId||battle.round!==input.round)throw new GameError('Il turno è già cambiato. Aggiorna lo scontro.','STALE_TURN');
  for(let turn=0;turn<250;turn++){const current=active(id);if(!current)return;resolveTurn(id,{battleId:current.id,round:current.round,action:'attack'});}
 }
 function equipOwned(id,input){outsideBattle(id);const item=ownItem(id,typeof input==='string'?input:input?.itemId);requireUsable(id,item);const slots=C.compatibleSlots(item.slot);if(!slots.length)throw new GameError('Oggetto non equipaggiabile.');const equipment=equipped(id),worn=Object.keys(equipment).find(slot=>equipment[slot].id===item.id);const slot=typeof input==='object'?input?.slot:(worn||slots.find(s=>!equipment[s])||view(id).inventory.find(i=>i.id===item.id).comparison.slot);if(!slots.includes(slot))throw new GameError('Questo oggetto non può essere indossato nello slot scelto.');db.prepare('DELETE FROM equipped_items WHERE character_id=? AND item_id=?').run(id,item.id);db.prepare('INSERT INTO equipped_items VALUES(?,?,?) ON CONFLICT(character_id,slot) DO UPDATE SET item_id=excluded.item_id').run(id,slot,item.id);db.prepare('UPDATE hero_progress SET hp=min(hp,?) WHERE character_id=?').run(evaluate(id).stats.health,id);}
 function purchase(id,itemId){outsideBattle(id);const offer=db.prepare('SELECT * FROM merchant_offers WHERE character_id=? AND item_id=?').get(id,itemId);if(!offer)throw new GameError('Articolo già acquistato o non disponibile.');money(id,'purchase',0,-offer.price,'purchase:'+itemId);db.prepare("UPDATE item_instances SET location='inventory' WHERE id=? AND character_id=?").run(itemId,id);db.prepare('DELETE FROM merchant_offers WHERE item_id=?').run(itemId);}
 const alchemy=(()=>{try{return createAlchemy({db,rng,ownItem,requireUsable,outsideBattle,money,GameError});}catch(error){db.close();throw error;}})();
 const lootFilter=(()=>{try{return createLootFilter({db,rarities:data.RARITIES,outsideBattle,money,GameError});}catch(error){db.close();throw error;}})();
 const refinement=(()=>{try{return createRefinement({db,data,ownItem,requireUsable,outsideBattle,money,GameError});}catch(error){db.close();throw error;}})();
 const research=(()=>{try{return createResearch({db,data,rng,progress,getHero,outsideBattle,filterRewards:(id,expeditionId,items)=>lootFilter.applyExpedition(id,expeditionId,items),GameError});}catch(error){db.close();throw error;}})();
 const expeditions=createExpeditions({db,data,rng,money,getHero,progress,evaluate,outsideBattle,startEncounter,resolveAutomatically,research,filterRewards:(id,expeditionId,items)=>lootFilter.applyExpedition(id,expeditionId,items),GameError});
 const settlement=(()=>{try{return createSettlement({db,data,rng,now,today,getHero,progress,evaluate,money,outsideBattle,GameError});}catch(error){db.close();throw error;}})();
 const inventorySale=createInventorySale({db,view,outsideBattle,money,GameError});
 return Object.freeze({
  previewCraft:(id,input)=>transaction(()=>{ensure(id);return settlement.quoteCraft(id,input);}),
  queueMining:(id,input)=>change(id,()=>settlement.queueMine(id,input)),
  startMining:(id,input)=>change(id,()=>settlement.startMine(id,input)),
  collectMining:(id,input)=>change(id,()=>settlement.collectMine(id,input)),
  upgradeMine:(id,input)=>change(id,()=>settlement.upgradeMine(id,input)),
  craftItem:(id,input)=>change(id,()=>settlement.craft(id,input)),
  reforgeItem:(id,input)=>change(id,()=>settlement.reforge(id,input)),
  startArena:(id,input)=>change(id,()=>settlement.startArena(id,input)),
  arenaAction:(id,input)=>change(id,()=>settlement.arenaTurn(id,input)),
  refineItem:(id,input)=>change(id,()=>refinement.refine(id,input)),
  chooseResearchReward:(id,input)=>change(id,()=>research.choose(id,input)),
  saveLootFilter:(id,input)=>change(id,()=>lootFilter.save(id,input)),
  prepareEnchantment:(id,input)=>change(id,()=>alchemy.prepare(id,input)),
  applyEnchantment:(id,input)=>change(id,()=>{alchemy.apply(id,input);db.prepare('UPDATE hero_progress SET hp=min(hp,?) WHERE character_id=?').run(evaluate(id).stats.health,id);}),
  saveDailyWellness:(scope,metrics)=>transaction(()=>daily.save(scope,metrics)),
  previewRaritySale:(id,input)=>transaction(()=>{ensure(id);return inventorySale.previewRarity(id,input);}),
  sellRarity:(id,input)=>change(id,()=>inventorySale.sellRarity(id,input)),
  previewJunkSale:id=>transaction(()=>{ensure(id);return inventorySale.preview(id);}),
  sellJunk:(id,input)=>change(id,()=>inventorySale.sell(id,input)),
  startExpedition:(id,input)=>change(id,()=>expeditions.start(id,input)),
  chooseExpedition:(id,input)=>change(id,()=>expeditions.choose(id,input)),
  returnExpedition:(id,input)=>change(id,()=>expeditions.retreat(id,input)),
  state:id=>change(id,()=>{}),
  equip:(id,input)=>change(id,()=>equipOwned(id,input)), 
  unequip:(id,slot)=>change(id,()=>{outsideBattle(id);if(!Object.hasOwn(C.SLOTS,slot))throw new GameError('Slot non valido.');if(slot==='weapon')throw new GameError('Mantieni almeno un’arma equipaggiata.');db.prepare('DELETE FROM equipped_items WHERE character_id=? AND slot=?').run(id,slot);db.prepare('UPDATE hero_progress SET hp=min(hp,?) WHERE character_id=?').run(evaluate(id).stats.health,id);}),
  buy:(id,itemId)=>change(id,()=>purchase(id,itemId)), 
  buyAndEquip:(id,input)=>change(id,()=>{purchase(id,input?.itemId);equipOwned(id,input);}),
  sell:(id,itemId)=>change(id,()=>{outsideBattle(id);const item=ownItem(id,itemId);if(item.alchemyPending)throw new GameError('Completa prima la preparazione alchemica di questo oggetto.');if(db.prepare('SELECT 1 FROM equipped_items WHERE item_id=?').get(itemId))throw new GameError('Togli prima l’oggetto equipaggiato.');money(id,'sale',0,item.sellPrice,'sale:'+itemId);db.prepare('DELETE FROM item_instances WHERE id=?').run(itemId);}),
  refreshMerchant:id=>change(id,()=>{outsideBattle(id);money(id,'merchant_refresh',0,-(data.RULES.merchant_refresh_base+progress(id).level*data.RULES.merchant_refresh_per_level));db.prepare("DELETE FROM item_instances WHERE character_id=? AND location='merchant'").run(id);db.prepare('UPDATE merchant_state SET revision=revision+1 WHERE character_id=?').run(id);fillMerchant(id);}),
  exchange:(id,amount=data.RULES.exchange_steps)=>change(id,()=>{outsideBattle(id);const block=data.RULES.exchange_steps;
   if(!Number.isSafeInteger(amount)||amount<block||amount%block!==0)throw new GameError(`Scegli un numero di passi multiplo di ${block}.`);
   const coins=amount/block*data.RULES.exchange_coins;if(!Number.isSafeInteger(coins))throw new GameError('Importo non valido.');money(id,'exchange',-amount,coins);
  }),
  claimSteps:(id,scope,{from,to,allowEmpty=false}={})=>change(id,()=>{
   if(!scope)throw new GameError('Collega Garmin e sincronizza i passi prima del riscatto.');
   if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='daily_steps'").get())throw new GameError('Nessun passo salvato. Sincronizza Garmin.');
   if(from!==undefined||to!==undefined)dateRange(from,to);
   const rows=from===undefined?db.prepare('SELECT calendar_date,steps FROM daily_steps WHERE scope_id=? AND steps IS NOT NULL').all(scope):db.prepare('SELECT calendar_date,steps FROM daily_steps WHERE scope_id=? AND calendar_date BETWEEN ? AND ? AND steps IS NOT NULL').all(scope,from,to);let credited=0;
   for(const row of rows){const prior=db.prepare('SELECT credited_steps FROM hero_step_claims WHERE character_id=? AND scope_id=? AND calendar_date=?').get(id,scope,row.calendar_date)?.credited_steps||0;const delta=Math.max(0,row.steps-prior);if(!delta)continue;
    db.prepare('INSERT INTO hero_step_claims VALUES(?,?,?,?) ON CONFLICT(character_id,scope_id,calendar_date) DO UPDATE SET credited_steps=excluded.credited_steps').run(id,scope,row.calendar_date,row.steps);credited+=delta;
   }
   if(!credited){if(allowEmpty)return;throw new GameError('Non ci sono nuovi passi da riscattare. I passi già assegnati a questo eroe non si duplicano.');}money(id,'steps_claim',credited,0);
  }),
  rest:id=>change(id,()=>{outsideBattle(id);if(expeditions.active(id))throw new GameError('In spedizione usa il campo, cibo o pozioni. Rientra per recuperare completamente.');const plan=restPlan(progress(id).hp,evaluate(id).stats.health,getHero(id).coins);if(plan.cost)money(id,'rest',0,-plan.cost);db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(plan.targetHp,id);if(plan.healing)daily.relieve(id);}),
  useItem:(id,itemId)=>change(id,()=>{outsideBattle(id);useConsumable(id,ownItem(id,itemId),{},false);}),
  startBattle:(id,difficulty)=>change(id,()=>startEncounter(id,difficulty)),
  act:(id,input)=>change(id,()=>resolveTurn(id,input)),
  autoBattle:(id,input)=>change(id,()=>resolveAutomatically(id,input)),
  startAutoBattle:(id,input)=>change(id,()=>{
   if(typeof input?.requestId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.requestId))throw new GameError('Richiesta di combattimento non valida.');
   const prior=db.prepare('SELECT character_id FROM battles WHERE id=?').get(input.requestId);
   if(prior){if(prior.character_id!==id)throw new GameError('Scontro riservato a un altro personaggio.');return;}
   startEncounter(id,input.difficulty,input.requestId);resolveAutomatically(id,{battleId:input.requestId,round:0});
  }),
  catalog:()=>data,close:()=>db.close(),
 });
}
module.exports={createGameRepository,GameError,experienceNeeded,loadCatalog};
