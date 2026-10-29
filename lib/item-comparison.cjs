'use strict';
// Stima di combattimento: danno atteso e resistenza contro una minaccia alla profondità attuale.
// Monete, XP e probabilità bottino rimangono nel confronto degli attributi, senza gonfiare l'indice.
function combatPower(stats,stage=1){
 const threat=6+Math.max(1,stage)*3,armor=Math.floor(Math.max(1,stage)*.8);
 const offense=(Math.max(1,stats.attack-armor*.6)+stats.magic_damage)*(stats.accuracy/100)
  *(1+stats.critical/100*(stats.critical_damage/100-1))*(1+stats.speed/100);
 const incoming=Math.max(1,threat-stats.defense*.55)*(1-stats.dodge/100)*(1-stats.block/200)*(1-stats.damage_reduction/100);
 const healing=stats.regeneration+offense*stats.life_steal/100;
 const survival=stats.health*threat/Math.max(1,incoming-Math.min(incoming*.75,healing));
 return Math.sqrt(Math.max(0,(offense+stats.thorns*.5)*survival));
}
function compareStats(before,after,{item,current,hero,stage,definitions}){
 const beforePower=combatPower(before,stage),afterPower=combatPower(after,stage);
 const percent=beforePower>0?(afterPower/beforePower-1)*100:0;
 const alreadyEquipped=current?.id===item.id;
 const eligible=(!item.classId||item.classId===hero.class_id)&&item.level<=hero.level;
 const changes=Object.keys(definitions).map(stat=>({stat,label:definitions[stat].label,before:before[stat],after:after[stat],delta:Math.round((after[stat]-before[stat])*100)/100,percent:!!definitions[stat].percent})).filter(row=>Math.abs(row.delta)>=.01);
 const gain=Math.round(percent*10)/10;
 return {equipped:alreadyEquipped,eligible,reason:eligible?'':item.level>hero.level?`Richiede il livello ${item.level}.`:'Oggetto riservato a un’altra classe.',
  current:current?{id:current.id,name:current.name}:null,beforePower:Math.round(beforePower*10)/10,afterPower:Math.round(afterPower*10)/10,
  gainPercent:gain,arrows:!alreadyEquipped&&eligible&&gain>=.5?(gain>=15?3:gain>=5?2:1):0,changes};
}
module.exports={combatPower,compareStats};
