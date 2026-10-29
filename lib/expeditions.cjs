'use strict';
const {randomUUID}=require('node:crypto');
const {ROUTES,makePlan}=require('./expedition-catalog.cjs');
const {generateItem,insertItem,pick}=require('./game-items.cjs');
module.exports=function createExpeditions({db,data,rng,money,getHero,progress,evaluate,outsideBattle,startEncounter,resolveAutomatically,research,filterRewards,GameError}){
 const active=id=>db.prepare("SELECT * FROM expeditions WHERE character_id=? AND status='active'").get(id);
 const routeFor=e=>{const route=ROUTES.find(r=>r.id===e.route);if(!route.research)return route;const event=db.prepare("SELECT steps_delta FROM wallet_events WHERE character_id=? AND reference=? AND kind='expedition_entry'").get(e.character_id,'expedition-entry:'+e.id);return {...route,cost:event?-event.steps_delta:route.cost};};
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
 function check(id,input){const e=active(id);if(!e||e.id!==input?.id||e.version!==input.version)throw new GameError('La spedizione è già cambiata. Consulta la tappa attuale.','STALE_EXPEDITION');return e;}
 function lootSales(e){
  const rewards=db.prepare("SELECT rewards FROM battles WHERE character_id=? AND status='won' AND json_extract(enemy,'$.expeditionId')=? ORDER BY rowid").all(e.character_id,e.id).map(row=>JSON.parse(row.rewards));
  if(e.rewards)rewards.push(JSON.parse(e.rewards));
  return {autoSold:rewards.flatMap(r=>r?.autoSold||[]),autoSaleCoins:rewards.reduce((sum,r)=>sum+(r?.autoSaleCoins||0),0)};
 }
 function view(id){const e=db.prepare('SELECT * FROM expeditions WHERE character_id=? ORDER BY rowid DESC LIMIT 1').get(id);if(!e)return null;const plan=JSON.parse(e.plan),node=plan[e.step];return {id:e.id,status:e.status,route:routeFor(e),step:e.step,total:plan.length,version:e.version,stash:e.stash,boosts:JSON.parse(e.boosts),log:JSON.parse(e.log),battleId:e.battle_id,rewards:e.rewards?JSON.parse(e.rewards):null,lootSales:lootSales(e),researchTarget:research.target(e.id),node:e.status==='active'&&node?{title:node.title,text:node.text,options:node.options.map(({id,title,kind,description})=>({id,title,kind,description}))}:null};}
 function finish(e,status){
  const route=routeFor(e),complete=status==='completed',isResearch=!!route.research,coins=Math.floor(e.stash*(status==='lost'?.5:1))+(complete?Math.round((12+e.start_stage*3)*route.bounty):0),generated=[];
  if(coins)money(e.character_id,'expedition_reward',0,coins,'expedition:'+e.id);
  if(complete&&!isResearch){const p=progress(e.character_id),hero=getHero(e.character_id),pool=data.TEMPLATES.filter(t=>!t.starter&&!t.effect&&!t.set_id&&(!t.class_id||t.class_id===hero.class_id)&&t.min_level<=p.level&&['weapon','body','feet','ring','amulet'].includes(t.slot));const chance=rng();const rarity=p.level>=15&&chance<.01?'legendary':p.level>=8&&chance<.06?'mythic':p.level>=4&&chance<.28?'rare':'uncommon';const item=generateItem(pick(rng,pool),{rarity,level:p.level,depth:e.start_stage,rng,catalog:data,source:'expedition'});insertItem(db,e.character_id,item);generated.push(item);}
  if(complete&&isResearch)research.prepare(e);
  const loot=complete&&!isResearch?filterRewards(e.character_id,e.id,generated):{drops:[],autoSold:[],autoSaleCoins:0,...(complete&&isResearch?{researchPending:true}:{})};
  const log=JSON.parse(e.log);log.push(complete?(isResearch?'Ricerca completata. Scegli uno dei due premi.':loot.autoSold.length?'Spedizione completata. Il filtro bottino ha venduto il premio finale.':'Spedizione completata. Il premio finale è tuo.'):status==='lost'?'Spedizione interrotta: conservi metà della sacca e tutti gli oggetti già ottenuti.':'Rientri con tutta la sacca. Rinunci al premio finale.');
  if(loot.autoSold.length)log.push(`Filtro bottino: venduti ${loot.autoSold.length} oggetti · +${loot.autoSaleCoins} monete.`);
  db.prepare('UPDATE expeditions SET status=?,version=version+1,battle_id=NULL,rewards=?,log=?,finished_at=? WHERE id=?').run(status,JSON.stringify({coins,...loot}),JSON.stringify(log),new Date().toISOString(),e.id);
  const health=evaluate(e.character_id).stats.health;
  if(complete)db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(health,e.character_id);
  else db.prepare('UPDATE hero_progress SET hp=min(hp,?) WHERE character_id=?').run(health,e.character_id);
 }
 function start(id,input){
  if(!uuid(input?.requestId))throw new GameError('Richiesta di spedizione non valida.');
  const prior=db.prepare('SELECT character_id,route FROM expeditions WHERE id=?').get(input.requestId);if(prior){if(prior.character_id!==id)throw new GameError('Spedizione di un altro eroe.');if(prior.route!==input.route||prior.route==='research'&&!research.matches(input.requestId,input.target))throw new GameError('Richiesta di spedizione non valida.');return;}
  outsideBattle(id);if(research.pending(id))throw new GameError('Scegli prima il premio della ricerca completata.');if(active(id))throw new GameError('Completa la spedizione o rientra prima di partire di nuovo.');
  const route=ROUTES.find(r=>r.id===input.route);if(!route)throw new GameError('Itinerario non valido.');const p=progress(id);
  if(p.hp<Math.max(15,evaluate(id).stats.health*.2))throw new GameError('Recupera le forze prima di partire.');
  const target=route.research?research.targetFor(id,input.target):null,cost=target?research.costFor(p.level,target.type):route.cost;
  money(id,'expedition_entry',-cost,0,'expedition-entry:'+input.requestId);
  db.prepare("INSERT INTO expeditions(id,character_id,status,route,start_stage,plan,boosts,log,created_at) VALUES(?,?,'active',?,?,?,?,?,?)").run(input.requestId,id,route.id,p.stage,JSON.stringify(makePlan(route,p.stage,rng)),'{}',JSON.stringify([`Parti verso ${route.name}. Spesi ${cost} passi per tutte le quattro tappe.`]),new Date().toISOString());
  if(target)research.start(id,input.requestId,target);
 }
 function choose(id,input){
  outsideBattle(id);let e=check(id,input);const node=JSON.parse(e.plan)[e.step],option=node?.options.find(o=>o.id===input.option);if(!option)throw new GameError('Scelta non disponibile.');
  if(['battle','boss'].includes(option.kind)){
   const battleId=randomUUID(),boss=option.kind==='boss';startEncounter(id,boss?'elite':'normal',battleId,{expeditionId:e.id,stage:Math.max(1,e.start_stage+(boss?1:0)),factor:routeFor(e).factor,boss});
   db.prepare('UPDATE expeditions SET battle_id=?,version=version+1 WHERE id=?').run(battleId,e.id);
   if(input.automatic===true)resolveAutomatically(id,{battleId,round:0});return;
  }
  const stats=evaluate(id).stats,boosts=JSON.parse(e.boosts),log=JSON.parse(e.log);let hp=progress(id).hp,gold=option.gold||0;log.push(option.title+'.');
  if(option.kind==='risk'){if(rng()>=option.chance){gold=0;hp-=Math.max(1,Math.round(stats.health*option.damage));log.push('Una trappola! Perdi parte della vita.');}else log.push(`Scoperta riuscita: ${gold} monete nella sacca.`);}
  else if(option.damage)hp-=Math.max(1,Math.round(stats.health*option.damage));
  if(option.heal){const previous=hp;hp=Math.min(stats.health,hp+Math.round(stats.health*option.heal));log.push(`Recuperi ${hp-previous} punti vita.`);}
  if(option.attack)boosts.attack=(boosts.attack||0)+option.attack;if(option.defense)boosts.defense=(boosts.defense||0)+option.defense;
  db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(Math.max(1,hp),id);
  db.prepare('UPDATE expeditions SET step=step+1,version=version+1,stash=stash+?,boosts=?,log=? WHERE id=?').run(gold,JSON.stringify(boosts),JSON.stringify(log.slice(-14)),e.id);
  e=active(id);if(hp<=0)finish(e,'lost');else if(e.step>=4)finish(e,'completed');
 }
 function onBattleFinished(id,battle,status){let e=active(id);if(!e||e.battle_id!==battle.id||status==='active')return;if(status!=='won'){finish(e,status==='lost'?'lost':'returned');return;}
  const option=JSON.parse(e.plan)[e.step].options.find(o=>['battle','boss'].includes(o.kind)),log=JSON.parse(e.log);log.push(`${option.title}: vittoria. +${option.gold} monete nella sacca.`);
  db.prepare('UPDATE expeditions SET step=step+1,version=version+1,stash=stash+?,battle_id=NULL,log=? WHERE id=?').run(option.gold,JSON.stringify(log.slice(-14)),e.id);e=active(id);if(e.step>=4)finish(e,'completed');
 }
 function retreat(id,input){outsideBattle(id);const done=db.prepare('SELECT character_id,status FROM expeditions WHERE id=?').get(input?.id);if(done?.character_id===id&&done.status!=='active')return;finish(check(id,input),'returned');}
 return {active,view,start,choose,retreat,onBattleFinished};
};
