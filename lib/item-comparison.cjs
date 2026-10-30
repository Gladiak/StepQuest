'use strict';
// Synchronous snapshots contain effective attribute changes only. Combat advice
// is produced asynchronously by comparison-service, never by a weighted score.
function compareStats(before,after,{item,current,hero,definitions}) {
 const alreadyEquipped=current?.id===item.id;
 const eligible=(!item.classId||item.classId===hero.class_id)&&item.level<=hero.level;
 const changes=Object.keys(definitions).map(stat=>({stat,label:definitions[stat].label,before:before[stat],after:after[stat],
  delta:Math.round((after[stat]-before[stat])*100)/100,percent:!!definitions[stat].percent})).filter(row=>Math.abs(row.delta)>=.01);
 return {equipped:alreadyEquipped,eligible,reason:eligible?'':item.level>hero.level?`Richiede il livello ${item.level}.`:'Oggetto riservato a un’altra classe.',
  current:current?{id:current.id,name:current.name}:null,changes,arrows:0,assessment:null};
}
module.exports={compareStats};
