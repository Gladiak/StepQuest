'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {generateItem,insertItem,integer,pick,weighted}=require('./game-items.cjs');
const {enemyStats}=require('./combat-balance.cjs');
const {combatTurn}=require('./combat-turn.cjs');
const {autoAction}=require('./combat-tactics.cjs');
const runicCombat=require('./runic-combat.cjs'),{loadout}=require('./runic-catalog.cjs');
const {equipmentPrice}=require('./item-economy.cjs');
const TICK=30*60*1000,MAX_TICKS=48;
const MATERIALS=[{id:'mist_iron',name:'Ferro delle brume',floor:1},{id:'moon_silver',name:'Argento lunare',floor:2},{id:'adamantite',name:'Adamantite',floor:4},{id:'dawn_gem',name:'Gemma dell’aurora',floor:2},{id:'void_opal',name:'Opale del vuoto',floor:5}];
const FLOORS=[{id:1,level:1,name:'Gallerie superficiali'},{id:2,level:3,name:'Vene lunari'},{id:3,level:5,name:'Fosse cristalline'},{id:4,level:8,name:'Abisso adamantino'},{id:5,level:10,name:'Cuore della montagna'}];
const WEIGHTS=[[1,[70,30,0,0,0]],[5,[45,40,15,0,0]],[10,[25,45,27,3,0]],[15,[10,35,46,8,1]],[20,[0,25,60,13,2]]];
const OPPONENTS=[{name:'Guardia del cortile',factor:.55,heavyEvery:3},{name:'Sentinella corazzata',factor:.65,heavyEvery:4},{name:'Veterano delle cariche',factor:.75,heavyEvery:2}];
const smithNeeded=level=>40+15*level;
const mineNeeded=level=>8+4*level;
const {experienceNeeded:xpNeeded,advanceExperience}=require('./hero-progression.cjs');
const {isUuid}=require('./validation.cjs');
function createSettlement({db,data,rng,now,today,getHero,progress,evaluate,money,atHome,runic,equipment,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS settlement_migrations(version INTEGER PRIMARY KEY) STRICT;');
 const version=db.prepare('SELECT max(version) version FROM settlement_migrations').get().version||0;
 if(version>2)throw new Error('Versione insediamento non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE settlement_profiles(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,mine_level INTEGER NOT NULL DEFAULT 1,mine_xp INTEGER NOT NULL DEFAULT 0,tools INTEGER NOT NULL DEFAULT 0,smith_level INTEGER NOT NULL DEFAULT 1,smith_xp INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE TABLE mining_materials(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,material_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(character_id,material_id)) STRICT;
 CREATE TABLE mining_runs(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('active','claimed')),started_at INTEGER NOT NULL,duration INTEGER NOT NULL,floor INTEGER NOT NULL,auto_repeat INTEGER NOT NULL,boosted INTEGER NOT NULL,plan TEXT NOT NULL CHECK(json_valid(plan)),receipt TEXT CHECK(receipt IS NULL OR json_valid(receipt))) STRICT;
 CREATE UNIQUE INDEX one_mining_run ON mining_runs(character_id) WHERE status='active';
 CREATE TABLE settlement_actions(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,result TEXT NOT NULL CHECK(json_valid(result))) STRICT;
 CREATE TABLE smith_reforges(item_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,version INTEGER NOT NULL) STRICT;
 CREATE TABLE arena_days(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,day TEXT NOT NULL,budget INTEGER NOT NULL,PRIMARY KEY(character_id,day)) STRICT;
 CREATE TABLE arena_contracts(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,day TEXT NOT NULL,slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 5),completed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(character_id,day,slot)) STRICT;
 CREATE TABLE arena_sessions(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('active','won','lost','fled','draw')),kind TEXT NOT NULL,day TEXT NOT NULL,slot INTEGER,round INTEGER NOT NULL DEFAULT 0,hp INTEGER NOT NULL,enemy_hp INTEGER NOT NULL,stats TEXT NOT NULL CHECK(json_valid(stats)),enemy TEXT NOT NULL CHECK(json_valid(enemy)),buffs TEXT NOT NULL CHECK(json_valid(buffs)),log TEXT NOT NULL CHECK(json_valid(log)),reward_xp INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE UNIQUE INDEX one_arena_session ON arena_sessions(character_id) WHERE status='active';
 INSERT INTO settlement_migrations VALUES(1);COMMIT;`);
 if(version<2)db.exec(`BEGIN IMMEDIATE;
 ALTER TABLE settlement_profiles ADD COLUMN mine_remainder INTEGER NOT NULL DEFAULT 0 CHECK(mine_remainder BETWEEN 0 AND 9999);
 ALTER TABLE mining_runs ADD COLUMN carries TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(carries));
 ALTER TABLE mining_runs ADD COLUMN next_config TEXT CHECK(next_config IS NULL OR json_valid(next_config));
 CREATE INDEX mining_owner ON mining_runs(character_id,status);
 CREATE INDEX arena_owner ON arena_sessions(character_id);
 CREATE INDEX settlement_actions_owner ON settlement_actions(character_id);
 INSERT INTO settlement_migrations VALUES(2);COMMIT;`);
 const profile=id=>db.prepare('SELECT * FROM settlement_profiles WHERE character_id=?').get(id);
 function ensure(id){if(!profile(id)){db.prepare('INSERT INTO settlement_profiles(character_id) VALUES(?)').run(id);addMaterial(id,'mist_iron',8);}}
 function addMaterial(id,material,amount){
  const current=db.prepare('SELECT quantity FROM mining_materials WHERE character_id=? AND material_id=?').get(id,material)?.quantity||0;
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(current+amount)||current+amount<0)throw new GameError('Materiali insufficienti.');
  db.prepare('INSERT INTO mining_materials VALUES(?,?,?) ON CONFLICT(character_id,material_id) DO UPDATE SET quantity=excluded.quantity').run(id,material,current+amount);
 }
 function replay(id,input,kind){
  if(!isUuid(input?.requestId))throw new GameError('Richiesta non valida.');
  const fingerprint=JSON.stringify({kind,input}),row=db.prepare('SELECT * FROM settlement_actions WHERE id=?').get(input.requestId);
  if(row&&(row.character_id!==id||row.fingerprint!==fingerprint))throw new GameError('Richiesta già utilizzata per un’altra operazione.');
  return {prior:row?JSON.parse(row.result):null,save:result=>db.prepare('INSERT INTO settlement_actions VALUES(?,?,?,?)').run(input.requestId,id,fingerprint,JSON.stringify(result))};
 }
 const arenaActive=id=>db.prepare("SELECT * FROM arena_sessions WHERE character_id=? AND status='active'").get(id);
 function gainProfession(id,kind,amount){
  const p=profile(id),max=kind==='mine'?10:20,needed=kind==='mine'?mineNeeded:smithNeeded;let level=p[kind+'_level'],xp=p[kind+'_xp']+amount;
  while(level<max&&xp>=needed(level)){xp-=needed(level);level++;}
  if(level===max)xp=0;
  db.prepare(`UPDATE settlement_profiles SET ${kind}_level=?,${kind}_xp=? WHERE character_id=?`).run(level,xp,id);
 }
 function ironRate(p){return 40000+(p.mine_level-1)*2200+p.tools*4000;}
 function miningPlan(id,floor,boosted,duration){
  const p=profile(id),rate=ironRate(p),carries=[];let carry=p.mine_remainder;
  const plan=Array.from({length:MAX_TICKS},(_,index)=>{const units=rate*(boosted&&index<duration/30?1.25:1)+carry,quantity=Math.floor(units/10000);carry=units%10000;carries.push(carry);const reward={mist_iron:quantity};if(floor>=2)reward.moon_silver=1+(floor>=3?1:0);if(floor>=4)reward.adamantite=floor-3;if(floor>=2&&rng()<.06+.025*(floor-2))reward.dawn_gem=1;if(floor===5&&rng()<.04)reward.void_opal=1;return reward;});
  return {plan,carries};
 }
 function insertRun(id,{runId=randomUUID(),startedAt=now(),duration,floor,autoRepeat,boosted=false}){
  const {plan,carries}=miningPlan(id,floor,boosted,duration);
  db.prepare("INSERT INTO mining_runs(id,character_id,status,started_at,duration,floor,auto_repeat,boosted,plan,receipt,carries) VALUES(?,?,'active',?,?,?,?,?,?,NULL,?)").run(runId,id,startedAt,duration,floor,Number(autoRepeat),Number(boosted),JSON.stringify(plan),JSON.stringify(carries));return runId;
 }
 function runView(row){if(!row)return null;const blocks=row.duration/30,cycles=Math.max(0,Math.min(row.auto_repeat?MAX_TICKS/blocks:1,Math.floor((now()-row.started_at)/(row.duration*60000))));return {id:row.id,floor:row.floor,duration:row.duration,startedAt:row.started_at,readyAt:row.started_at+row.duration*60000,autoRepeat:!!row.auto_repeat,boosted:!!row.boosted,next:row.next_config?JSON.parse(row.next_config):null,ready:cycles>0,cycles,capacityHours:24,storedMinutes:cycles*row.duration,receipt:row.receipt?JSON.parse(row.receipt):null};}
 function mineView(id){const p=profile(id),job=db.prepare("SELECT * FROM mining_runs WHERE character_id=? AND status='active'").get(id),last=db.prepare("SELECT receipt FROM mining_runs WHERE character_id=? AND status='claimed' ORDER BY rowid DESC LIMIT 1").get(id);return {level:p.mine_level,xp:p.mine_xp,xpNeeded:p.mine_level<10?mineNeeded(p.mine_level):null,tools:p.tools,toolCost:p.tools<5?100*(p.tools+1)**2:null,ironPerTick:ironRate(p)/10000,nextToolIronPerTick:p.tools<5?(ironRate(p)+4000)/10000:null,floors:FLOORS.map(f=>({...f,unlocked:p.mine_level>=f.level})),durations:[30,120,360,720],materials:MATERIALS.map(m=>({...m,quantity:db.prepare('SELECT quantity FROM mining_materials WHERE character_id=? AND material_id=?').get(id,m.id)?.quantity||0})),job:runView(job),lastReceipt:last?JSON.parse(last.receipt):null};}
 function validMiningConfig(id,input){return [30,120,360,720].includes(input.duration)&&Number.isInteger(input.floor)&&FLOORS.some(f=>f.id===input.floor&&profile(id).mine_level>=f.level)&&typeof input.autoRepeat==='boolean';}
 function startMine(id,input){const action=replay(id,input,'mine-start');if(action.prior)return;ensure(id);if(!validMiningConfig(id,input)||typeof input.boosted!=='boolean')throw new GameError('Spedizione mineraria non disponibile.');if(db.prepare("SELECT 1 FROM mining_runs WHERE character_id=? AND status='active'").get(id))throw new GameError('La squadra è già al lavoro.');if(input.boosted)money(id,'mine_preparation',-10*(input.duration/30),0,'mine:'+input.requestId);insertRun(id,{runId:input.requestId,duration:input.duration,floor:input.floor,autoRepeat:input.autoRepeat,boosted:input.boosted});action.save({started:true});}
 function queueMine(id,input){
  const action=replay(id,input,'mine-next');if(action.prior)return;
  const row=db.prepare("SELECT * FROM mining_runs WHERE id=? AND character_id=? AND status='active'").get(input.id,id);if(!row||!validMiningConfig(id,input))throw new GameError('Spedizione mineraria non disponibile.');
  const next={floor:input.floor,duration:input.duration,autoRepeat:input.autoRepeat};db.prepare('UPDATE mining_runs SET next_config=? WHERE id=?').run(JSON.stringify(next),row.id);action.save(next);
 }
 function collectMine(id,input){
  if(!isUuid(input?.id)||typeof input.repeat!=='boolean')throw new GameError('Carico minerario non valido.');
  const row=db.prepare('SELECT * FROM mining_runs WHERE id=? AND character_id=?').get(input.id,id);if(!row)throw new GameError('Carico minerario non disponibile.');if(row.status==='claimed')return;
  const view=runView(row);if(!view.ready)throw new GameError('La squadra è ancora al lavoro.');const next=row.next_config?JSON.parse(row.next_config):null;
  // When changing configuration, settle all completed half-hour blocks at the old
  // floor/rate; retain the remaining time as progress on the next trip.
  const ticks=next?Math.max(0,Math.min(row.auto_repeat?MAX_TICKS:row.duration/30,Math.floor((now()-row.started_at)/TICK))):view.storedMinutes/30,resources={};
  for(const tick of JSON.parse(row.plan).slice(0,ticks))for(const [key,value]of Object.entries(tick))resources[key]=(resources[key]||0)+value;
  for(const [key,value]of Object.entries(resources))addMaterial(id,key,value);gainProfession(id,'mine',ticks);
  const carries=JSON.parse(row.carries);if(carries.length)db.prepare('UPDATE settlement_profiles SET mine_remainder=? WHERE character_id=?').run(carries[ticks-1],id);
  const receipt={resources,minutes:ticks*30,cycles:view.cycles};db.prepare("UPDATE mining_runs SET status='claimed',receipt=? WHERE id=?").run(JSON.stringify(receipt),row.id);
  if(input.repeat){const cap=ticks===MAX_TICKS,startedAt=row.auto_repeat&&!cap?row.started_at+ticks*TICK:now();insertRun(id,{startedAt,duration:next?.duration||row.duration,floor:next?.floor||row.floor,autoRepeat:next?next.autoRepeat:!!row.auto_repeat});}
 }
 function upgradeMine(id,input){const action=replay(id,input,'mine-tools');if(action.prior)return;ensure(id);const p=profile(id);if(input.rank!==p.tools||p.tools>=5)throw new GameError('Attrezzatura già cambiata.');money(id,'mine_tools',0,-100*(p.tools+1)**2,'tools:'+input.requestId);db.prepare('UPDATE settlement_profiles SET tools=tools+1 WHERE character_id=?').run(id);action.save({rank:p.tools+1});}
 function probabilities(id,gem=false){const p=profile(id),level=progress(id).level,weights=WEIGHTS.filter(([min])=>min<=p.smith_level).at(-1)[1];let tiers=['common','uncommon','rare','mythic','legendary'].map((rarity,index)=>({id:rarity,weight:weights[index]})).filter(t=>t.weight>0&&(t.id!=='rare'||level>=4)&&(t.id!=='mythic'||level>=8)&&(t.id!=='legendary'||level>=15));if(gem)tiers=tiers.filter(t=>t.id!=='common');const total=tiers.reduce((sum,t)=>sum+t.weight,0);return tiers.map(t=>({...t,chance:t.weight/total}));}
 const craftCost=level=>2*(45+12*level);
 const templatesById=new Map(data.TEMPLATES.map(t=>[t.id,t])),raritiesById=new Map(data.RARITIES.map(r=>[r.id,r]));
 function reforgeQuote(id,row,level,version){
  const template=templatesById.get(row.template_id),rank=raritiesById.get(row.rarity_id).rank,targetLevel=Math.max(row.item_level,template.min_level,Math.min(100000,level));
  const growth=equipmentPrice(targetLevel,rank,!!template.set_id)-equipmentPrice(row.item_level,rank,!!template.set_id);
  const baseCost=Math.max(25,Math.ceil(row.price*.35)),upgradeCost=Math.ceil(growth*.35),cost=baseCost+upgradeCost,newPrice=row.price+growth;
  const token=createHash('sha256').update(JSON.stringify({hero:id,item:row.id,version,level,fromLevel:row.item_level,targetLevel,baseCost,upgradeCost,cost,newPrice,template:row.template_id,rarity:row.rarity_id,baseStats:row.base_stats,rolls:row.rolls,depth:row.generation_depth,multiplier:row.depth_multiplier})).digest('hex');
  return {fromLevel:row.item_level,targetLevel,baseCost,upgradeCost,cost,newPrice,token};
 }
 function smithView(id,metadata){const p=profile(id),hero=getHero(id),level=progress(id).level;return {level:p.smith_level,xp:p.smith_xp,xpNeeded:p.smith_level<20?smithNeeded(p.smith_level):null,probabilities:probabilities(id),gemProbabilities:probabilities(id,true),craftCost:craftCost(level),ironCost:4+Math.floor(level/5)*2,
  reforges:db.prepare("SELECT i.* FROM item_instances i JOIN item_templates t ON t.id=i.template_id WHERE i.character_id=? AND i.location='inventory' AND t.effect IS NULL ORDER BY i.rowid DESC").all(id).map(row=>{
   const version=metadata?(metadata.versions.get(row.id)||0):(db.prepare('SELECT version FROM smith_reforges WHERE item_id=?').get(row.id)?.version||0),template=templatesById.get(row.template_id),eligible=(!template.class_id||template.class_id===hero.class_id)&&Math.max(row.item_level,template.min_level)<=level;
   return {id:row.id,version,...reforgeQuote(id,row,level,version),eligible,reason:eligible?'':Math.max(row.item_level,template.min_level)>level?`Richiede il livello ${Math.max(row.item_level,template.min_level)}.`:'Oggetto riservato a un’altra classe.',pending:metadata?metadata.pending.has(row.id):!!db.prepare('SELECT 1 FROM alchemy_attempts WHERE item_id=? AND choice_index IS NULL').get(row.id)};
  })};}

 function varyCommon(item){if(item.rarity!=='common')return;const base=Object.keys(item.baseStats).length?item.baseStats:{health:Math.max(2,Math.round((2+item.level)*item.depthMultiplier))};item.baseStats=Object.fromEntries(Object.entries(base).map(([key,value])=>[key,integer(rng,Math.max(1,Math.floor(value*.85)),Math.max(Math.floor(value*.85)+1,Math.ceil(value*1.15)))]));}
 function quoteCraft(id,input){
  ensure(id);const hero=getHero(id),level=input?.level,recipe={level,slot:input?.slot,material:input?.material,gem:input?.gem};
  if(!Number.isSafeInteger(level)||level<1||level>Math.min(100000,progress(id).level)||!['weapon','body','feet','ring','amulet'].includes(recipe.slot)||!['mist_iron','moon_silver','adamantite'].includes(recipe.material)||typeof recipe.gem!=='boolean')throw new GameError('Ricetta non disponibile.');
  const tiers=probabilities(id,recipe.gem),canGem=probabilities(id).some(t=>t.id==='common');if(recipe.gem&&!canGem)throw new GameError('La gemma non migliora questa ricetta.');
  const pool=data.TEMPLATES.filter(t=>!t.starter&&!t.set_id&&!t.effect&&t.slot===recipe.slot&&t.min_level<=level&&(!t.class_id||t.class_id===hero.class_id));if(!pool.length)throw new GameError('Ricetta non disponibile.');
  const iron=4+Math.floor(level/5)*2,amount=recipe.material==='mist_iron'?iron:recipe.material==='moon_silver'?Math.ceil(iron/2):Math.ceil(iron/4),cost=craftCost(level),xp=profile(id).smith_level>=20?0:Math.max(0,10-2*Math.max(0,profile(id).smith_level-level));
  const materials=[{id:recipe.material,amount},...(recipe.gem?[{id:'dawn_gem',amount:1}]:[])].map(m=>({...m,name:MATERIALS.find(r=>r.id===m.id).name,available:db.prepare('SELECT quantity FROM mining_materials WHERE character_id=? AND material_id=?').get(id,m.id)?.quantity||0}));
  const token=createHash('sha256').update(JSON.stringify({hero:id,heroLevel:progress(id).level,smithLevel:profile(id).smith_level,recipe,cost,xp,materials,coins:hero.coins,tiers})).digest('hex');
  return {token,recipe,cost,xp,materials,probabilities:tiers,affordable:hero.coins>=cost&&materials.every(m=>m.available>=m.amount)};
 }
 function craft(id,input){
  const action=replay(id,input,'smith-craft');if(action.prior)return;atHome(id);const quote=quoteCraft(id,input);
  if(input.token!==quote.token)throw new GameError('Il preventivo è cambiato. Riapri la creazione.','STALE_CRAFT');
  const hero=getHero(id),{level,slot,gem}=quote.recipe,pool=data.TEMPLATES.filter(t=>!t.starter&&!t.set_id&&!t.effect&&t.slot===slot&&t.min_level<=level&&(!t.class_id||t.class_id===hero.class_id));
  money(id,'smith_craft',0,-quote.cost,'smith:'+input.requestId);for(const m of quote.materials)addMaterial(id,m.id,-m.amount);
  const item=generateItem(pick(rng,pool),{level,depth:level,rarity:weighted(rng,quote.probabilities).id,rng,source:'smith',catalog:data});varyCommon(item);insertItem(db,id,item);gainProfession(id,'smith',quote.xp);action.save({itemId:item.id});
 }
 function reforge(id,input){
  const action=replay(id,input,'smith-reforge');if(action.prior)return;atHome(id);
  if(typeof input.itemId!=='string'||!Number.isSafeInteger(input.version)||input.version<0)throw new GameError('Richiesta di riforgiatura non valida.');
  const row=db.prepare("SELECT * FROM item_instances WHERE id=? AND character_id=? AND location='inventory'").get(input.itemId,id),version=row?db.prepare('SELECT version FROM smith_reforges WHERE item_id=?').get(row.id)?.version||0:0;
  if(!row||input.version!==version)throw new GameError('Oggetto già cambiato. Riapri la riforgiatura.');
  const template=templatesById.get(row.template_id);if(template.effect||template.class_id&&template.class_id!==getHero(id).class_id||Math.max(row.item_level,template.min_level)>progress(id).level)throw new GameError('Oggetto non utilizzabile.');
  if(db.prepare('SELECT 1 FROM alchemy_attempts WHERE item_id=? AND choice_index IS NULL').get(row.id))throw new GameError('Completa prima la preparazione alchemica di questo oggetto.');
  const quote=reforgeQuote(id,row,progress(id).level,version);
  if(input.token!==quote.token)throw new GameError('Il preventivo di riforgiatura è cambiato. Seleziona di nuovo il pezzo.','STALE_REFORGE');
  money(id,'smith_reforge',0,-quote.cost,'smith:'+input.requestId);
  // Starter restrictions belong to creation. Once reforged, even an initial
  // weapon can grow; its identity, rarity and template remain unchanged.
  const item=generateItem({...template,starter:false},{level:quote.targetLevel,depth:row.generation_depth,depthMultiplier:row.depth_multiplier,rarity:row.rarity_id,propertyCount:JSON.parse(row.rolls).length,rng,source:'smith',catalog:data});varyCommon(item);
  db.prepare('UPDATE item_instances SET name=?,item_level=?,price=?,base_stats=?,rolls=?,prefix_id=?,suffix_id=? WHERE id=?').run(item.name,item.level,quote.newPrice,JSON.stringify(item.baseStats),JSON.stringify(item.rolls),item.prefix_id,item.suffix_id,row.id);
  db.prepare('INSERT INTO smith_reforges VALUES(?,?) ON CONFLICT(item_id) DO UPDATE SET version=excluded.version').run(row.id,version+1);
  db.prepare('UPDATE hero_progress SET hp=min(hp,?) WHERE character_id=?').run(evaluate(id).stats.health,id);action.save({itemId:row.id,version:version+1,cost:quote.cost,baseCost:quote.baseCost,upgradeCost:quote.upgradeCost,before:{name:row.name,level:row.item_level,price:row.price,baseStats:JSON.parse(row.base_stats),rolls:JSON.parse(row.rolls)},after:{name:item.name,level:item.level,price:quote.newPrice,baseStats:item.baseStats,rolls:item.rolls}});
 }
 function dayBudget(id){const day=today();db.prepare('INSERT OR IGNORE INTO arena_days VALUES(?,?,?)').run(id,day,xpNeeded(progress(id).level));return db.prepare('SELECT * FROM arena_days WHERE character_id=? AND day=?').get(id,day);}
 function arenaSession(row){return row?{id:row.id,status:row.status,kind:row.kind,day:row.day,slot:row.slot,round:row.round,hp:row.hp,enemyHp:row.enemy_hp,stats:JSON.parse(row.stats),enemy:JSON.parse(row.enemy),log:JSON.parse(row.log),rewardXp:row.reward_xp,autoProfile:JSON.parse(row.buffs).autoProfile||'aggressive',autoDecisions:JSON.parse(row.buffs).autoDecisions||null,runicSummary:runicCombat.summaries(JSON.parse(row.buffs),row.status)}:null;}
 function arenaView(id){const day=today(),budget=db.prepare('SELECT * FROM arena_days WHERE character_id=? AND day=?').get(id,day)?.budget||xpNeeded(progress(id).level),contracts=db.prepare('SELECT * FROM arena_contracts WHERE character_id=? AND day=?').all(id,day),row=db.prepare('SELECT * FROM arena_sessions WHERE character_id=? ORDER BY rowid DESC LIMIT 1').get(id);return {budget,day,extraGold:5+progress(id).level,extraSteps:15,session:arenaSession(row),challenges:Array.from({length:6},(_,slot)=>({slot,name:OPPONENTS[slot%3].name,paid:slot>=3,unlocked:contracts.some(c=>c.slot===slot),completed:contracts.some(c=>c.slot===slot&&c.completed),xp:Math.floor(budget*(slot<3?.1:.05))}))};}
 function startArena(id,input){
  const action=replay(id,input,'arena-start');if(action.prior)return;atHome(id);
  if(!['practice','challenge'].includes(input.kind)||!Number.isInteger(input.slot)||input.slot<0||input.slot>5||!['gold','steps'].includes(input.currency))throw new GameError('Prova non disponibile.');
  const budget=dayBudget(id),slot=input.kind==='practice'?null:input.slot;
  if(slot!==null){const contract=db.prepare('SELECT * FROM arena_contracts WHERE character_id=? AND day=? AND slot=?').get(id,budget.day,slot);if(contract?.completed)throw new GameError('Premio già ottenuto.');if(!contract){if(slot>=3)money(id,'arena_entry',input.currency==='steps'?-15:0,input.currency==='gold'?-(5+progress(id).level):0,'arena:'+input.requestId);db.prepare('INSERT INTO arena_contracts(character_id,day,slot) VALUES(?,?,?)').run(id,budget.day,slot);}}
  const model=OPPONENTS[input.slot%3],level=progress(id).level,stats=evaluate(id).stats,enemy={id:['slime','wolf','raider'][input.slot%3],name:model.name,avatarClass:input.slot%3===2?'berserker':'guardian',avatarSex:input.slot%3===1?'female':'male',...enemyStats(level,model.factor,level),heavyEvery:model.heavyEvery,heavyMultiplier:1.5};
  db.prepare("INSERT INTO arena_sessions VALUES(?,?,'active',?,?,?,0,?,?,?,?,?,?,0)").run(input.requestId,id,input.kind,budget.day,slot,stats.health,enemy.health,JSON.stringify(stats),JSON.stringify(enemy),JSON.stringify({autoProfile:runic.settings(id).profile,runic:runicCombat.snapshot(loadout(equipment(id)))}),JSON.stringify(['La prova usa vita separata e non consuma oggetti.']));action.save({sessionId:input.requestId});
 }
 function arenaReward(id,row){if(row.slot===null)return 0;const contract=db.prepare('SELECT * FROM arena_contracts WHERE character_id=? AND day=? AND slot=?').get(id,row.day,row.slot);if(!contract||contract.completed)return 0;const budget=db.prepare('SELECT budget FROM arena_days WHERE character_id=? AND day=?').get(id,row.day).budget,xp=Math.floor(budget*(row.slot<3?.1:.05));const {level,xp:remaining}=advanceExperience(progress(id),xp);db.prepare('UPDATE hero_progress SET level=?,xp=? WHERE character_id=?').run(level,remaining,id);db.prepare('UPDATE arena_contracts SET completed=1 WHERE character_id=? AND day=? AND slot=?').run(id,row.day,row.slot);return xp;}
 function arenaTurn(id,input){
  const row=arenaActive(id);if(!row||row.id!==input?.id||row.round!==input.round)throw new GameError('Il turno è già cambiato. Aggiorna la prova.');if(!['attack','defend','flee','auto'].includes(input.action))throw new GameError('Azione non valida.');
  const stats=JSON.parse(row.stats),enemy=JSON.parse(row.enemy),buffs=JSON.parse(row.buffs),log=JSON.parse(row.log);let hp=row.hp,enemyHp=row.enemy_hp,status='active',round=row.round;
  if(input.action==='flee'){status='fled';log.push('Prova interrotta. Nessuna risorsa persa.');round++;}
  else for(let n=0;n<(input.action==='auto'?250:1)&&status==='active';n++){({hp,enemyHp,status}=combatTurn({stats,hp,enemy,enemyHp,round,buffs,action:input.action==='auto'?autoAction({enemy,round,buffs,hp,stats,log}):input.action,rng,log,defeatMessage:'Prova terminata. La vita del tuo eroe resta invariata.'}));round++;if(round>=250&&status==='active'){status='draw';log.push('Limite di turni raggiunto. Puoi riprovare la prova.');}}
  const reward=status==='won'?arenaReward(id,row):0;if(status==='won')log.push(reward?`Prova completata: +${reward} XP.`:'Allenamento completato. Nessuna ricompensa.');
  db.prepare('UPDATE arena_sessions SET status=?,round=?,hp=?,enemy_hp=?,buffs=?,log=?,reward_xp=? WHERE id=?').run(status,round,hp,Math.max(0,enemyHp),JSON.stringify(buffs),JSON.stringify(log.slice(-18)),reward,row.id);
 }
 function view(id,metadata){ensure(id);return {mine:mineView(id),smith:smithView(id,metadata),arena:arenaView(id)};}
 return {view,arenaActive,startMine,collectMine,queueMine,upgradeMine,quoteCraft,craft,reforge,startArena,arenaTurn};
}
module.exports={createSettlement,MATERIALS,FLOORS};
