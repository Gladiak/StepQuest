'use strict';

const { combatTurn } = require('./combat-turn.cjs');
const { encounterProfile, enemyStats } = require('./combat-balance.cjs');
const { ROUTES } = require('./expedition-catalog.cjs');
const { ENEMIES } = require('./game-catalog.cjs');

const VERSION = 1, INITIAL_SAMPLES = 32, MAX_SAMPLES = 128, CHAIN_LENGTH = 3, MAX_ROUNDS = 250;
const COMBAT_STATS = ['attack','defense','health','magic_damage','accuracy','critical','critical_damage','speed','dodge','block','damage_reduction','regeneration','life_steal','thorns'];
const seeded = initial => { let seed = initial; return () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296); };
const mean = values => values.reduce((sum,n) => sum+n,0) / values.length;
const round = n => Math.round(n*100)/100;

function scenarios(context) {
 const { stage, level } = context;
 const normal = encounterProfile(stage,level,'normal'), elite = encounterProfile(stage,level,'elite');
 const route = ROUTES.find(r => r.id === 'pass');
 // The final guardian uses the same level/factor as startEncounter on this route.
 return [
  { id:'normal', stage:normal.stage, factor:normal.factor, elite:false },
  { id:'elite', stage:elite.stage, factor:elite.factor, elite:true },
  { id:'guardian', stage:stage+1, factor:1.18*route.factor, elite:true, guardian:true }
 ];
}

function simulateSample(stats, context, scenario, sample) {
 let hp = stats.health, wins = 0, attempts = 0, turns = 0, xp = 0, coins = 0;
 for (let fight=0;fight<CHAIN_LENGTH;fight++) {
  const rng = seeded(0x5f3759df + sample*65537 + fight*257 + scenariosIndex(scenario.id)*17);
  const model = scenario.guardian?ENEMIES[2]:ENEMIES[(sample+fight)%ENEMIES.length];
  const enemy = { ...model, ...enemyStats(scenario.stage,scenario.factor,context.level),
   heavyMultiplier:scenario.elite?1.5:1.65, heavyEvery:3 };
  if (scenario.guardian) {
   const trait = sample%3;
   enemy.health = Math.round(enemy.health*[.9,1.15,1][trait]);
   enemy.attack = Math.round(enemy.attack*[1.15,.9,.9][trait]);
   enemy.defense += trait===1?2:0;
   enemy.heavyEvery = [2,4,3][trait];
   enemy.poison = enemy.poison || trait===2;
  }
  const buffs = { dailyEffects:context.effects };
  let enemyHp = enemy.health, status = 'active', turn = 0;
  attempts++;
  while (status==='active' && turn<MAX_ROUNDS) {
   ({hp,enemyHp,status} = combatTurn({stats,hp,enemy,enemyHp,round:turn,buffs,action:'attack',rng}));
   turn++;
  }
  turns += turn;
  if (status!=='won') { hp=0;break; }
  wins++;
  xp += Math.round(enemy.xp*(1+stats.xp_bonus/100)*(1+(context.effects?.xpPercent||0)/100));
  coins += Math.round(enemy.coins*(1+stats.gold_bonus/100));
 }
 const restCoins = Math.max(0,stats.health-hp);
 // Full recovery costs one coin per missing HP. Count its opportunity cost even
 // when battle rewards can pay for it; do not invent infinite/free step budgets.
 const steps = attempts*context.rules.encounter_steps + restCoins*context.rules.exchange_steps/context.rules.exchange_coins;
 return { wins:wins/CHAIN_LENGTH, complete:Number(wins===CHAIN_LENGTH), rounds:turns/attempts,
  restCoins, netCoins:coins-restCoins, efficiency:steps>0?xp*100/steps:0 };
}
function scenariosIndex(id) { return ['normal','elite','guardian'].indexOf(id); }

function createSimulator({ cacheSize=128 }={}) {
 const baselineCache = new Map();
 function runs(stats,context,samples) {
  const key = JSON.stringify([VERSION,stats,context,samples]);
  if (baselineCache.has(key)) { const value=baselineCache.get(key);baselineCache.delete(key);baselineCache.set(key,value);return value; }
  const result = scenarios(context).flatMap(scenario => Array.from({length:samples},(_,i) => simulateSample(stats,context,scenario,i)));
  baselineCache.set(key,result);
  if (baselineCache.size>cacheSize) baselineCache.delete(baselineCache.keys().next().value);
  return result;
 }
 function evaluate(input) {
  const { before,after,context } = input;
  if (JSON.stringify(before)===JSON.stringify(after)) return result('same','equivalent',0,null,0);
  let samples=INITIAL_SAMPLES, beforeRuns=runs(before,context,samples), afterRuns=runs(after,context,samples);
  let decision=decide(beforeRuns,afterRuns);
  if (decision.uncertain) {
   samples=MAX_SAMPLES;beforeRuns=runs(before,context,samples);afterRuns=runs(after,context,samples);
   decision=decide(beforeRuns,afterRuns);
  }
  return result(decision.direction,decision.reason,decision.gain,metrics(beforeRuns,afterRuns),samples,decision.uncertain);
 }
 return { evaluate, clear:()=>baselineCache.clear() };
}

function evidence(before,after,field,threshold,relative=false) {
 const deltas=after.map((r,i)=>r[field]-before[i][field]), average=mean(deltas);
 const variance=deltas.length>1?deltas.reduce((sum,v)=>sum+(v-average)**2,0)/(deltas.length-1):0;
 const margin=1.96*Math.sqrt(variance/deltas.length);
 const scale=relative?Math.max(1,Math.abs(mean(before.map(r=>r[field])))):1;
 const material=threshold*scale, strong=Math.abs(average)>Math.max(material,margin);
 return { average, gain:average/scale*100, strong, uncertain:!strong&&Math.abs(average)>material, margin };
}
function decide(before,after) {
 if(!before.some(r=>r.wins>0)&&!after.some(r=>r.wins>0))return {direction:'same',reason:'unresolved',gain:0,uncertain:false};
 // Winning comes first. Progression accounts for recovery and actual XP bonuses;
 // speed and spare coins resolve otherwise practically equal equipment.
 for (const [field,threshold,relative,reason,invert] of [
  ['wins',.03,false,'wins',false],['efficiency',.03,true,'progression',false],
  ['rounds',.05,true,'speed',true],['netCoins',.05,true,'coins',false]
 ]) {
  if(field==='rounds'&&(!before.every(r=>r.complete)||!after.every(r=>r.complete)))continue;
  const test=evidence(before,after,field,threshold,relative);
  if (test.strong) return { direction:(test.average>0)!==invert?'better':'worse', reason, gain:invert?-test.gain:test.gain, uncertain:false };
  // Do not let a secondary metric override an unresolved survival/progression loss.
  if (test.uncertain) return { direction:'same',reason:'close',gain:0,uncertain:true };
 }
 return { direction:'same',reason:'equivalent',gain:0,uncertain:false };
}
function metrics(before,after) {
 const summarize=rows=>({ winRate:round(mean(rows.map(r=>r.wins))*100),chainSuccess:round(mean(rows.map(r=>r.complete))*100),
  xpPer100Steps:round(mean(rows.map(r=>r.efficiency))),rounds:round(mean(rows.map(r=>r.rounds))),
  restCoins:round(mean(rows.map(r=>r.restCoins))),netCoins:round(mean(rows.map(r=>r.netCoins))) });
 return {before:summarize(before),after:summarize(after)};
}
function result(recommendation,reason,gain,measured,samples,uncertain=false) {
 return { recommendation,reason,gainPercent:round(gain),metrics:measured,samples,uncertain,
  arrows:recommendation==='better'?(gain>=15?3:gain>=5?2:1):0,
  reference:{chainLength:CHAIN_LENGTH,maxRounds:MAX_ROUNDS,scenarios:['normal','elite','guardian']} };
}

module.exports={VERSION,COMBAT_STATS,createSimulator,scenarios};
