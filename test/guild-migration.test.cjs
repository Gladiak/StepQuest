'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{gunzipSync}=require('node:zlib'),{DatabaseSync}=require('node:sqlite');
const {createGameRepository}=require('../lib/game-repository.cjs'),{prepareSave}=require('../lib/save-protection.cjs');
const {fixtures}=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/v1.1-save-fixture.json.gz'))));
for(const fixture of fixtures)test(`v1.1.0 → Gilda: ${fixture.scenario}, backup e tutti i record originali conservati`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-guild-migration-')),file=path.join(dir,'save.sqlite');let db=new DatabaseSync(file),game;
 t.after(()=>{game?.close();db?.close();fs.rmSync(dir,{recursive:true,force:true});});
 db.exec('PRAGMA foreign_keys=OFF;BEGIN');for(const sql of fixture.schema)db.exec(sql);for(const table of fixture.tables)for(const row of table.rows){const columns=Object.keys(row);db.prepare(`INSERT INTO ${table.name}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...Object.values(row));}db.exec('COMMIT');db.close();db=null;
 const backup=prepareSave(file,{version:'1.2.0'});assert.ok(backup);game=createGameRepository(file,{rng:()=>.5,today:()=> '2026-10-30',now:()=>Date.parse('2026-10-30T12:00:00Z')});const state=game.state(fixture.heroId);assert.equal(state.guild.contracts.length,6);assert.equal(state.guild.journal.length,0);assert.equal(state.atlas.nodes.length,10);assert.equal(state.atlas.chapters,0);assert.equal(state.atlas.wardenDefeated,false);assert.ok(state.mine.job);if(fixture.scenario==='arena')assert.equal(state.arena.session.status,'active');
 db=new DatabaseSync(file);for(const table of fixture.tables)assert.deepEqual(db.prepare(`SELECT * FROM ${table.name} ORDER BY rowid`).all().map(r=>({...r})),table.rows,table.name);assert.equal(prepareSave(file),null);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(Object.values(db.prepare('PRAGMA integrity_check').get())[0],'ok');
});
