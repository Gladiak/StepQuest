'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{gunzipSync}=require('node:zlib'),{DatabaseSync}=require('node:sqlite');
const {createGameRepository}=require('../lib/game-repository.cjs'),{prepareSave}=require('../lib/save-protection.cjs');
const {fixtures}=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/v1-save-fixture.json.gz'))));
function migratedRows(table){if(table.name==='game_migrations')return [...table.rows,{version:10}];if(table.name==='item_templates')return table.rows.map(row=>({...row,category:['ring','amulet'].includes(row.slot)?'accessories':row.slot==='food'?'food':row.category}));return table.rows;}
for(const fixture of fixtures)test(`release: migrazione reale da v1.0.0, stato ${fixture.scenario}, backup verificato e righe originali conservate`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-release-migration-')),file=path.join(dir,'save.sqlite');let db=new DatabaseSync(file),game;
 t.after(()=>{game?.close();db?.close();fs.rmSync(dir,{recursive:true,force:true});});
 db.exec('PRAGMA foreign_keys=OFF;BEGIN');for(const sql of fixture.schema)db.exec(sql);for(const table of fixture.tables)for(const row of table.rows){const columns=Object.keys(row),query=`INSERT INTO ${table.name}(${columns.map(k=>'"'+k+'"').join(',')}) VALUES(${columns.map(()=>'?').join(',')})`;db.prepare(query).run(...Object.values(row));}db.exec('COMMIT;PRAGMA foreign_keys=ON');db.close();db=null;
 const backup=prepareSave(file);assert.ok(backup);game=createGameRepository(file,{rng:()=>.5});const state=game.state(fixture.heroId);assert.equal(state.mine.level,1);assert.equal(state.smith.level,1);db=new DatabaseSync(file);for(const table of fixture.tables)assert.deepEqual(db.prepare(`SELECT * FROM ${table.name} ORDER BY rowid`).all().map(r=>({...r})),migratedRows(table),table.name);assert.equal(Object.values(db.prepare('PRAGMA integrity_check').get())[0],'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(prepareSave(file),null);
 const copied=new DatabaseSync(backup,{readOnly:true});try{for(const table of fixture.tables)assert.deepEqual(copied.prepare(`SELECT * FROM ${table.name} ORDER BY rowid`).all().map(r=>({...r})),table.rows);}finally{copied.close();}
});
