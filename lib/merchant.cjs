'use strict';
const {createHash}=require('node:crypto');
const C=require('./game-catalog.cjs');
const {generateItem,insertItem,pick,weighted,integer,effectFor}=require('./game-items.cjs');
const {isUuid}=require('./validation.cjs');
const {tierFor,nextTier,PURPOSES,MAX_RATIONS,MAX_PER_VICTORY}=require('./merchant-catalog.cjs');
const {rationHealing,feedRations}=require('./provision-rules.cjs');
function createMerchant({db,data,rng,progress,getHero,evaluate,requireHome,outsideBattle,money,daily,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS merchant_migrations(version INTEGER PRIMARY KEY) STRICT');const version=db.prepare('SELECT max(version) v FROM merchant_migrations').get().v||0;if(version>1)throw new Error('Versione del mercante non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE merchant_offer_meta(item_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,featured INTEGER NOT NULL CHECK(featured IN (0,1)),purpose TEXT,tier TEXT NOT NULL) STRICT;
 CREATE TABLE provision_profiles(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),threshold INTEGER NOT NULL DEFAULT 70 CHECK(threshold IN (50,70,90))) STRICT;
 CREATE TABLE provision_batches(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,level INTEGER NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),quantity INTEGER NOT NULL CHECK(quantity>=0),unit_cost INTEGER NOT NULL CHECK(unit_cost>0)) STRICT;
 CREATE INDEX provision_owner ON provision_batches(character_id);
 CREATE TABLE merchant_actions(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL) STRICT;
 INSERT INTO merchant_migrations VALUES(1);COMMIT;`);
 const stock=id=>db.prepare('SELECT * FROM provision_batches WHERE character_id=? AND quantity>0 ORDER BY rowid').all(id);
 const quantity=id=>db.prepare('SELECT coalesce(sum(quantity),0) n FROM provision_batches WHERE character_id=?').get(id).n;
 const settings=id=>{const row=db.prepare('SELECT * FROM provision_profiles WHERE character_id=?').get(id);return {enabled:!!row?.enabled,threshold:row?.threshold||70,maxPerVictory:MAX_PER_VICTORY};};
 function replay(id,input,kind){if(!isUuid(input?.requestId))throw new GameError('Richiesta del mercante non valida.');const fingerprint=createHash('sha256').update(JSON.stringify([kind,input])).digest('hex'),prior=db.prepare('SELECT * FROM merchant_actions WHERE id=?').get(input.requestId);if(prior){if(prior.character_id!==id||prior.fingerprint!==fingerprint)throw new GameError('Richiesta del mercante non valida.');return true;}db.prepare('INSERT INTO merchant_actions VALUES(?,?,?)').run(input.requestId,id,fingerprint);return false;}
 function configure(id,input){requireHome(id);if(typeof input?.enabled!=='boolean'||![50,70,90].includes(input.threshold))throw new GameError('Piano delle provviste non valido.');db.prepare('INSERT INTO provision_profiles VALUES(?,?,?) ON CONFLICT(character_id) DO UPDATE SET enabled=excluded.enabled,threshold=excluded.threshold').run(id,Number(input.enabled),input.threshold);}
 function foodFor(level){return data.TEMPLATES.filter(t=>t.effect?.kind==='food'&&t.min_level<=level).sort((a,b)=>effectFor(b,level).amount-effectFor(a,level).amount)[0];}
 function quote(id,input){
  requireHome(id);if(!Number.isInteger(input?.quantity)||input.quantity<1||input.quantity>10)throw new GameError('Scegli da 1 a 10 razioni.');const p=progress(id),food=foodFor(p.level),amount=effectFor(food,p.level).amount,unitCost=generateItem(food,{level:p.level,rng:()=>.5,source:'merchant-provisions',catalog:data}).price,held=quantity(id),stats=evaluate(id).stats,effects=daily.read(id).effects;
  const healing=Math.min(stats.health,rationHealing(amount,stats,effects)),cost=unitCost*input.quantity,token=createHash('sha256').update(JSON.stringify([id,p.level,held,amount,unitCost,input.quantity,stats.health,stats.potion_power,effects])).digest('hex');
  return {quantity:input.quantity,held,capacity:MAX_RATIONS,level:p.level,amount,healing,healingPercent:Math.round(Math.min(100,healing/stats.health*100)*10)/10,unitCost,cost,affordable:held+input.quantity<=MAX_RATIONS&&getHero(id).coins>=cost,token};
 }
 function buy(id,input){requireHome(id);if(replay(id,input,'provisions-buy'))return;const q=quote(id,input);if(q.token!==input.token)throw new GameError('Il preventivo delle provviste è cambiato. Riapri la sacca.','STALE_PROVISIONS');if(!q.affordable)throw new GameError('Monete insufficienti o sacca piena.');if(typeof input.enabled!=='boolean'||![50,70,90].includes(input.threshold))throw new GameError('Piano delle provviste non valido.');money(id,'provisions_buy',0,-q.cost,'provisions:'+input.requestId);db.prepare('INSERT INTO provision_batches VALUES(?,?,?,?,?,?)').run(input.requestId,id,q.level,q.amount,q.quantity,q.unitCost);configure(id,input);}
 function consume(id,{limit,target}){
  const p=progress(id),stats=evaluate(id).stats,batches=stock(id),before=new Map(batches.map(b=>[b.id,b.quantity])),{hp,used,healing}=feedRations({hp:p.hp,stats,batches,target,limit,effects:daily.read(id).effects});for(const batch of batches)if(batch.quantity!==before.get(batch.id))db.prepare('UPDATE provision_batches SET quantity=? WHERE id=? AND character_id=?').run(batch.quantity,batch.id,id);
  if(used){db.prepare('UPDATE hero_progress SET hp=? WHERE character_id=?').run(hp,id);daily.relieve(id);}
  return {used,healing,remaining:quantity(id)};
 }
 function afterVictory(id,plan){if(!plan?.enabled)return null;const target=Math.ceil(evaluate(id).stats.health*plan.threshold/100);return consume(id,{limit:MAX_PER_VICTORY,target});}
 function use(id,input){outsideBattle(id);if(replay(id,input,'provisions-use'))return;if(!quantity(id))throw new GameError('La sacca delle provviste è vuota.');const stats=evaluate(id).stats;if(progress(id).hp>=stats.health)throw new GameError('La tua vita è già al massimo.');consume(id,{limit:1,target:stats.health});}
 function fill(id){
  const hero=getHero(id),p=progress(id),tier=tierFor(p.level),revision=db.prepare('SELECT revision FROM merchant_state WHERE character_id=?').get(id).revision,featured=revision%tier.every===0,featuredCategory=['weapons','armor','accessories'][Math.floor(revision/tier.every)%3];
  for(const category of C.MERCHANT_CATEGORIES)for(let n=0;n<category.stock;n++){
   const isGear=!['food','potions'].includes(category.id),special=isGear&&featured&&category.id===featuredCategory&&n===0,purpose=category.id==='accessories'?(n===0?'fortune':'hunt'):null;
   let template,tierId='common',count=null;
   if(isGear){
    tierId=special?tier.featured:weighted(rng,Object.entries(tier.weights).map(([id,weight])=>({id,weight}))).id;
    let candidates=data.TEMPLATES.filter(t=>!t.starter&&!t.effect&&t.category===category.id&&(!t.class_id||t.class_id===hero.class_id)&&t.min_level<=p.level&&!data.SETS.find(s=>s.id===t.set_id)?.unique);
    if(category.id==='armor')candidates=candidates.filter(t=>t.slot===(n===2?'feet':'body'));
    const ordinary=candidates.filter(t=>!t.set_id),sets=candidates.filter(t=>t.set_id),rarity=data.RARITIES.find(r=>r.id===tierId);template=pick(rng,rarity.rank>=2&&sets.length&&rng()<.1?sets:ordinary);count=special?rarity.max:integer(rng,Math.min(rarity.max,Math.max(rarity.min,tier.affixes)),rarity.max);
   }else if(category.id==='food')template=foodFor(p.level);
   else{const kind=['heal','guard','antidote'][n],pool=data.TEMPLATES.filter(t=>t.effect?.kind===kind&&t.min_level<=p.level).sort((a,b)=>b.min_level-a.min_level);template=pool[0];}
   const item=generateItem(template,{level:p.level,depth:p.stage,rarity:tierId,rng,source:'merchant',catalog:data,propertyCount:count,positiveOnly:special,preferredAttributes:purpose?PURPOSES[purpose].attributes:isGear?[category.id==='weapons'?(p.level<15?'attack_flat':'attack_percent'):p.level<15?'health_flat':'health_percent']:[]});if(isGear)item.price=Math.ceil(item.price*(special?(p.level<15?1.05:1.15):p.level<15?1.1:1.35));insertItem(db,id,item,'merchant');db.prepare('INSERT INTO merchant_offers VALUES(?,?,?)').run(item.id,id,item.price);db.prepare('INSERT INTO merchant_offer_meta VALUES(?,?,?,?)').run(item.id,Number(special),purpose,tier.id);
  }
 }
 const simulation=id=>({...settings(id),batches:stock(id).map(({amount,quantity,unit_cost})=>({amount,quantity,unitCost:unit_cost}))});
 function view(id,offers,knownStats){const p=progress(id),tier=tierFor(p.level),next=nextTier(p.level),revision=db.prepare('SELECT revision FROM merchant_state WHERE character_id=?').get(id).revision,meta=new Map(db.prepare('SELECT m.* FROM merchant_offer_meta m JOIN merchant_offers o ON o.item_id=m.item_id WHERE o.character_id=?').all(id).map(m=>[m.item_id,m])),batches=stock(id),stats=knownStats||evaluate(id).stats;
  return {tier,nextTier:next?{level:next.level,name:next.name}:null,featuredIn:tier.every-revision%tier.every,legacy:offers.some(o=>!meta.has(o.id)),stockLevel:offers.length?Math.min(...offers.map(o=>o.level)):null,offers:offers.map(o=>({...o,trade:meta.has(o.id)?{featured:!!meta.get(o.id).featured,purpose:PURPOSES[meta.get(o.id).purpose]?.name||null}:null})),provisions:{...settings(id),quantity:quantity(id),capacity:MAX_RATIONS,batches:batches.map(b=>({level:b.level,quantity:b.quantity,healing:Math.min(stats.health,Math.round(b.amount*(1+stats.potion_power/100)*(1+(daily.read(id).effects.healingPercent||0)/100)))}))}};
 }
 return {fill,view,settings,configure,quote,buy,use,afterVictory,simulation};
}
module.exports={createMerchant};
