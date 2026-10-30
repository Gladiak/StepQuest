'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {combatTurn}=require('../lib/combat-turn.cjs'),{MECHANIC,watchIntent}=require('../lib/watch-finale.cjs');
const {createCharactersRepository}=require('../lib/characters.cjs'),{createStepsRepository,scopeForKey}=require('../lib/steps-repository.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const stats={health:1000,attack:10,defense:0,magic_damage:0,speed:0,accuracy:100,critical:0,critical_damage:150,life_steal:0,dodge:0,block:0,damage_reduction:0,regeneration:0,thorns:0};
const enemy={id:'warden',mechanic:MECHANIC,health:100,attack:20,defense:0,heavyEvery:3};
const turn=(input={})=>combatTurn({stats,hp:1000,enemy,enemyHp:100,round:0,buffs:{},action:'attack',rng:()=>.5,log:[],...input});
test('Faro: il sigillo ferma anche critici e colpi multipli; la trasformazione concede tempo per leggere il nuovo intento',()=>{
 const buffs={watchFlame:1},log=[],result=turn({stats:{...stats,attack:9999,speed:100,critical:100},buffs,log});
 assert.equal(result.enemyHp,50);assert.equal(result.hp,1000);assert.equal(result.status,'active');assert.equal(buffs.watchPhase,2);assert.equal(watchIntent(enemy,1,buffs).kind,'gather');assert.equal(log.filter(x=>x.includes('sigillo')).length,1);
});
test('Faro: anche i danni riflessi rispettano il sigillo',()=>{
 const buffs={},result=turn({action:'defend',stats:{...stats,thorns:500},buffs});assert.equal(result.enemyHp,50);assert.equal(buffs.watchPhase,2);assert.equal(buffs.watchTurn,0);
});
test('Faro: preparazione, alba e vulnerabilità seguono gli intenti annunciati, anche usando una pozione',()=>{
 const buffs={watchPhase:2,watchTurn:0};assert.equal(watchIntent(enemy,5,buffs).kind,'gather');let r=turn({buffs,action:'potion'});assert.equal(r.hp,1000);assert.equal(watchIntent(enemy,6,buffs).kind,'dawn');
 r=turn({buffs,action:'defend'});assert.equal(r.hp,982);assert.equal(watchIntent(enemy,7,buffs).kind,'exposed');r=turn({buffs});assert.equal(r.enemyHp,85);assert.equal(r.hp,987);assert.equal(watchIntent(enemy,8,buffs).kind,'gather');
});
test('Faro: la fiamma protegge una sola alba che colpisce, resta dopo una schivata e si somma alla difesa',()=>{
 const shield={watchPhase:2,watchTurn:1,watchFlame:1},log=[];let r=turn({buffs:shield,action:'defend',log});assert.equal(r.hp,995);assert.equal(shield.watchFlame,0);assert.equal(log.filter(x=>x.includes('protezione')).length,1);
 shield.watchTurn=1;r=turn({buffs:shield,action:'defend'});assert.equal(r.hp,982);
 const dodge={watchPhase:2,watchTurn:1,watchFlame:1};r=turn({buffs:dodge,stats:{...stats,dodge:100},action:'defend'});assert.equal(r.hp,1000);assert.equal(dodge.watchFlame,1);
 const normal={watchFlame:1};turn({buffs:normal,action:'defend'});assert.equal(normal.watchFlame,1);
});
test('Faro: vecchi Custodi e altri incontri conservano le regole precedenti',()=>{
 const legacy={...enemy};delete legacy.mechanic;assert.equal(watchIntent(legacy,2,{}),null);assert.equal(turn({enemy:legacy,stats:{...stats,attack:200}}).status,'won');assert.equal(turn({enemy:legacy,round:2,action:'defend'}).hp,987);
});

function fixture(t,river=0,classId='guardian'){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'stepquest-finale-')),file=path.join(directory,'save.sqlite'),steps=createStepsRepository(file),scope=scopeForKey('synthetic-finale');steps.activate(scope);
 const chars=createCharactersRepository(file),hero=chars.create({name:'Elara',classId,sex:'female'}),sql=new DatabaseSync(file);let game=createGameRepository(file,{rng:()=>.5,today:()=> '2026-10-30'});game.state(hero.id);sql.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id);
 const chapter=(questId,choice=0)=>sql.prepare("INSERT INTO guild_contracts(id,character_id,scope_id,quest_id,accepted_at,accepted_day,accepted_week,baseline_steps,status,choice,claimed_at) VALUES(?,?,?,?,1,'2026-10-30','2026-10-26',0,'claimed',?,2)").run(randomUUID(),hero.id,scope,questId,choice);
 chapter('caravan-tracks');if(river!==null){chapter('river-message');chapter('river-bridge',river);}
 t.after(()=>{game.close();sql.close();chars.close();steps.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {hero,sql,chars,chapter,get game(){return game;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5,today:()=> '2026-10-30'});}};
}
const choice=(f,s,option,extra={})=>f.game.chooseExpedition(f.hero.id,{id:s.expedition.id,version:s.expedition.version,option,...extra});
function summit(f,flame='rune') {let s=f.game.startExpedition(f.hero.id,{route:'watch',requestId:randomUUID()});for(const option of ['search','bless',flame,'guardian'])s=choice(f,s,option);return s;}
function finish(f,s){f.sql.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(s.battle.id);return f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:s.battle.round});}
test('Faro: ponte e traghetto offrono effetti differenti; la guarigione e la protezione sono alternative esclusive',t=>{
 for(const river of [0,1]){
  const f=fixture(t,river);let s=f.game.startExpedition(f.hero.id,{route:'watch',requestId:randomUUID()});f.sql.prepare('UPDATE hero_progress SET hp=40 WHERE character_id=?').run(f.hero.id);s=choice(f,s,'search');
  assert.equal(s.expedition.boosts.defense,river===0?4:undefined);assert.ok(river===0?s.hero.hp===40:s.hero.hp>40);
  s=choice(f,s,'bless');const before=s.hero.hp;s=choice(f,s,'embers');assert.ok(s.hero.hp>before);assert.equal(s.expedition.boosts.watchFlame,undefined);assert.equal(s.expedition.boosts.watchFlameChoice,'heal');assert.throws(()=>choice(f,s,'rune'));
 }
});
test('Faro: fase, intento e protezione sopravvivono a riapertura; retry obsoleti non consumano turni',t=>{
 const f=fixture(t);let s=summit(f);assert.equal(s.battle.buffs.watchFlame,1);f.sql.prepare('UPDATE battles SET enemy_hp=? WHERE id=?').run(Math.ceil(s.battle.enemy.health/2)+1,s.battle.id);
 s=f.game.act(f.hero.id,{battleId:s.battle.id,round:s.battle.round,action:'attack'});assert.equal(s.battle.intent.kind,'gather');f.reopen();assert.deepEqual(f.game.state(f.hero.id),s);
 const old={battleId:s.battle.id,round:s.battle.round,action:'defend'};s=f.game.act(f.hero.id,old);assert.equal(s.battle.intent.kind,'dawn');f.reopen();assert.deepEqual(f.game.state(f.hero.id),s);assert.throws(()=>f.game.act(f.hero.id,old),{code:'STALE_TURN'});
 s=f.game.act(f.hero.id,{battleId:s.battle.id,round:s.battle.round,action:'defend'});assert.equal(s.battle.intent.kind,'exposed');assert.equal(s.battle.buffs.watchFlame,0);f.reopen();assert.deepEqual(f.game.state(f.hero.id),s);
});
test('Faro: ricordo della prima luce persistente, personale e legato alla fotografia del viaggio; rivisite senza duplicati',t=>{
 const f=fixture(t,1);let s=summit(f);f.sql.prepare("UPDATE guild_contracts SET choice=0 WHERE character_id=? AND quest_id='river-bridge'").run(f.hero.id);s=finish(f,s);const memory=s.atlas.finale.memory;assert.ok(memory.passage.includes('traghettatori'));assert.equal(memory.firstLight,true);assert.deepEqual(memory,s.expedition.rewards.finale);assert.equal(s.hero.steps,9925);assert.equal(s.chronicles.badges.find(b=>b.id==='beacon').earned,true);
 const other=f.chars.create({name:'Thorin',classId:'ranger',sex:'male'});assert.equal(f.game.state(other.id).atlas.finale.memory,null);f.reopen();assert.deepEqual(f.game.state(f.hero.id).atlas.finale.memory,memory);
 const duplicate=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});assert.deepEqual(duplicate,s);
 s=finish(f,summit(f,'embers'));assert.equal(s.expedition.rewards.finale.firstLight,false);assert.ok(s.expedition.rewards.finale.passage.includes('ponte'));assert.deepEqual(s.atlas.finale.memory,memory);assert.equal(f.sql.prepare('SELECT count(*) n FROM atlas_milestones').get().n,1);
});
test('Faro: il completamento di un viaggio legacy conserva il vecchio incontro e il traguardo; una rivisita può aggiungere il nuovo ricordo',t=>{
 const f=fixture(t);let s=f.game.startExpedition(f.hero.id,{route:'watch',requestId:randomUUID()});const plan=require('../lib/expedition-catalog.cjs').makePlan(require('../lib/expedition-catalog.cjs').ROUTES.find(r=>r.id==='watch'),1,()=>.5);
 plan[2]={title:'Il ponte ritrovato',text:'Una vecchia mappa rivela un passaggio verso il Faro.',options:[{id:'rune',title:'Segui il segno',kind:'blessing',description:'+18% attacco e +2 difesa fino alla fine della spedizione.',attack:18,defense:2}]};f.sql.prepare('UPDATE expeditions SET plan=? WHERE id=?').run(JSON.stringify(plan),s.expedition.id);f.sql.prepare("UPDATE atlas_runs SET snapshot=json_set(snapshot,'$.version',1) WHERE expedition_id=?").run(s.expedition.id);
 for(const option of ['search','bless','rune','guardian'])s=choice(f,s,option);assert.equal(s.battle.enemy.mechanic,undefined);assert.equal(s.battle.intent,null);assert.equal(s.expedition.finaleVersion,null);assert.equal(s.battle.buffs.watchFlame,undefined);s=finish(f,s);assert.equal(s.atlas.wardenDefeated,true);assert.equal(s.atlas.finale.memory,null);assert.equal(s.expedition.rewards.finale,undefined);
 const earned=f.sql.prepare('SELECT * FROM atlas_milestones').get();s=finish(f,summit(f));assert.equal(s.atlas.finale.memory.firstLight,false);assert.deepEqual(f.sql.prepare('SELECT * FROM atlas_milestones').get(),earned);
});
test('Faro: errori sul ricordo annullano ricompense, turno e traguardo insieme',t=>{
 const f=fixture(t);let s=summit(f);f.sql.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(s.battle.id);const before=f.game.state(f.hero.id);
 f.sql.exec("CREATE TRIGGER reject_finale BEFORE UPDATE OF rewards ON expeditions WHEN json_extract(NEW.rewards,'$.finale.version')=1 BEGIN SELECT RAISE(ABORT,'finale rollback'); END");
 assert.throws(()=>finish(f,s),/finale rollback/);assert.deepEqual(f.game.state(f.hero.id),before);assert.equal(f.sql.prepare('SELECT count(*) n FROM atlas_milestones').get().n,0);f.sql.exec('DROP TRIGGER reject_finale');s=finish(f,s);assert.equal(s.expedition.status,'completed');assert.ok(s.atlas.finale.memory);
});
test('Faro: tutte le sei classi possono vincere da livello 1 con corredo iniziale e una strategia dichiarata',t=>{
 for(const classId of ['guardian','arcanist','ranger','rogue','druid','berserker']){
  const f=fixture(t,0,classId);let s=summit(f),dawns=0;
  for(let n=0;n<100&&s.battle.status==='active';n++){const action=['dawn','strike'].includes(s.battle.intent.kind)?'defend':'attack';if(s.battle.intent.kind==='dawn')dawns++;s=f.game.act(f.hero.id,{battleId:s.battle.id,round:s.battle.round,action});}
  assert.equal(s.expedition.status,'completed',classId);assert.ok(dawns>0,classId+' experienced the dawn');assert.equal(s.hero.steps,9925);
 }
});
test('Faro: risoluzione automatica esplicita conclude lo stesso incontro e salva una sola ricompensa',t=>{
 const f=fixture(t);let s=f.game.startExpedition(f.hero.id,{route:'watch',requestId:randomUUID()});for(const option of ['search','bless','rune'])s=choice(f,s,option);
 s=choice(f,s,'guardian',{automatic:true});assert.equal(s.expedition.status,'completed');assert.equal(s.battle.buffs.watchPhase,2);assert.equal(s.expedition.rewards.finale.firstLight,true);assert.equal(s.hero.steps,9925);
 assert.deepEqual(f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0}),s);
});
