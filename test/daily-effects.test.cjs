'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {normalizeWellness,effectsFor}=require('../lib/daily-effects.cjs');
const {createStepsRepository,scopeForKey}=require('../lib/steps-repository.cjs');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
const {generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
const scope=scopeForKey('wellness-test'),date='2026-10-29',at='2026-10-29T12:00:00Z';
const metrics=(extra={})=>({date,fetchedAt:at,moderate:30,vigorous:15,sleepScore:85,sleepSeconds:28000,stress:70,stressDate:'2026-10-28',...extra});
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-daily-')),file=path.join(dir,'game.sqlite'),steps=createStepsRepository(file),chars=createCharactersRepository(file),sql=new DatabaseSync(file);let day=date,game=createGameRepository(file,{rng:()=>.5,today:()=>day,now:()=>Date.parse(at)});const hero=chars.create({name:'Thorin',classId:'guardian',sex:'male'});steps.activate(scope);sql.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id);game.state(hero.id);t.after(()=>{game.close();sql.close();chars.close();steps.close();fs.rmSync(dir,{force:true,recursive:true});});return {hero,sql,chars,steps,get game(){return game;},setDay:d=>{day=d;},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5,today:()=>day,now:()=>Date.parse(at)});}};}
test('normalizzazione: date, unità e copertura; notte non confermata e sentinel restano neutri',()=>{
 const summary={data:[{calendarDate:date,intensityMinutes:{moderate:15,vigorous:10}},{calendarDate:'2026-10-28',stress:{avgLevel:70,restDurationInMillis:21600000}}]};
 const sleep={calendarDate:date,sleepWindowConfirmed:true,sleepScores:{overall:{value:45}},sleepTimeSeconds:15000};
 const m=normalizeWellness(date,summary,sleep,at);assert.equal(m.stress,70);assert.equal(m.sleepScore,45);assert.deepEqual(effectsFor(m),{xpPercent:10,healingPercent:-3,attackPercent:-2,relieved:false});
 assert.equal(normalizeWellness(date,summary,{...sleep,sleepWindowConfirmed:false},at).sleepScore,null);
 summary.data[1].stress.restDurationInMillis=1000;summary.data[0].intensityMinutes.moderate=-1;
 const partial=normalizeWellness(date,summary,sleep,at);assert.equal(partial.stress,null);assert.equal(effectsFor(partial).xpPercent,0);
 assert.deepEqual(effectsFor(null),{xpPercent:0,healingPercent:0,attackPercent:0,relieved:false});
});
test('limiti e ripetizione: massimo15% XP, malus3+2%; nessuna somma fra import',t=>{
 const f=fixture(t);f.game.saveDailyWellness(scope,metrics({moderate:1440,vigorous:1440,sleepScore:20}));let d=f.game.state(f.hero.id).dailyCondition;
 assert.equal(d.effects.xpPercent,15);assert.equal(d.effects.healingPercent,-3);assert.equal(d.effects.attackPercent,-2);
 f.game.saveDailyWellness(scope,metrics({moderate:1440,vigorous:1440,sleepScore:20}));assert.deepEqual(f.game.state(f.hero.id).dailyCondition,d);
 f.reopen();assert.deepEqual(f.game.state(f.hero.id).dailyCondition,d);
});
test('combattimento: snapshot stabile dopo reimport, riapertura e cambio giorno; bonus XP assegnato una volta',t=>{
 const f=fixture(t);f.game.saveDailyWellness(scope,metrics({stress:null}));let s=f.game.startBattle(f.hero.id,'normal');assert.equal(s.battle.buffs.dailyEffects.xpPercent,15);
 f.game.saveDailyWellness(scope,metrics({moderate:0,vigorous:0,sleepScore:null,stress:null}));f.reopen();f.setDay('2026-10-30');
 s=f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0});assert.equal(s.battle.status,'won');assert.equal(s.battle.rewards.xp,40);assert.equal(s.hero.xp,40);
 assert.equal(s.dailyCondition.effects.xpPercent,0);assert.deepEqual(f.game.autoBattle(f.hero.id,{battleId:s.battle.id,round:0}),s);
});
test('cure: bonus sonno effettivo; cibo e riposo eliminano malus senza cambiare altri eroi',t=>{
 const f=fixture(t);f.game.saveDailyWellness(scope,metrics());const food=generateItem(C.TEMPLATES.find(x=>x.id==='food-0'));insertItem(f.sql,f.hero.id,food);f.sql.prepare('UPDATE hero_progress SET hp=50 WHERE character_id=?').run(f.hero.id);
 let s=f.game.useItem(f.hero.id,food.id);assert.equal(s.hero.hp,78);assert.equal(s.dailyCondition.effects.attackPercent,0);
 f.game.saveDailyWellness(scope,metrics({sleepScore:20}));assert.equal(f.game.state(f.hero.id).dailyCondition.effects.healingPercent,0);
 const other=f.chars.create({name:'Elara',classId:'arcanist',sex:'female'});assert.equal(f.game.state(other.id).dailyCondition.effects.healingPercent,-3);
 f.sql.prepare('UPDATE hero_progress SET hp=30 WHERE character_id=?').run(other.id);f.sql.prepare('UPDATE characters SET coins=1000 WHERE id=?').run(other.id);s=f.game.rest(other.id);assert.equal(s.dailyCondition.effects.attackPercent,0);
});
test('isolamento account, snapshot precedenti e misure invalide',t=>{
 const f=fixture(t);f.game.saveDailyWellness(scope,metrics());f.game.saveDailyWellness(scope,metrics({fetchedAt:'2026-10-29T11:00:00Z',moderate:0,vigorous:0}));assert.equal(f.game.state(f.hero.id).dailyCondition.effects.xpPercent,15);
 assert.throws(()=>f.game.saveDailyWellness(scope,metrics({stress:-1})));
 f.steps.activate(scopeForKey('other-account'));assert.equal(f.game.state(f.hero.id).dailyCondition.metrics,null);
});
