'use strict';
const {integer}=require('./game-items.cjs');
const {watchIntent}=require('./watch-finale.cjs');
// Shared attack/defence rules for adventures and isolated arena sessions.
function combatTurn({stats,hp,enemy,enemyHp,round,buffs,action,rng,log,defeatMessage='Sei sconfitto. Torni a casa con 1 punto vita; conserva il tuo equipaggiamento.'}){
 let status='active',transition=false;
 const intent=watchIntent(enemy,round,buffs),threshold=Math.ceil(enemy.health/2);
    if(action==='attack'){
     const hits=1+(rng()<stats.speed/100?1:0);
     for(let hit=0;hit<hits&&enemyHp>0;hit++){
      if(rng()>stats.accuracy/100){log?.push('Il tuo attacco manca il bersaglio.');continue;}
      const critical=rng()<stats.critical/100;
      const damage=Math.max(1,Math.round((Math.max(1,stats.attack*(1+(buffs.dailyEffects?.attackPercent||0)/100)-enemy.defense*.6)+stats.magic_damage)*(integer(rng,90,110)/100)*(critical?stats.critical_damage/100:1)*(intent?.vulnerable?1.5:1)));
      if(intent?.phase===1&&enemyHp>threshold&&enemyHp-damage<=threshold){
       const dealt=enemyHp-threshold;enemyHp=threshold;hp=Math.min(stats.health,hp+Math.floor(dealt*stats.life_steal/100));buffs.watchPhase=2;buffs.watchTurn=0;transition=true;
       log?.push('Il sigillo si spezza. Il Custode apre la lanterna: l’alba prigioniera si risveglia.');break;
      }
      const dealt=Math.min(enemyHp,damage);enemyHp-=dealt;hp=Math.min(stats.health,hp+Math.floor(dealt*stats.life_steal/100));log?.push(`${critical?'Colpo critico':'Attacco'}: ${dealt} danni.`);
     }
    }
    if(enemyHp>0&&!transition&&intent?.kind!=='gather'){
     const heavy=intent?['strike','dawn'].includes(intent.kind):(round+1)%(enemy.heavyEvery||3)===0;
     if(rng()<stats.dodge/100)log?.push('Schivi il colpo nemico.');
     else{
      const block=rng()<stats.block/100;const reduction=Math.min(.8,stats.damage_reduction/100+(buffs.guard>0?(buffs.protection||15)/100:0));
      let damage=Math.max(1,Math.round(Math.max(1,enemy.attack-stats.defense*.55)*(intent?intent.multiplier:heavy?(enemy.heavyMultiplier||1.65):1)*(action==='defend'?.4:1)*(block?.5:1)*(1-reduction)));
      if(intent?.kind==='dawn'&&buffs.watchFlame>0){damage=Math.max(1,Math.round(damage*.3));buffs.watchFlame--;log?.push('L’ultima fiamma ti avvolge. La sua protezione si consuma contro l’alba.');}
      hp-=damage;log?.push(`${intent?.kind==='dawn'?'Alba spezzata':heavy?'Carica nemica':'Il nemico colpisce'}: ${damage} danni${block?' (parata)':''}.`);
      if(enemy.poison&&rng()<.25)buffs.poison=3;
      if(stats.thorns){
       const before=enemyHp,remaining=enemyHp-Math.min(enemyHp,Math.round(stats.thorns));
       if(intent?.phase===1&&enemyHp>threshold&&remaining<=threshold){enemyHp=threshold;buffs.watchPhase=2;buffs.watchTurn=0;transition=true;log?.push('Il sigillo si spezza. Il Custode apre la lanterna: l’alba prigioniera si risveglia.');}
       else enemyHp=remaining;
       log?.push(`Rifletti ${before-enemyHp} danni.`);
      }
     }
    }
    if(intent?.kind==='gather')log?.push('La luce converge nella lanterna. Il prossimo turno scatenerà l’alba: preparati a difenderti.');
    if(intent?.phase===2&&!transition)buffs.watchTurn=((buffs.watchTurn||0)+1)%3;
    if(buffs.poison>0&&hp>0){hp-=3;buffs.poison--;log?.push('Il veleno infligge 3 danni.');}
    if(buffs.guard>0)buffs.guard--;
    if(hp<=0){status='lost';hp=1;log?.push(defeatMessage);}
    else{hp=Math.min(stats.health,hp+Math.floor(stats.regeneration));if(enemyHp<=0)status='won';}
 return {hp,enemyHp,status};
}
module.exports={combatTurn};
