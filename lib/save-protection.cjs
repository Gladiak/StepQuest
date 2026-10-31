'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const MIGRATIONS={character_migrations:1,game_migrations:10,hero_steps_migrations:1,alchemy_migrations:1,loot_filter_migrations:1,refinement_migrations:1,research_migrations:1,settlement_migrations:2,garmin_foundation_migrations:1,guild_migrations:1,atlas_migrations:1,chronicle_migrations:1,runic_migrations:1,merchant_migrations:1};
function checkDatabase(db){const rows=db.prepare('PRAGMA quick_check').all();if(rows.length!==1||Object.values(rows[0])[0]!=='ok')throw new Error('Il salvataggio non supera il controllo di integrità.');}
function snapshotDatabase(source,destination){
 const db=new DatabaseSync(source,{readOnly:true});
 try{checkDatabase(db);db.prepare('VACUUM INTO ?').run(destination);}finally{db.close();}
 fs.chmodSync(destination,0o600);const snapshot=new DatabaseSync(destination,{readOnly:true});try{checkDatabase(snapshot);}finally{snapshot.close();}return destination;
}
function prepareSave(filename,{version='1.1.0',now=Date.now}={}){
 if(!fs.existsSync(filename))return null;const db=new DatabaseSync(filename,{readOnly:true});let pending=false;
 try{checkDatabase(db);for(const [table,target]of Object.entries(MIGRATIONS)){const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);const current=exists?db.prepare(`SELECT max(version) version FROM ${table}`).get().version||0:0;if(current>target)throw new Error('Questo salvataggio richiede una versione più recente di StepQuest.');if(current<target)pending=true;}}finally{db.close();}
 if(!pending)return null;const directory=path.join(path.dirname(filename),'backups');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const stamp=new Date(now()).toISOString().replace(/[:.]/g,'-'),destination=path.join(directory,`stepquest-before-${version}-${stamp}-${randomUUID().slice(0,8)}.sqlite`);
 try{return snapshotDatabase(filename,destination);}catch(error){if(fs.existsSync(destination))fs.unlinkSync(destination);throw new Error('Impossibile creare il backup prima dell’aggiornamento. Il salvataggio non è stato modificato.',{cause:error});}
}
// Call only after closing every connection. The old database and its WAL files are
// retained together in quarantine, so a failed restore never destroys the original.
function restoreSave(filename,backup,{now=Date.now}={}){
 if(path.resolve(filename)===path.resolve(backup))throw new Error('Scegli un file di backup diverso dal salvataggio attivo.');
 const temporary=path.join(path.dirname(filename),`.stepquest-restore-${randomUUID()}.sqlite`),moved=[];
 try{
  const source=new DatabaseSync(backup,{readOnly:true});try{checkDatabase(source);if(!source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name IN ('characters','daily_steps')").get())throw new Error('Il file non è un salvataggio StepQuest.');}finally{source.close();}
  snapshotDatabase(backup,temporary);
  const archive=path.join(path.dirname(filename),`recovery-${new Date(now()).toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);fs.mkdirSync(archive,{mode:0o700});
  try{for(const suffix of ['','-wal','-shm']){const original=filename+suffix;if(fs.existsSync(original)){const target=path.join(archive,path.basename(original));fs.renameSync(original,target);moved.push([original,target]);}}fs.renameSync(temporary,filename);}catch(error){for(const [original,target]of moved.reverse())fs.renameSync(target,original);throw error;}
  return {filename,previousSave:archive};
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
module.exports={MIGRATIONS,prepareSave,restoreSave,snapshotDatabase};
