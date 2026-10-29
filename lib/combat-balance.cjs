'use strict';
// Nuovi incontri: i valori già salvati negli scontri restano invariati.
const MINIMUM_LEVEL=[1,1,4,8,15];
const MONSTER_WEIGHTS={common:2500,uncommon:4000,rare:2800,mythic:600,legendary:100};
const ELITE_WEIGHTS={common:0,uncommon:1500,rare:6000,mythic:2200,legendary:300};
function dropChance(difficulty,bonus=0){return difficulty==='elite'?1:Math.min(.95,(difficulty==='easy'?.65:.85)*(1+Math.max(0,bonus)/100));}
function encounterProfile(stage,level,difficulty){
 const target=difficulty==='easy'?Math.max(1,Math.min(stage-1,level)):stage+(difficulty==='elite'?1:0);
 return {id:difficulty,advances:difficulty!=='easy',stage:target,factor:difficulty==='easy'?.75:difficulty==='elite'?1.18:1,elite:difficulty==='elite',dropChance:dropChance(difficulty),minimumRarity:difficulty==='elite'?(level>=4?'rare':'uncommon'):'common',dropCount:difficulty==='elite'?2:1};
}
function combatStage(stage,level){return Math.min(stage,level)+Math.max(0,stage-level)*.65;}
function enemyStats(stage,factor,level=stage){const combat=combatStage(stage,level);return {health:Math.round((26+combat*9)*factor),attack:Math.round((6+combat*2.5)*factor),defense:Math.floor(combat*.8),xp:Math.round((28+stage*7)*factor),coins:Math.round((14+stage*5)*factor)};}
function nextStage(current,battleStage,enemy){
 if(enemy.difficulty==='easy')return current;
 if(enemy.balanceVersion!==2)return Math.max(current,battleStage+1);
 if(enemy.expeditionId)return enemy.elite?Math.max(current,battleStage):current;
 return current+1;
}
module.exports={MINIMUM_LEVEL,MONSTER_WEIGHTS,ELITE_WEIGHTS,dropChance,encounterProfile,enemyStats,combatStage,nextStage};

function restPlan(hp,maxHealth,coins){
 const current=Math.min(maxHealth,hp),missing=maxHealth-current,emergency=Math.ceil(maxHealth*.35);
 if(coins<missing&&current<emergency)return {kind:'emergency',cost:0,healing:emergency-current,targetHp:emergency};
 return {kind:'full',cost:missing,healing:missing,targetHp:maxHealth};
}
module.exports.restPlan=restPlan;
