'use strict';
// Simulazione offline di eroi nuovi: nessun accesso ai salvataggi o a Garmin.
const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCharactersRepository}=require('../lib/characters.cjs'),{createStepsRepository}=require('../lib/steps-repository.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const {randomUUID}=require('node:crypto'),C=require('../lib/game-catalog.cjs'),{ROUTES}=require('../lib/expedition-catalog.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stepquest-balance-')),report={samplesPerRouteAndClass:100,gear:'solo arma base e vestiti comuni, livello 1',strategy:'pattuglia iniziale; campo se ferito, altrimenti benedizione; evento prudente; custode automatico',rows:[]};
try{for(const cls of Object.keys(C.CLASSES)){
 const file=path.join(dir,cls+'.sqlite'),steps=createStepsRepository(file),characters=createCharactersRepository(file),sql=new DatabaseSync(file);let seed=1;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const game=createGameRepository(file,{rng});
 try{for(const route of ROUTES){let wins=0,coins=0,rounds=0,stepsSpent=0;for(let sample=0;sample<100;sample++){
 seed=sample+1000;const hero=characters.create({name:'Viandante',classId:cls,sex:'male'});sql.prepare('UPDATE characters SET steps=10000 WHERE id=?').run(hero.id);
 if(route.atlas){game.state(hero.id);sql.prepare("INSERT INTO guild_contracts(id,character_id,scope_id,quest_id,accepted_at,accepted_day,accepted_week,baseline_steps,status,choice,claimed_at) VALUES(?,?,?,'caravan-tracks',0,'2026-10-30','2026-10-26',0,'claimed',0,1)").run(randomUUID(),hero.id,'balance-fixture');}
 let state=game.startExpedition(hero.id,{route:route.id,requestId:randomUUID(),target:route.research?{type:'slot',id:'weapon'}:undefined});state=game.chooseExpedition(hero.id,{id:state.expedition.id,version:state.expedition.version,option:'patrol',automatic:true});
 while(state.expedition.status==='active'){
  let option;if(state.expedition.step===1)option=state.hero.hp<state.hero.stats.health*.8?'rest':'bless';else if(state.expedition.step===3)option='guardian';else option=(state.expedition.node.options.find(o=>o.kind==='heal'&&state.hero.hp<state.hero.stats.health)||state.expedition.node.options.find(o=>o.kind==='cache')||state.expedition.node.options.at(-1)).id;
  state=game.chooseExpedition(hero.id,{id:state.expedition.id,version:state.expedition.version,option,automatic:true});
 }
 if(state.research.pending)state=game.chooseResearchReward(hero.id,{expeditionId:state.research.pending.expeditionId,choice:0});
 stepsSpent+=10000-state.hero.steps;wins+=Number(state.expedition.status==='completed');coins+=state.hero.coins;rounds+=state.battle?.round||0;characters.remove(hero.id,'Viandante');
 }report.rows.push({class:cls,route:route.id,completionPercent:wins,meanCoins:Math.round(coins/100),meanStepsSpent:Math.round(stepsSpent/100),meanLastBattleRounds:Number((rounds/100).toFixed(1))});}}
 finally{game.close();sql.close();characters.close();steps.close();}
}}finally{fs.rmSync(dir,{recursive:true,force:true});}
fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/expedition-balance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
