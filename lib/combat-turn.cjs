'use strict';
const {integer}=require('./game-items.cjs');
const {watchIntent}=require('./watch-finale.cjs');
const {intentFor}=require('./combat-tactics.cjs');
const runes=require('./runic-combat.cjs');
// Shared attack/defence rules for adventures and isolated arena sessions.
function combatTurn({stats,hp,enemy,enemyHp,round,buffs,action,rng,log,defeatMessage='Sei sconfitto. Torni a casa con 1 punto vita; conserva il tuo equipaggiamento.'}){
 let status='active',transition=false;
 const intent=watchIntent(enemy,round,buffs),tactical=intentFor(enemy,round,buffs),threshold=Math.ceil(enemy.health/2);
 const runic=runes.begin({buffs,action,round,stats,hp,enemy,enemyHp,intent:tactical});
    if(action==='attack'){
     const hits=1+(rng()<stats.speed/100?1:0);
     for(let hit=0;hit<hits&&enemyHp>0;hit++){
      if(rng()>stats.accuracy/100){log?.push('Il tuo attacco manca il bersaglio.');continue;}
      const critical=rng()<stats.critical/100;
      const roll=(integer(rng,90,110)/100)*(critical?stats.critical_damage/100:1)*(intent?.vulnerable?1.5:enemy.echoRank&&tactical.vulnerable?1.2:1)*(enemy.echoRank&&tactical.kind==='guard'?.65:1);
      const raw=(Math.max(1,stats.attack*(1+(buffs.dailyEffects?.attackPercent||0)/100)-enemy.defense*.6)+stats.magic_damage)*roll;
      const damage=Math.max(1,Math.round((Math.max(1,stats.attack*(1+(buffs.dailyEffects?.attackPercent||0)/100)-enemy.defense*(1-(runic?.pierce||0))*.6)+stats.magic_damage)*roll*(1+(runic?.bonus||0))));
      const baselineDamage=Math.max(1,Math.round(raw));if(runic){runic.hit=true;runic.critical||=critical;}
      if(intent?.phase===1&&enemyHp>threshold&&enemyHp-damage<=threshold){
       const dealt=enemyHp-threshold;if(runic)runic.damage+=Math.max(0,dealt-Math.min(dealt,baselineDamage));enemyHp=threshold;hp=Math.min(stats.health,hp+Math.floor(dealt*stats.life_steal/100*(buffs.woundTurns>0?.7:1)));buffs.watchPhase=2;buffs.watchTurn=0;transition=true;
       log?.push('Il sigillo si spezza. Il Custode apre la lanterna: l’alba prigioniera si risveglia.');break;
      }
      const dealt=Math.min(enemyHp,damage);if(runic)runic.damage+=Math.max(0,dealt-Math.min(dealt,baselineDamage));enemyHp-=dealt;hp=Math.min(stats.health,hp+Math.floor(dealt*stats.life_steal/100*(buffs.woundTurns>0?.7:1)));log?.push(`${critical?'Colpo critico':'Attacco'}: ${dealt} danni.`);
     }
    }
    if(enemyHp>0&&!transition&&tactical.kind!=='gather'){
     const heavy=tactical.heavy;
     if(rng()<stats.dodge/100)log?.push('Schivi il colpo nemico.');
     else{
      const block=rng()<stats.block/100;const baseReduction=Math.min(.8,stats.damage_reduction/100+(buffs.guard>0?(buffs.protection||15)/100:0)),reduction=Math.min(.8,1-(1-baseReduction)*(1-(runic?.ward||0)));if(runic)runic.blocked=block;
      const incoming=Math.max(1,enemy.attack-stats.defense*(1-(enemy.armorPierce||0))*.55)*tactical.multiplier*(action==='defend'?.4:1)*(block?.5:1);
      let damage=Math.max(1,Math.round(incoming*(1-reduction))),withoutWard=Math.max(1,Math.round(incoming*(1-baseReduction)));
      if(intent?.kind==='dawn'&&buffs.watchFlame>0){damage=Math.max(1,Math.round(damage*.3));withoutWard=Math.max(1,Math.round(withoutWard*.3));buffs.watchFlame--;log?.push('L’ultima fiamma ti avvolge. La sua protezione si consuma contro l’alba.');}
      if(runic?.wardWord){const saved=withoutWard-damage;if(saved>0){const row=runic.state.summary[runic.wardWord.id];row.activations++;row.absorbed+=saved;}}
      damage=runes.absorb(runic,damage);if(runic)runic.received=damage;if(enemy.echoRank===2&&tactical.kind==='dawn'&&damage>0){buffs.woundTurns=3;log?.push('L’alba lascia ferite: cure ridotte del 30% per due turni.');}
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
    if(buffs.poison>0&&hp>0){hp-=3;if(runic)runic.received+=3;buffs.poison--;log?.push('Il veleno infligge 3 danni.');}
    if(buffs.guard>0)buffs.guard--;
    ({hp,enemyHp}=runes.end(runic,{hp,buffs,enemyHp,log}));
    if(hp<=0){status='lost';hp=1;log?.push(defeatMessage);}
    else{hp=Math.min(stats.health,hp+Math.floor(stats.regeneration*(buffs.woundTurns>0?.7:1)));if(enemyHp<=0)status='won';}
    if(buffs.woundTurns>0)buffs.woundTurns--;
 return {hp,enemyHp,status};
}
module.exports={combatTurn};
