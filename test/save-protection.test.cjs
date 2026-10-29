'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {prepareSave,restoreSave,MIGRATIONS}=require('../lib/save-protection.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-save-safety-')),file=path.join(dir,'stepquest.sqlite');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,file};}
test('backup: include l’ultimo commit WAL mentre il database è aperto e verifica la copia',t=>{
 const {file}=fixture(t),db=new DatabaseSync(file);db.exec("PRAGMA journal_mode=WAL; CREATE TABLE characters(id TEXT);INSERT INTO characters VALUES('committed');");try{const backup=prepareSave(file),copy=new DatabaseSync(backup,{readOnly:true});try{assert.equal(copy.prepare('SELECT id FROM characters').get().id,'committed');assert.equal(Object.values(copy.prepare('PRAGMA integrity_check').get())[0],'ok');}finally{copy.close();}if(process.platform!=='win32')assert.equal(fs.statSync(backup).mode&0o777,0o600);}finally{db.close();}
});
test('backup: nessuna copia per nuova installazione o schema già aggiornato',t=>{
 const {file}=fixture(t);assert.equal(prepareSave(file),null);const db=new DatabaseSync(file);for(const [table,v]of Object.entries(MIGRATIONS)){db.exec(`CREATE TABLE ${table}(version INTEGER);INSERT INTO ${table} VALUES(${v})`);}db.close();assert.equal(prepareSave(file),null);
});
test('backup: versioni future e corruzione lasciano intatto l’originale',t=>{
 const {file}=fixture(t),db=new DatabaseSync(file);db.exec('CREATE TABLE game_migrations(version INTEGER);INSERT INTO game_migrations VALUES(999)');db.close();const before=fs.readFileSync(file);assert.throws(()=>prepareSave(file),/versione più recente/);assert.deepEqual(fs.readFileSync(file),before);fs.writeFileSync(file,'damaged sqlite file');assert.throws(()=>prepareSave(file));assert.equal(fs.readFileSync(file,'utf8'),'damaged sqlite file');
});
test('ripristino: verifica il backup e conserva il database precedente in quarantena',t=>{
 const {file}=fixture(t),db=new DatabaseSync(file);db.exec("CREATE TABLE characters(id TEXT);INSERT INTO characters VALUES('before')");const backup=prepareSave(file);db.exec("UPDATE characters SET id='after'");db.close();const result=restoreSave(file,backup),restored=new DatabaseSync(file,{readOnly:true}),previous=new DatabaseSync(path.join(result.previousSave,'stepquest.sqlite'),{readOnly:true});try{assert.equal(restored.prepare('SELECT id FROM characters').get().id,'before');assert.equal(previous.prepare('SELECT id FROM characters').get().id,'after');}finally{restored.close();previous.close();}
});
test('ripristino: backup invalido non tocca database né file WAL',t=>{
 const {file,dir}=fixture(t),bad=path.join(dir,'bad.sqlite');fs.writeFileSync(file,'original');fs.writeFileSync(file+'-wal','original wal');fs.writeFileSync(bad,'not a database');assert.throws(()=>restoreSave(file,bad));assert.equal(fs.readFileSync(file,'utf8'),'original');assert.equal(fs.readFileSync(file+'-wal','utf8'),'original wal');assert.throws(()=>restoreSave(file,file),/diverso/);
});
