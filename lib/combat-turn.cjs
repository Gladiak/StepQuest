'use strict';
const {integer}=require('./game-items.cjs');
// Shared attack/defence rules for adventures and isolated arena sessions.
function combatTurn({stats,hp,enemy,enemyHp,round,buffs,action,rng,log,defeatMessage='Sei sconfitto. Torni a casa con 1 punto vita; conserva il tuo equipaggiamento.'}){
 let status='active';
    if(action==='attack'){
     const hits=1+(rng()<stats.speed/100?1:0);
     for(let hit=0;hit<hits&&enemyHp>0;hit++){
      if(rng()>stats.accuracy/100){log.push('Il tuo attacco manca il bersaglio.');continue;}
      const critical=rng()<stats.critical/100;
      const damage=Math.max(1,Math.round((Math.max(1,stats.attack*(1+(buffs.dailyEffects?.attackPercent||0)/100)-enemy.defense*.6)+stats.magic_damage)*(integer(rng,90,110)/100)*(critical?stats.critical_damage/100:1)));
      const dealt=Math.min(enemyHp,damage);enemyHp-=dealt;hp=Math.min(stats.health,hp+Math.floor(dealt*stats.life_steal/100));log.push(`${critical?'Colpo critico':'Attacco'}: ${dealt} danni.`);
     }
    }
    if(enemyHp>0){
     const heavy=(round+1)%(enemy.heavyEvery||3)===0;
     if(rng()<stats.dodge/100)log.push('Schivi il colpo nemico.');
     else{
      const block=rng()<stats.block/100;const reduction=Math.min(.8,stats.damage_reduction/100+(buffs.guard>0?(buffs.protection||15)/100:0));
      const damage=Math.max(1,Math.round(Math.max(1,enemy.attack-stats.defense*.55)*(heavy?(enemy.heavyMultiplier||1.65):1)*(action==='defend'?.4:1)*(block?.5:1)*(1-reduction)));
      hp-=damage;log.push(`${heavy?'Carica nemica':'Il nemico colpisce'}: ${damage} danni${block?' (parata)':''}.`);
      if(enemy.poison&&rng()<.25)buffs.poison=3;
      if(stats.thorns){const reflected=Math.min(enemyHp,Math.round(stats.thorns));enemyHp-=reflected;log.push(`Rifletti ${reflected} danni.`);}
     }
    }
    if(buffs.poison>0&&hp>0){hp-=3;buffs.poison--;log.push('Il veleno infligge 3 danni.');}
    if(buffs.guard>0)buffs.guard--;
    if(hp<=0){status='lost';hp=1;log.push(defeatMessage);}
    else{hp=Math.min(stats.health,hp+Math.floor(stats.regeneration));if(enemyHp<=0)status='won';}
 return {hp,enemyHp,status};
}
module.exports={combatTurn};
