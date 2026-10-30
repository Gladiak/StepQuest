'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {createStepsRepository,scopeForKey}=require('../lib/steps-repository.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const {weekOf}=require('../lib/guild.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-guild-')),file=path.join(dir,'save.sqlite'),steps=createStepsRepository(file),chars=createCharactersRepository(file),sql=new DatabaseSync(file),scope=scopeForKey('guild-fixture');
 let clock=Date.parse('2026-10-30T10:00:00Z'),day='2026-10-30';steps.activate(scope);steps.bindIdentity(scope,'987654',new Date(clock).toISOString());let game=createGameRepository(file,{rng:()=>.5,now:()=>clock,today:()=>day});const hero=chars.create({name:'Elara',classId:'ranger',sex:'female'});game.state(hero.id);
 t.after(()=>{game.close();sql.close();chars.close();steps.close();fs.rmSync(dir,{recursive:true,force:true});});
 return {file,steps,chars,sql,scope,hero,get game(){return game;},at:()=>clock,advance:ms=>clock+=ms,setDay:d=>{day=d;clock=Date.parse(d+'T12:00:00Z');},reopen(){game.close();game=createGameRepository(file,{rng:()=>.5,now:()=>clock,today:()=>day});},save(value,date=day){steps.save(scope,{from:date,to:date,fetchedAt:new Date(clock).toISOString(),days:[{date,steps:value,goal:8000,distanceMeters:null}]});},activity(id='123',kind='walk',minutes=20){const startedAt=clock+1000;clock+=minutes*60000+2000;const a={id,date:day,startedAt,endedAt:clock-1000,kind,durationSeconds:minutes*60,distanceMeters:null,elevationMeters:null};steps.saveActivities(scope,{from:day,to:day,fetchedAt:new Date(clock).toISOString(),activities:[a]});return a;}};
}
test('Gilda: tre storie, sei incarichi, nessun premio economico e capitoli successivi vincolati',t=>{
 const f=fixture(t),s=f.game.state(f.hero.id);assert.equal(s.guild.contracts.length,6);assert.equal(s.guild.contracts.filter(q=>q.unlocked).length,3);assert.equal(s.guild.weeklyLimit,3);assert.equal(s.guild.identityVerified,true);
 assert.throws(()=>f.game.acceptGuild(f.hero.id,{questId:'caravan-return'}));assert.throws(()=>f.game.acceptGuild(f.hero.id,{questId:'invalid'}));
 f.steps.activate(scopeForKey('other'));const other=f.game.state(f.hero.id).guild;assert.equal(other.identityVerified,false);assert.equal(other.sync.state,'not_synced');
});
test('Gilda: passi successivi all’accettazione, revisioni al ribasso, riapertura e scelta idempotente',t=>{
 const f=fixture(t);f.save(1000);const before=f.game.state(f.hero.id);let s=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'}),id=s.guild.active.id;
 assert.equal(s.guild.active.steps,0);assert.throws(()=>f.game.claimGuild(f.hero.id,{id,choice:0}));f.advance(1000);f.save(2500);assert.equal(f.game.state(f.hero.id).guild.active.steps,1500);
 f.advance(1000);f.save(2000);f.reopen();assert.equal(f.game.state(f.hero.id).guild.active.steps,1500);f.advance(1000);f.save(3000);assert.equal(f.game.state(f.hero.id).guild.active.ready,true);
 s=f.game.claimGuild(f.hero.id,{id,choice:1});assert.equal(s.guild.journal.length,1);assert.equal(s.guild.contracts.find(q=>q.id==='caravan-return').unlocked,true);assert.equal(s.hero.steps,before.hero.steps);assert.equal(s.hero.coins,before.hero.coins);assert.equal(s.hero.xp,before.hero.xp);assert.deepEqual(s.inventory,before.inventory);
 assert.deepEqual(f.game.claimGuild(f.hero.id,{id,choice:1}),s);assert.throws(()=>f.game.claimGuild(f.hero.id,{id,choice:0}));assert.throws(()=>f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'}));
});
test('Gilda: senza baseline i passi già fatti oggi non vengono attribuiti; dati tardivi nei giorni successivi',t=>{
 const f=fixture(t);let s=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'});assert.equal(s.guild.active.baselineAvailable,false);f.save(8000);assert.equal(f.game.state(f.hero.id).guild.active.steps,0);
 f.setDay('2026-11-01');f.save(1100,'2026-10-31');f.save(900);assert.equal(f.game.state(f.hero.id).guild.active.steps,2000);assert.equal(f.game.state(f.hero.id).guild.active.ready,true);assert.equal(f.game.state(f.hero.id).hero.steps,0);
});
test('Gilda: una singola attività idonea, nessuna somma di sessioni brevi e premio persistente',t=>{
 const f=fixture(t);let s=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'}),id=s.guild.active.id;f.activity('10','walk',10);f.activity('11','walk',10);assert.equal(f.game.state(f.hero.id).guild.active.ready,false);f.activity('12','cycle',30);assert.equal(f.game.state(f.hero.id).guild.active.ready,false);
 f.activity('13','walk',20);s=f.game.state(f.hero.id);assert.equal(s.guild.active.ready,true);assert.equal(s.guild.active.activityId,'13');s=f.game.claimGuild(f.hero.id,{id,choice:0});assert.equal(f.sql.prepare('SELECT count(*) n FROM guild_activity_claims').get().n,1);f.reopen();assert.equal(f.game.state(f.hero.id).guild.journal[0].choice,0);
 s=f.game.acceptGuild(f.hero.id,{questId:'caravan-return'});assert.equal(s.guild.active.ready,false);
});
test('Gilda: attività anteriori, premi fra eroi e account separati',t=>{
 const f=fixture(t);f.activity('15');const a=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'});assert.equal(a.guild.active.ready,false);
 const other=f.chars.create({name:'Thorin',classId:'guardian',sex:'male'});const b=f.game.acceptGuild(other.id,{questId:'caravan-tracks'});f.activity('16');assert.equal(f.game.state(other.id).guild.active.ready,true);assert.throws(()=>f.game.claimGuild(other.id,{id:a.guild.active.id,choice:0}));
 f.steps.activate(scopeForKey('separate-account'));assert.equal(f.game.state(f.hero.id).guild.active.sameAccount,false);assert.throws(()=>f.game.claimGuild(f.hero.id,{id:a.guild.active.id,choice:0}));f.steps.activate(f.scope);f.game.claimGuild(f.hero.id,{id:a.guild.active.id,choice:0});f.game.claimGuild(other.id,{id:b.guild.active.id,choice:1});assert.equal(f.sql.prepare('SELECT count(*) n FROM guild_activity_claims WHERE activity_id=\'16\'').get().n,2);
});
test('Gilda: limite di tre accettazioni, abbandono senza rimborso e nessuna scadenza dell’incarico',t=>{
 const f=fixture(t);for(let i=0;i<3;i++){const s=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'});if(i<2)f.game.abandonGuild(f.hero.id,{id:s.guild.active.id});}
 const id=f.game.state(f.hero.id).guild.active.id;f.game.abandonGuild(f.hero.id,{id});assert.throws(()=>f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'}));f.setDay('2026-11-02');let s=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'});assert.equal(s.guild.weeklyUsed,1);f.setDay('2026-11-16');s=f.game.state(f.hero.id);assert.ok(s.guild.active);assert.equal(s.guild.weeklyUsed,0);assert.equal(weekOf('2026-11-01'),'2026-10-26');
});
test('Gilda: fine storia assegna un titolo cosmetico indossabile senza cambiare attributi',t=>{
 const f=fixture(t);f.save(0);const before=f.game.state(f.hero.id).hero.stats;
 for(const questId of ['caravan-tracks','caravan-return']){let s=f.game.acceptGuild(f.hero.id,{questId});f.activity(questId==='caravan-tracks'?'20':'21','walk',30);f.game.claimGuild(f.hero.id,{id:s.guild.active.id,choice:0});}
 let s=f.game.state(f.hero.id);assert.deepEqual(s.guild.titles,[{id:'caravan',name:'Custode delle lanterne'}]);assert.equal(s.guild.equippedTitle,'caravan');assert.deepEqual(s.hero.stats,before);assert.throws(()=>f.game.equipGuildTitle(f.hero.id,{titleId:'river'}));s=f.game.equipGuildTitle(f.hero.id,{titleId:null});assert.equal(s.guild.equippedTitle,null);f.reopen();assert.equal(f.game.state(f.hero.id).guild.equippedTitle,null);
});
test('Gilda: assegnazione del titolo e consumo attività sono atomici',t=>{
 const f=fixture(t);let s=f.game.acceptGuild(f.hero.id,{questId:'caravan-tracks'});f.activity('30','walk',30);f.game.claimGuild(f.hero.id,{id:s.guild.active.id,choice:0});s=f.game.acceptGuild(f.hero.id,{questId:'caravan-return'});f.activity('31','walk',30);
 f.sql.exec("CREATE TRIGGER reject_title BEFORE INSERT ON guild_profiles BEGIN SELECT RAISE(ABORT,'rollback'); END");assert.throws(()=>f.game.claimGuild(f.hero.id,{id:s.guild.active.id,choice:0}));assert.equal(f.game.state(f.hero.id).guild.active.ready,true);assert.equal(f.sql.prepare("SELECT count(*) n FROM guild_activity_claims WHERE activity_id='31'").get().n,0);assert.equal(f.game.state(f.hero.id).guild.journal.length,1);
});
