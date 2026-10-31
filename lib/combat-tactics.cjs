'use strict';
const {watchIntent}=require('./watch-finale.cjs');
function intentFor(enemy,round,buffs={}){
 const watch=watchIntent(enemy,round,buffs);if(watch)return {...watch,heavy:['strike','dawn'].includes(watch.kind)};
 if(enemy.echoRank){
  const index=round%(enemy.echoRank===2?4:3),kind=(enemy.echoRank===2?['gather','dawn','exposed','attack']:['guard','strike','exposed'])[index];
  return {kind,heavy:['strike','dawn'].includes(kind),vulnerable:kind==='exposed',multiplier:kind==='gather'?0:kind==='dawn'?2:kind==='strike'?1.8:kind==='exposed'?.7:1,text:kind==='gather'?'Intento: raccoglie energia. L’alba arriva al prossimo turno.':kind==='dawn'||kind==='strike'?'Intento: colpo potente. Auto Prudente difende.':kind==='exposed'?'Intento: apertura. È il momento di attaccare.':kind==='guard'?'Intento: bastione. Il nemico assorbe parte dei danni.':'Intento: attacco'};
 }
 const heavy=(round+1)%(enemy.heavyEvery||3)===0;return {kind:heavy?'strike':'attack',heavy,vulnerable:round>0&&round%(enemy.heavyEvery||3)===0,multiplier:heavy?(enemy.heavyMultiplier||1.65):1,text:heavy?'Intento: carica potente':'Intento: attacco'};
}
function autoAction({enemy,round,buffs,hp,stats,log}){
 const intent=intentFor(enemy,round,buffs),profile=buffs.autoProfile||'aggressive';
 if(!buffs.autoDecisions)buffs.autoDecisions={attacks:0,defends:0,reasons:[]};
 const cleanse=buffs.runic?.words?.find(w=>w.id==='purity'),ready=round>=(buffs.runic?.ready?.purity||0);
 const purify=cleanse&&ready&&(buffs.poison>0||buffs.woundTurns>0)&&hp<stats.health*.85;
 const defend=profile==='prudent'&&(intent.heavy||purify);
 if(defend){const reason=intent.heavy?'Auto Prudente: difesa contro il colpo potente.':'Auto Prudente: difesa per purificare le ferite.';log?.push(reason);buffs.autoDecisions.defends++;if(!buffs.autoDecisions.reasons.includes(reason))buffs.autoDecisions.reasons.push(reason);return 'defend';}
 buffs.autoDecisions.attacks++;return 'attack';
}
function echoEnemy(enemy,rank){
 if(!rank)return enemy;
 const e={...enemy,echoRank:rank,health:Math.round(enemy.health*(rank===1?3.8:9)),attack:Math.round(enemy.attack*(rank===1?1.8:11.2)),armorPierce:rank===1?.25:.4,xp:Math.round(enemy.xp*(rank===1?1.15:1.3)),coins:Math.round(enemy.coins*(rank===1?1.2:1.4))};
 if(enemy.mechanic!=='lantern-v1'){e.name=rank===1?'Sentinella del Bastione':'Custode della Frattura';e.id='warden';e.poison=false;}
 return e;
}
module.exports={intentFor,autoAction,echoEnemy};
