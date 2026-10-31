'use strict';
function snapshot(words=[]){return {words:structuredClone(words),attacks:0,hurtTurns:0,previousDefense:false,shield:0,ready:{},summary:Object.fromEntries(words.map(w=>[w.id,{id:w.id,name:w.name,activations:0,damage:0,absorbed:0,healing:0,cleanses:0}]))};}
function begin({buffs,action,round,stats,hp,enemy,enemyHp,intent}){
 const state=buffs.runic;if(!state)return null;
 const ctx={state,action,round,stats,hp,enemy,enemyHp,intent,hit:false,critical:false,damage:0,received:0,blocked:false,active:[],bonus:0,pierce:0,ward:0};
 for(const word of state.words){
  if(round<(state.ready[word.id]||0))continue;
  const triggered=action==='attack'&&(word.trigger==='third'&&state.attacks%3===2||word.trigger==='first'&&state.attacks===0||word.trigger==='counter'&&state.previousDefense||word.trigger==='exposed'&&intent.vulnerable||word.trigger==='execute'&&enemyHp<enemy.health*.35||word.trigger==='wounded'&&hp<stats.health*.5);
  if(triggered&&['damage','pierce'].includes(word.effect)){ctx.active.push(word);ctx[word.effect==='damage'?'bonus':'pierce']+=word.value;}
  if(word.trigger==='heavy'&&intent.heavy&&word.effect==='ward'){ctx.ward=Math.max(ctx.ward,word.value);ctx.wardWord=word;}
  if(action==='defend'&&word.trigger==='defend'){
   if(word.effect==='shield'){state.shield=Math.max(state.shield,Math.round(stats.health*word.value));state.shieldWord=word.id;activate(ctx,word);}
   if(word.effect==='cleanse'&&(buffs.poison>0||buffs.woundTurns>0)){buffs.poison=0;buffs.woundTurns=0;state.summary[word.id].cleanses++;activate(ctx,word);state.ready[word.id]=round+3;}
  }
 }
 return ctx;
}
function activate(ctx,word){ctx.state.summary[word.id].activations++;}
function heal(ctx,word,hp,buffs){const value=Math.min(ctx.stats.health-hp,Math.round(ctx.stats.health*word.value*(buffs.woundTurns>0?.7:1)));if(value>0){activate(ctx,word);ctx.state.summary[word.id].healing+=value;return hp+value;}ctx.state.summary[word.id].unneededHealing=(ctx.state.summary[word.id].unneededHealing||0)+1;return hp;}
function absorb(ctx,damage){if(!ctx)return damage;const s=ctx.state,absorbed=Math.min(damage,s.shield);if(absorbed>0){s.summary[s.shieldWord].absorbed+=absorbed;s.shield-=absorbed;}return damage-absorbed;}
function end(ctx,{hp,buffs,enemyHp,log}){
 if(!ctx)return {hp,enemyHp};const s=ctx.state;
 if(ctx.hit){s.attacks++;for(const word of ctx.active)activate(ctx,word);}
 // Attribute actual extra damage once, without triggering further rune attacks.
 const weighted=ctx.active.reduce((n,w)=>n+w.value,0);if(weighted&&ctx.damage>0)for(const word of ctx.active)s.summary[word.id].damage+=Math.round(ctx.damage*word.value/weighted);
 // A barrier expires after its protected turn. End-of-turn effects prepare the next one.
 s.shield=0;
 for(const word of s.words){
  if(ctx.round<(s.ready[word.id]||0))continue;
  if(hp>0&&word.effect==='heal'&&(word.trigger==='third'&&ctx.hit&&s.attacks%3===0||word.trigger==='critical'&&ctx.critical||word.trigger==='defend'&&ctx.action==='defend')){const before=hp;hp=heal(ctx,word,hp,buffs);if(hp>before&&word.trigger!=='third')s.ready[word.id]=ctx.round+3;}
  if(word.trigger==='block'&&ctx.blocked&&word.effect==='reflect'&&hp>0&&enemyHp>0&&!(ctx.intent.phase===1&&buffs.watchPhase===2)){let damage=Math.min(enemyHp,Math.round(ctx.stats.attack*word.value));if(ctx.enemy.mechanic==='lantern-v1'&&ctx.intent.phase===1&&enemyHp>Math.ceil(ctx.enemy.health/2)){damage=Math.min(damage,enemyHp-Math.ceil(ctx.enemy.health/2));if(enemyHp-damage===Math.ceil(ctx.enemy.health/2)){buffs.watchPhase=2;buffs.watchTurn=0;log?.push('Il sigillo si spezza. Il Custode apre la lanterna: l’alba prigioniera si risveglia.');}}if(damage>0){enemyHp-=damage;activate(ctx,word);s.summary[word.id].damage+=damage;}}
  if(word.trigger==='emergency'&&hp>0&&hp<ctx.stats.health*.3&&!s.emergency){s.emergency=true;s.shield=Math.round(ctx.stats.health*word.value);s.shieldWord=word.id;activate(ctx,word);}
 }
 if(ctx.received>0)s.hurtTurns++;
 const aegis=s.words.find(w=>w.trigger==='endure');if(aegis&&ctx.received>0&&s.hurtTurns%3===0&&hp>0){s.shield=Math.max(s.shield,Math.round(ctx.stats.health*aegis.value));s.shieldWord=aegis.id;activate(ctx,aegis);}
 if(ctx.action==='defend')s.previousDefense=true;else if(ctx.action==='attack')s.previousDefense=false;return {hp,enemyHp};
}
function summaries(buffs,status){return Object.values(buffs.runic?.summary||{}).map(row=>{const word=buffs.runic.words.find(w=>w.id===row.id);let reason='La condizione non si è verificata durante lo scontro.';
 if(status==='active')reason='In attesa della condizione.';
 else if(row.unneededHealing)reason='Non servivano cure quando si è verificata la condizione.';
 else if(word.effect==='ward')reason='Non c’erano danni potenti da ridurre ulteriormente.';
 else if(['defend','counter'].includes(word.trigger)&&buffs.autoDecisions&&(buffs.autoProfile||'aggressive')==='aggressive')reason='Auto Aggressivo non usa la difesa. Questa parola richiede una difesa.';
 else if(word.trigger==='third'&&buffs.runic.attacks<3)reason='Scontro concluso prima di accumulare tre attacchi riusciti.';
 return {...row,inactiveReason:row.activations?'':reason};});}
module.exports={snapshot,begin,absorb,end,summaries};
