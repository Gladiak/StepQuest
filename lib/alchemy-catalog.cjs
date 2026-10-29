'use strict';
const REAGENTS=[
 {id:'ember',name:'Cuore di brace',kind:'key',symbol:'◆',color:'#ffb379'},
 {id:'moon',name:'Cristallo astrale',kind:'key',symbol:'✦',color:'#c7b6ff'},
 {id:'bark',name:'Nucleo di quercia',kind:'key',symbol:'❖',color:'#b8de91'},
 {id:'fang',name:'Zanna primordiale',kind:'key',symbol:'▲',color:'#f3d581'},
 {id:'veil',name:'Essenza del velo',kind:'key',symbol:'◈',color:'#9be8e1'},
 {id:'sulfur',name:'Zolfo solare',kind:'secondary',symbol:'✧',color:'#ffce76'},
 {id:'dust',name:'Polvere di cometa',kind:'secondary',symbol:'✶',color:'#c7b6ff'},
 {id:'resin',name:'Resina antica',kind:'secondary',symbol:'●',color:'#b8de91'},
 {id:'blood',name:'Sangue di drago',kind:'secondary',symbol:'♦',color:'#ffb4a4'},
 {id:'dew',name:'Rugiada lunare',kind:'secondary',symbol:'◉',color:'#a8dfff'},
 {id:'salt',name:'Sale purificato',kind:'secondary',symbol:'◇',color:'#ede6d1'},
];
const RECIPES=[
 {id:'flame',name:'Furia della brace',key:'ember',boost:'sulfur',stabilizer:'dew',cost:100,main:['attack_percent',24,36],extra:['critical_percent',5,9],penalty:['defense_percent',7,13]},
 {id:'astral',name:'Sigillo astrale',key:'moon',boost:'dust',stabilizer:'salt',cost:100,main:['magic_damage_flat',14,23],extra:['critical_damage_percent',14,24],penalty:['health_percent',6,11]},
 {id:'titan',name:'Pelle del titano',key:'bark',boost:'resin',stabilizer:'salt',cost:100,main:['health_percent',28,42],extra:['damage_reduction_percent',5,9],penalty:['attack_percent',5,9]},
 {id:'predator',name:'Patto del predatore',key:'fang',boost:'blood',stabilizer:'dew',cost:125,main:['critical_percent',10,16],extra:['life_steal_percent',3,5],penalty:['defense_percent',6,12]},
 {id:'phantom',name:'Passo spettrale',key:'veil',boost:'dust',stabilizer:'resin',cost:100,main:['speed_percent',8,14],extra:['dodge_percent',5,9],penalty:['health_percent',5,10]},
];
// One independent reagent roll per victory. Gear drops and their pity counter are unchanged.
const DROP_RATES={normal:{key:.02,secondary:.07},elite:{key:.05,secondary:.11},boss:{key:.08,secondary:.15},easy:{key:0,secondary:0}};
const recipeCost=(recipe,item)=>recipe.cost+Math.min(100,Math.floor(item.level/10)*10);
function rollOptions(recipe,item,{boost=false,stabilizer=false,rng=Math.random}={}){
 const integer=(lo,hi)=>lo+Math.floor(Math.min(.999999999,Math.max(0,rng()))*(hi-lo+1));
 return [0,1,2].map(index=>{
  const roll=([attribute_id,lo,hi],multiplier=1)=>{const scale=attribute_id.endsWith('_flat')?(1+Math.min(100,item.level)/20)*Math.min(3,item.depthMultiplier||1):1;return {attribute_id,value:Math.max(1,Math.round(integer(lo,hi)*scale*multiplier))};};
  const rolls=[roll(recipe.main,(boost?1.35:1)*[.92,1,1.08][index]),roll(recipe.extra)];
  if(rng()<(stabilizer ? .25 : .7)){const penalty=roll(recipe.penalty,stabilizer ? .45 : 1);rolls.push({...penalty,value:-penalty.value});}
  return {index,rolls};
 });
}
function rollReagent(enemy,rng){const rates=enemy.difficulty==='easy'?DROP_RATES.easy:enemy.expeditionId&&enemy.elite?DROP_RATES.boss:enemy.elite?DROP_RATES.elite:DROP_RATES.normal,value=rng(),kind=value<rates.key?'key':value<rates.key+rates.secondary?'secondary':null;if(!kind)return null;const pool=REAGENTS.filter(r=>r.kind===kind);return pool[Math.floor(Math.min(.999999999,Math.max(0,rng()))*pool.length)];}
module.exports={REAGENTS,RECIPES,DROP_RATES,recipeCost,rollOptions,rollReagent};
