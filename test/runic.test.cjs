'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs'),{generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
const {RUNES,WORDS,ECHOES}=require('../lib/runic-catalog.cjs'),{combatTurn}=require('../lib/combat-turn.cjs'),{snapshot,summaries}=require('../lib/runic-combat.cjs'),{autoAction,echoEnemy,intentFor}=require('../lib/combat-tactics.cjs'),{createSimulator}=require('../lib/comparison-simulation.cjs');
function fixture(t,classId='guardian'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-runic-')),file=path.join(dir,'save.sqlite'),chars=createCharactersRepository(file),hero=chars.create({name:'Elara',classId,sex:'female'}),db=new DatabaseSync(file);let game=createGameRepository(file,{rng:()=>.5});game.state(hero.id);
 db.prepare('UPDATE hero_progress SET level=45,stage=100 WHERE character_id=?').run(hero.id);db.prepare('UPDATE characters SET coins=100000,steps=100000 WHERE id=?').run(hero.id);
 game.rest(hero.id);
 const state=()=>game.state(hero.id),grant=()=>{game.initiateRunic(hero.id,{requestId:randomUUID()});for(const rune of RUNES)db.prepare('INSERT INTO rune_inventory VALUES(?,?,5) ON CONFLICT(character_id,rune_id) DO UPDATE SET quantity=5').run(hero.id,rune.id);},quote=(word,item=state().equipment[WORDS.find(w=>w.id===word)?.slot||'weapon'],mode='engrave')=>game.previewRuneword(hero.id,{itemId:item.id,wordId:word,mode}),engrave=word=>game.inscribeRuneword(hero.id,{...quote(word),requestId:randomUUID()});
 t.after(()=>{game.close();db.close();chars.close();fs.rmSync(dir,{recursive:true,force:true});});
 return {file,hero,db,chars,state,grant,quote,engrave,get game(){return game;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5});}};
}
test('runic catalog has twelve distinct runes and sixteen recipes, eight per slot, with coherent gates',()=>{
 assert.equal(RUNES.length,12);assert.equal(WORDS.length,16);assert.equal(new Set(RUNES.map(r=>r.id)).size,12);assert.equal(new Set(WORDS.map(w=>w.runes.join(','))).size,16);
 for(const slot of ['weapon','body'])assert.equal(WORDS.filter(w=>w.slot===slot).length,8);
 for(const w of WORDS){assert.ok([2,3].includes(w.runes.length));for(const r of w.runes)assert.ok(RUNES.find(rune=>rune.id===r).level<=w.level);}
 assert.deepEqual(ECHOES.map(e=>[e.level,e.depth]),[[1,1],[30,60],[45,100]]);
});
test('reading old heroes grants nothing; the level-15 primer and crafting are personal and idempotent',t=>{
 const f=fixture(t);assert.equal(f.state().runic.fragments,0);assert.equal(f.db.prepare('SELECT count(*) n FROM runic_profiles').get().n,0);
 f.db.prepare('UPDATE hero_progress SET level=14 WHERE character_id=?').run(f.hero.id);const request={requestId:randomUUID()};assert.throws(()=>f.game.initiateRunic(f.hero.id,request),/livello 15/);
 f.db.prepare('UPDATE hero_progress SET level=15 WHERE character_id=?').run(f.hero.id);let s=f.game.initiateRunic(f.hero.id,request);assert.equal(s.runic.fragments,16);assert.deepEqual(s.runic.runes.filter(r=>r.quantity).map(r=>[r.id,r.quantity]),[['sol',1],['tor',1],['lum',1],['or',1]]);
 assert.deepEqual(f.game.initiateRunic(f.hero.id,request),s);assert.deepEqual(f.game.initiateRunic(f.hero.id,{requestId:randomUUID()}),s);
 const craft={requestId:randomUUID(),runeId:'vel'};s=f.game.craftRune(f.hero.id,craft);assert.equal(s.runic.fragments,8);assert.equal(s.runic.runes.find(r=>r.id==='vel').quantity,1);assert.deepEqual(f.game.craftRune(f.hero.id,craft),s);
 assert.throws(()=>f.game.craftRune(f.hero.id,{...craft,runeId:'ka'}));assert.throws(()=>f.game.craftRune(f.hero.id,{requestId:randomUUID(),runeId:'thal'}));
 const other=f.chars.create({name:'Thorin',classId:'ranger',sex:'male'});assert.equal(f.game.state(other.id).runic.fragments,0);assert.throws(()=>f.game.craftRune(other.id,craft));
 f.reopen();assert.deepEqual(f.state(),s);
});
test('engraving and recovery preserve the piece, refinements and enchantments; each payment and rune is applied once',t=>{
 const f=fixture(t);f.grant();const item=f.state().equipment.weapon;
 f.game.refineItem(f.hero.id,{requestId:randomUUID(),itemId:item.id,rank:0});f.db.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(item.id,f.hero.id,'ember-fury','[{"attribute_id":"attack_flat","value":10}]',new Date().toISOString());
 const before=f.state(),request={...f.quote('ember'),requestId:randomUUID()};let after=f.game.inscribeRuneword(f.hero.id,request);
 assert.equal(after.equipment.weapon.runeword.id,'ember');assert.equal(after.equipment.weapon.id,item.id);assert.deepEqual(after.equipment.weapon.refinement,before.equipment.weapon.refinement);assert.deepEqual(after.equipment.weapon.enchantment,before.equipment.weapon.enchantment);
 assert.equal(after.hero.coins,before.hero.coins-request.cost);assert.equal(after.hero.steps,before.hero.steps);assert.equal(after.runic.runes.find(r=>r.id==='sol').quantity,4);assert.deepEqual(f.game.inscribeRuneword(f.hero.id,request),after);
 f.reopen();assert.deepEqual(f.state(),after);const extract={...f.quote('ember',after.equipment.weapon,'extract'),requestId:randomUUID()};after=f.game.inscribeRuneword(f.hero.id,extract);
 assert.deepEqual(after.equipment.weapon,before.equipment.weapon);assert.equal(after.runic.runes.find(r=>r.id==='sol').quantity,5);assert.equal(after.runic.runes.find(r=>r.id==='tor').quantity,5);assert.equal(after.hero.coins,before.hero.coins-request.cost-extract.cost);assert.deepEqual(f.game.inscribeRuneword(f.hero.id,extract),after);
});
test('engraving checks ownership, slot, class, level, pending alchemy, stale quotes, balances and home state',t=>{
 const f=fixture(t);f.grant();const before=f.state(),q=f.quote('ember');assert.throws(()=>f.game.inscribeRuneword(f.hero.id,{...q,token:'forged',requestId:randomUUID()}),{code:'STALE_RUNIC'});assert.deepEqual(f.state(),before);
 f.game.craftRune(f.hero.id,{runeId:'sol',requestId:randomUUID()});assert.throws(()=>f.game.inscribeRuneword(f.hero.id,{...q,requestId:randomUUID()}),{code:'STALE_RUNIC'});
 assert.throws(()=>f.quote('vigil',before.equipment.weapon));const other=f.chars.create({name:'Thorin',classId:'ranger',sex:'male'});f.game.state(other.id);assert.throws(()=>f.game.previewRuneword(other.id,{itemId:q.itemId,wordId:'ember'}));
 for(const [template,level] of [['arcanist-weapon-0',1],['guardian-weapon-0',50],['ring-0',1]]){const item=generateItem(C.TEMPLATES.find(t=>t.id===template),{level});insertItem(f.db,f.hero.id,item);assert.throws(()=>f.quote('ember',item));}
 f.db.prepare('UPDATE hero_progress SET level=15 WHERE character_id=?').run(f.hero.id);assert.throws(()=>f.quote('star'));f.db.prepare('UPDATE hero_progress SET level=45 WHERE character_id=?').run(f.hero.id);
 f.db.prepare('INSERT INTO alchemy_attempts VALUES(?,?,?,?,?,?,?,?,NULL,?)').run(randomUUID(),f.hero.id,q.itemId,'flame','pending',1,'{}','[]',new Date().toISOString());assert.throws(()=>f.quote('ember'),/alchemica/);f.db.prepare('DELETE FROM alchemy_attempts WHERE item_id=?').run(q.itemId);
 f.db.prepare('UPDATE characters SET coins=0 WHERE id=?').run(f.hero.id);const poor={...f.quote('ember'),requestId:randomUUID()};assert.equal(poor.affordable,false);assert.throws(()=>f.game.inscribeRuneword(f.hero.id,poor),/insufficienti/);f.db.prepare('UPDATE characters SET coins=100000 WHERE id=?').run(f.hero.id);f.game.inscribeRuneword(f.hero.id,poor);
 assert.throws(()=>f.quote('ember'));f.game.startBattle(f.hero.id,'normal');assert.throws(()=>f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:1}));assert.throws(()=>f.game.previewRuneword(f.hero.id,{itemId:q.itemId,mode:'extract'}));
});
test('engraving failures roll back wallet, rune stock, action receipt and equipment together',t=>{
 const f=fixture(t);f.grant();const request={...f.quote('ember'),requestId:randomUUID()},before=f.state();f.db.exec("CREATE TRIGGER reject_word BEFORE INSERT ON item_runewords BEGIN SELECT RAISE(ABORT,'runic rollback'); END");
 assert.throws(()=>f.game.inscribeRuneword(f.hero.id,request),/runic rollback/);assert.deepEqual(f.state(),before);assert.equal(f.db.prepare('SELECT count(*) n FROM runic_actions WHERE id=?').get(request.requestId).n,0);f.db.exec('DROP TRIGGER reject_word');assert.equal(f.game.inscribeRuneword(f.hero.id,request).equipment.weapon.runeword.id,'ember');
});
test('only currently equipped weapon and body can be quoted, engraved or extracted, including stale equip changes',t=>{
 const f=fixture(t);f.grant();const worn=f.state().equipment.weapon,spare=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:45});insertItem(f.db,f.hero.id,spare);
 assert.throws(()=>f.quote('ember',spare),/non valido/);const request={...f.quote('ember'),requestId:randomUUID()};f.game.equip(f.hero.id,spare.id);const before=f.state();assert.throws(()=>f.game.inscribeRuneword(f.hero.id,request),/non valido/);assert.deepEqual(f.state(),before);
 f.game.equip(f.hero.id,worn.id);f.game.inscribeRuneword(f.hero.id,request);const extract={...f.quote('ember',worn,'extract'),requestId:randomUUID()};f.game.equip(f.hero.id,spare.id);const stored=f.state();assert.throws(()=>f.quote('ember',worn,'extract'),/non valido/);assert.throws(()=>f.game.inscribeRuneword(f.hero.id,extract),/non valido/);assert.deepEqual(f.state(),stored);f.game.equip(f.hero.id,worn.id);assert.equal(f.game.inscribeRuneword(f.hero.id,extract).equipment.weapon.runeword,null);
});
test('inscribed equipment survives reforging and cannot be sold alone or through bulk filters',t=>{
 const f=fixture(t);f.grant();f.engrave('ember');let s=f.state(),item=s.equipment.weapon,quote=s.smith.reforges.find(q=>q.id===item.id);s=f.game.reforgeItem(f.hero.id,{itemId:item.id,token:quote.token,version:quote.version,requestId:randomUUID()});assert.equal(s.equipment.weapon.runeword.id,'ember');
 const replacement=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:45});insertItem(f.db,f.hero.id,replacement);f.game.equip(f.hero.id,replacement.id);
 assert.throws(()=>f.game.sell(f.hero.id,item.id),/runica/);assert.ok(!f.game.previewRaritySale(f.hero.id,{rarities:['common'],includeConsumables:true}).items.some(i=>i.id===item.id));assert.ok(!f.game.previewJunkSale(f.hero.id).items.some(i=>i.id===item.id));
});
test('individual rune bonuses are capped, added once, and independent from refinement and historical depth',t=>{
 const f=fixture(t);f.grant();const before=f.state().hero.stats;let s=f.engrave('ember');assert.equal(s.hero.stats.attack,Math.round(before.attack*1.02*100)/100);assert.equal(s.hero.stats.defense,Math.round(before.defense*1.02*100)/100);
 const id=s.equipment.weapon.id;for(let rank=0;rank<5;rank++)s=f.game.refineItem(f.hero.id,{itemId:id,rank,requestId:randomUUID()});const withRunes=s.hero.stats,ex=f.game.inscribeRuneword(f.hero.id,{...f.quote('ember',s.equipment.weapon,'extract'),requestId:randomUUID()});assert.ok(Math.abs(withRunes.attack/ex.hero.stats.attack-1.02)<.001);
});
test('profile and echo gates persist per hero; ordinary and safe battles keep their rules and old snapshots resume',t=>{
 const f=fixture(t);f.db.prepare('UPDATE hero_progress SET level=29 WHERE character_id=?').run(f.hero.id);assert.throws(()=>f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:1}));f.db.prepare('UPDATE hero_progress SET level=45,stage=59 WHERE character_id=?').run(f.hero.id);assert.throws(()=>f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:1}));f.db.prepare('UPDATE hero_progress SET stage=100 WHERE character_id=?').run(f.hero.id);
 let s=f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:2});f.reopen();assert.deepEqual(f.state().runic,s.runic);s=f.game.startBattle(f.hero.id,'easy');assert.equal(s.battle.enemy.echoRank,undefined);assert.equal(s.battle.autoProfile,'prudent');
 f.game.act(f.hero.id,{battleId:s.battle.id,round:0,action:'flee'});s=f.game.startBattle(f.hero.id,'elite');assert.equal(s.battle.enemy.echoRank,2);assert.equal(s.battle.tacticalIntent.kind,'gather');f.reopen();assert.deepEqual(f.state(),s);
 f.db.prepare("UPDATE battles SET buffs='{}' WHERE id=?").run(s.battle.id);assert.equal(f.state().battle.autoProfile,'aggressive');assert.deepEqual(f.state().battle.runicSummary,[]);
});
test('automatic combat snapshots words, reports defenses and pays advanced loot only once',t=>{
 const f=fixture(t);f.grant();f.engrave('revenge');f.engrave('vigil');f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:1});let s=f.game.startBattle(f.hero.id,'elite');assert.deepEqual(s.battle.buffs.runic.words.map(w=>w.id).sort(),['revenge','vigil']);
 const e={...s.battle.enemy,attack:1,health:1000};f.db.prepare('UPDATE battles SET enemy=?,enemy_hp=1000 WHERE id=?').run(JSON.stringify(e),s.battle.id);s=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});assert.equal(s.battle.status,'won');assert.ok(s.battle.autoDecisions.defends>0);assert.ok(s.battle.runicSummary.every(row=>row.activations>0));assert.equal(s.battle.rewards.runicLoot.fragments,3);assert.equal(s.battle.buffs.autoDecisions.attacks+s.battle.buffs.autoDecisions.defends,s.battle.round);assert.deepEqual(f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0}),s);
});
test('all six classes can engrave both slots, recover a three-rune recipe and clamp health after extraction',t=>{
 for(const classId of Object.keys(C.CLASSES)){
  const f=fixture(t,classId);f.grant();let s=f.engrave('star');s=f.engrave('purity');assert.equal(s.equipment.weapon.runeword.id,'star');assert.equal(s.equipment.body.runeword.id,'purity');
  s=f.game.rest(f.hero.id);const before=s,extract={...f.quote('purity',s.equipment.body,'extract'),requestId:randomUUID()};s=f.game.inscribeRuneword(f.hero.id,extract);assert.equal(s.equipment.body.runeword,null);assert.ok(s.hero.stats.health<before.hero.stats.health);assert.equal(f.db.prepare('SELECT hp FROM hero_progress WHERE character_id=?').get(f.hero.id).hp,s.hero.stats.health);
  for(const id of ['thal','lum','ith'])assert.equal(s.runic.runes.find(r=>r.id===id).quantity,before.runic.runes.find(r=>r.id===id).quantity+1);
 }
});
test('Arena uses snapshotted words and profile with separate health and stock; Echoes remain exclusive to paths',t=>{
 const f=fixture(t);f.grant();f.engrave('revenge');f.engrave('vigil');f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:2});const before=f.state();let s=f.game.startArena(f.hero.id,{requestId:randomUUID(),kind:'practice',slot:0,currency:'gold'});assert.equal(s.arena.session.autoProfile,'prudent');assert.equal(s.arena.session.enemy.echoRank,undefined);assert.equal(s.arena.session.runicSummary.length,2);assert.throws(()=>f.game.configureRunic(f.hero.id,{profile:'aggressive',echoRank:0}));f.reopen();assert.deepEqual(f.state(),s);
 s=f.game.arenaAction(f.hero.id,{id:s.arena.session.id,round:0,action:'auto'});assert.equal(s.hero.hp,before.hero.hp);assert.deepEqual(s.runic.runes,before.runic.runes);assert.ok(s.arena.session.autoDecisions.attacks>0);assert.equal(s.arena.session.autoProfile,'prudent');
});
test('new expeditions retain the selected Echo rank while legacy expedition snapshots remain ordinary',t=>{
 const f=fixture(t);f.game.configureRunic(f.hero.id,{profile:'prudent',echoRank:1});let s=f.game.startExpedition(f.hero.id,{route:'grove',requestId:randomUUID()});assert.equal(s.expedition.boosts.echoRank,1);assert.throws(()=>f.game.configureRunic(f.hero.id,{profile:'aggressive',echoRank:0}));f.reopen();assert.deepEqual(f.state(),s);
 // The first step is a combat choice. Missing legacy boost keys must not adopt current preferences.
 f.db.prepare("UPDATE expeditions SET boosts='{}' WHERE id=?").run(s.expedition.id);s=f.game.chooseExpedition(f.hero.id,{id:s.expedition.id,version:s.expedition.version,option:s.expedition.node.options.find(o=>o.kind==='battle').id});assert.equal(s.battle.enemy.echoRank,undefined);assert.equal(s.battle.autoProfile,'prudent');
});
test('comparison inputs and worker caching include words, automatic profile and echo difficulty',t=>{
 const f=fixture(t);f.grant();const before=f.state();f.engrave('ember');let s=f.state();assert.notEqual(before.comparisonContext,s.comparisonContext);assert.throws(()=>f.game.comparisonInput(f.hero.id,{context:before.comparisonContext,itemIds:[s.equipment.body.id]}),{code:'STALE_COMPARISON'});
 const input=f.game.comparisonInput(f.hero.id,{context:s.comparisonContext,itemIds:[s.equipment.body.id]}).items[0].comparisons[0].input;assert.equal(input.beforeWords[0].id,'ember');assert.equal(input.afterWords[0].id,'ember');
 const sim=createSimulator(),context={level:45,stage:100,effects:{},profile:'prudent',echoRank:1,rules:{encounter_steps:10,exchange_steps:10,exchange_coins:4}},strong={...stats,attack:85,health:3000,defense:80,xp_bonus:0,gold_bonus:0};const normal=sim.evaluate({before:strong,after:strong,context,beforeWords:[],afterWords:[word('ember')]});assert.ok(normal.metrics);assert.ok(normal.metrics.after.runeActivations>0);assert.equal(normal.metrics.before.runeActivations,0);assert.equal(normal.reference.profile,'prudent');assert.equal(normal.reference.echoRank,1);
 const equivalent=sim.evaluate({before:strong,after:strong,context,beforeWords:[word('ember')],afterWords:[word('ember')]});assert.equal(equivalent.reason,'equivalent');assert.equal(equivalent.metrics,null);
});
const stats={health:1000,attack:100,defense:0,magic_damage:0,speed:0,accuracy:100,critical:0,critical_damage:150,life_steal:0,dodge:0,block:0,damage_reduction:0,regeneration:0,thorns:0},enemy={health:10000,attack:100,defense:0,heavyEvery:3},word=id=>WORDS.find(w=>w.id===id);
const turn=(words,overrides={})=>{const buffs=overrides.buffs||{runic:snapshot(words.map(word))};return {result:combatTurn({stats,hp:1000,enemy,enemyHp:10000,round:0,buffs,action:'attack',rng:()=>.5,log:[],...overrides}),buffs};};
test('rune charge counts attack actions, never double hits or misses; the report records only actual added damage',()=>{
 const buffs={runic:snapshot([word('ember')])};for(let round=0;round<3;round++)turn([],{buffs,round,stats:{...stats,speed:100}});assert.equal(buffs.runic.attacks,3);assert.equal(buffs.runic.summary.ember.activations,1);assert.equal(buffs.runic.summary.ember.damage,50);
 const missed={runic:snapshot([word('ember')])};turn([],{buffs:missed,stats:{...stats,accuracy:0}});assert.equal(missed.runic.attacks,0);
 const finish={runic:snapshot([word('ember')])};finish.runic.attacks=2;turn([],{buffs:finish,enemyHp:10});assert.equal(finish.runic.summary.ember.activations,1);assert.equal(finish.runic.summary.ember.damage,0);
 assert.match(summaries(missed,'won')[0].inactiveReason,/tre attacchi/);
});
test('counter, exposure, execution, first strike and wounded triggers use the current tactical state',()=>{
 for(const [id,overrides,expected]of [['revenge',{action:'defend'},0],['hunter',{round:3},25],['execution',{enemyHp:2000},20],['star',{enemy:{...enemy,defense:100}},30],['resolve',{hp:400},18]]){
  const {buffs}=turn([id],overrides);assert.equal(buffs.runic.summary[id].damage,expected,id);
 }
 const buffs={runic:snapshot([word('revenge')])};turn([],{buffs,action:'defend'});turn([],{buffs,round:1});assert.equal(buffs.runic.summary.revenge.damage,35);turn([],{buffs,round:2});assert.equal(buffs.runic.summary.revenge.activations,1);
});
test('fracture and oak activate on the third successful attack, including their effective damage and healing',()=>{
 const buffs={runic:snapshot([word('fracture'),word('oak')])};for(let round=0;round<3;round++)turn([],{buffs,hp:500,round,enemy:{...enemy,defense:100}});assert.equal(buffs.runic.summary.fracture.damage,21);assert.equal(buffs.runic.summary.fracture.activations,1);assert.equal(buffs.runic.summary.oak.healing,25);assert.equal(buffs.runic.summary.oak.activations,1);
});
test('barriers expire after the protected turn, emergency fires once, and enduring requires three hurt turns',()=>{
 let {result,buffs}=turn(['vigil'],{action:'defend'});assert.equal(result.hp,1000);assert.equal(buffs.runic.summary.vigil.absorbed,40);assert.equal(buffs.runic.shield,0);
 ({result,buffs}=turn(['beacon'],{hp:350}));assert.equal(result.hp,250);assert.equal(buffs.runic.shield,120);let next=turn([],{buffs,hp:250,round:1});assert.equal(next.result.hp,250);assert.equal(buffs.runic.summary.beacon.absorbed,100);assert.equal(buffs.runic.summary.beacon.activations,1);assert.equal(buffs.runic.shield,0);
 const endured={runic:snapshot([word('aegis')])};for(let round=0;round<3;round++)turn([],{buffs:endured,round});assert.equal(endured.runic.shield,60);turn([],{buffs:endured,round:3});assert.equal(endured.runic.summary.aegis.absorbed,60);
});
test('ward reports exact rounded damage saved, respects the protection cap and does not activate on a dodge',()=>{
 const plain=turn([],{round:2,stats:{...stats,damage_reduction:75}}).result,ward=turn(['dusk'],{round:2,stats:{...stats,damage_reduction:75}});assert.equal(ward.buffs.runic.summary.dusk.absorbed,ward.result.hp-plain.hp);assert.ok(ward.buffs.runic.summary.dusk.absorbed>0);
 const capped=turn(['dusk'],{round:2,stats:{...stats,damage_reduction:80}});assert.equal(capped.buffs.runic.summary.dusk.absorbed,0);const dodge=turn(['dusk'],{round:2,stats:{...stats,dodge:100}});assert.equal(dodge.buffs.runic.summary.dusk.activations,0);
});
test('healing records effective HP, respects wounds and three-turn cooldowns, and never resurrects',()=>{
 const buffs={runic:snapshot([word('return')])};let r=turn([],{buffs,hp:500,action:'defend'});assert.equal(r.result.hp,490);assert.equal(buffs.runic.summary.return.healing,30);turn([],{buffs,hp:500,action:'defend',round:1});turn([],{buffs,hp:500,action:'defend',round:3});assert.equal(buffs.runic.summary.return.healing,60);
 const wounded=turn(['siphon'],{hp:500,stats:{...stats,critical:100},buffs:{woundTurns:2,runic:snapshot([word('siphon')])}});assert.equal(wounded.buffs.runic.summary.siphon.healing,21);
 const dead=turn(['return'],{hp:1,action:'defend'});assert.equal(dead.result.status,'lost');assert.equal(dead.buffs.runic.summary.return.healing,0);
 const full=turn(['siphon'],{stats:{...stats,critical:100},enemyHp:1});assert.equal(full.buffs.runic.summary.siphon.healing,0);assert.match(summaries(full.buffs,'won')[0].inactiveReason,/Non servivano cure/);assert.equal(full.buffs.runic.ready.siphon,undefined);
});
test('purification removes both ailments before poison ticks, respects cooldown, and prudent chooses it explicitly',()=>{
 const buffs={autoProfile:'prudent',poison:3,woundTurns:2,runic:snapshot([word('purity')])};assert.equal(autoAction({enemy,round:0,buffs,hp:500,stats}),'defend');turn([],{buffs,hp:500,action:'defend'});assert.equal(buffs.poison,0);assert.equal(buffs.woundTurns,0);assert.equal(buffs.runic.summary.purity.cleanses,1);buffs.poison=3;turn([],{buffs,hp:500,round:1,action:'defend'});assert.equal(buffs.poison,2);assert.equal(buffs.runic.summary.purity.activations,1);
});
test('reflection respects the Beacon seal even when thorns break it in the same turn',()=>{
 const beacon={...enemy,mechanic:'lantern-v1',health:100};const first=turn(['mirror'],{enemy:beacon,enemyHp:60,action:'defend',stats:{...stats,block:100,attack:100}});assert.equal(first.result.enemyHp,50);assert.equal(first.buffs.watchPhase,2);assert.equal(first.buffs.watchTurn,0);assert.equal(first.buffs.runic.summary.mirror.damage,10);
 const both=turn(['mirror'],{enemy:beacon,enemyHp:60,action:'defend',stats:{...stats,block:100,thorns:500}});assert.equal(both.result.enemyHp,50);assert.equal(both.buffs.runic.summary.mirror.damage,0);
});
test('echo patterns are deterministic, telegraphed, independent of gear, and wounds last for the two following turns',()=>{
 const e=echoEnemy(enemy,2);assert.equal(e.health,90000);assert.deepEqual([0,1,2,3].map(round=>intentFor(e,round).kind),['gather','dawn','exposed','attack']);assert.deepEqual([0,1,2].map(round=>intentFor(echoEnemy(enemy,1),round).kind),['guard','strike','exposed']);
 const buffs={autoProfile:'prudent'};assert.equal(autoAction({enemy:e,round:1,buffs,hp:1000,stats}),'defend');assert.equal(buffs.autoDecisions.defends,1);assert.equal(autoAction({enemy:e,round:0,buffs,hp:1000,stats}),'attack');assert.equal(autoAction({enemy:e,round:1,buffs:{},hp:1000,stats}),'attack');
 turn([],{enemy:e,buffs,round:1});assert.equal(buffs.woundTurns,2);turn([],{enemy:e,buffs,round:2});assert.equal(buffs.woundTurns,1);turn([],{enemy:e,buffs,round:3});assert.equal(buffs.woundTurns,0);
});
