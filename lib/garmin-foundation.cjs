'use strict';
const {createHash}=require('node:crypto');
const {dateRange}=require('./dates.cjs');
const hashIdentity=id=>createHash('sha256').update('stepquest:garmin-account:v1:'+id).digest('hex');
function createGarminFoundation(db){
 db.exec('CREATE TABLE IF NOT EXISTS garmin_foundation_migrations(version INTEGER PRIMARY KEY) STRICT');
 const version=db.prepare('SELECT max(version) v FROM garmin_foundation_migrations').get().v||0;
 if(version>1)throw new Error('Versione archivio Garmin non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE garmin_accounts(identity_hash TEXT PRIMARY KEY,scope_id TEXT NOT NULL UNIQUE) STRICT;
 CREATE TABLE garmin_connections(key_scope TEXT PRIMARY KEY,scope_id TEXT NOT NULL) STRICT;
 CREATE TABLE garmin_activities(scope_id TEXT NOT NULL,activity_id TEXT NOT NULL,calendar_date TEXT NOT NULL,started_at INTEGER NOT NULL,ended_at INTEGER NOT NULL,kind TEXT NOT NULL,duration_seconds REAL NOT NULL,distance_meters REAL,elevation_meters REAL,fetched_at TEXT NOT NULL,PRIMARY KEY(scope_id,activity_id)) STRICT;
 CREATE INDEX garmin_activity_dates ON garmin_activities(scope_id,calendar_date,started_at);
 CREATE TABLE garmin_activity_sync(scope_id TEXT PRIMARY KEY,attempted_at TEXT NOT NULL,succeeded_at TEXT,state TEXT NOT NULL,error_code TEXT) STRICT;
 INSERT INTO garmin_foundation_migrations VALUES(1);COMMIT;`);
 const exists=name=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
 const resolve=keyScope=>db.prepare('SELECT scope_id FROM garmin_connections WHERE key_scope=?').get(keyScope)?.scope_id||keyScope;
 function merge(source,target){
  if(source===target)return;
  // Legacy records remain archived under their original scope. Only verified
  // aliases share current snapshots and high-water marks; wallets are untouched.
  db.prepare(`INSERT INTO daily_steps SELECT ?,calendar_date,steps,goal,distance_meters,availability,fetched_at,revision FROM daily_steps WHERE scope_id=?
   ON CONFLICT(scope_id,calendar_date) DO UPDATE SET steps=excluded.steps,goal=excluded.goal,distance_meters=excluded.distance_meters,availability=excluded.availability,fetched_at=excluded.fetched_at,revision=max(daily_steps.revision,excluded.revision) WHERE excluded.fetched_at>daily_steps.fetched_at`).run(target,source);
  if(exists('hero_step_claims'))db.prepare(`INSERT INTO hero_step_claims SELECT character_id,?,calendar_date,credited_steps FROM hero_step_claims WHERE scope_id=?
   ON CONFLICT(character_id,scope_id,calendar_date) DO UPDATE SET credited_steps=max(hero_step_claims.credited_steps,excluded.credited_steps)`).run(target,source);
  if(exists('daily_wellness'))db.prepare(`INSERT INTO daily_wellness SELECT ?,calendar_date,payload,fetched_at FROM daily_wellness WHERE scope_id=?
   ON CONFLICT(scope_id,calendar_date) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at WHERE excluded.fetched_at>daily_wellness.fetched_at`).run(target,source);
  if(exists('guild_contracts'))db.prepare('UPDATE guild_contracts SET scope_id=? WHERE scope_id=?').run(target,source);
  db.prepare('UPDATE garmin_connections SET scope_id=? WHERE scope_id=?').run(target,source);
 }
 function bind(keyScope,identity,at){
  if(typeof keyScope!=='string'||!/^[a-f0-9]{64}$/.test(keyScope)||typeof identity!=='string'||!/^\d{1,16}$/.test(identity)||!Number.isFinite(Date.parse(at)))throw new Error('Identità Garmin non valida.');
  const identityHash=hashIdentity(identity);
  db.exec('BEGIN IMMEDIATE');try{
   const previous=resolve(keyScope),owner=db.prepare('SELECT identity_hash FROM garmin_accounts WHERE scope_id=?').get(previous);
   if(owner&&owner.identity_hash!==identityHash)throw new Error('La connessione Garmin appartiene a un altro account.');
   const scope=db.prepare('SELECT scope_id FROM garmin_accounts WHERE identity_hash=?').get(identityHash)?.scope_id||previous;
   db.prepare('INSERT OR IGNORE INTO source_scopes VALUES(?,?)').run(scope,at);
   merge(previous,scope);
   db.prepare('INSERT OR IGNORE INTO garmin_accounts VALUES(?,?)').run(identityHash,scope);
   db.prepare('INSERT INTO garmin_connections VALUES(?,?) ON CONFLICT(key_scope) DO UPDATE SET scope_id=excluded.scope_id').run(keyScope,scope);
   db.exec('COMMIT');return scope;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function saveActivities(scope,result){
  dateRange(result.from,result.to,7);
  if(!/^[a-f0-9]{64}$/.test(scope)||!Array.isArray(result.activities)||!Number.isFinite(Date.parse(result.fetchedAt)))throw new Error('Attività Garmin non valide.');
  db.exec('BEGIN IMMEDIATE');try{
   const previous=db.prepare('SELECT succeeded_at FROM garmin_activity_sync WHERE scope_id=?').get(scope);
   if(previous?.succeeded_at>result.fetchedAt){db.exec('COMMIT');return;}
   db.prepare('DELETE FROM garmin_activities WHERE scope_id=? AND calendar_date BETWEEN ? AND ? AND fetched_at<=?').run(scope,result.from,result.to,result.fetchedAt);
   for(const a of result.activities){
    if(!/^\d{1,16}$/.test(a.id)||a.date<result.from||a.date>result.to||!Number.isFinite(a.startedAt)||!Number.isFinite(a.endedAt)||a.endedAt<a.startedAt||!['walk','run','cycle','swim','other'].includes(a.kind)||!Number.isFinite(a.durationSeconds)||a.durationSeconds<0||a.durationSeconds>86400||![a.distanceMeters,a.elevationMeters].every(v=>v===null||Number.isFinite(v)&&v>=0))throw new Error('Attività Garmin non valida.');
    db.prepare(`INSERT INTO garmin_activities VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scope_id,activity_id) DO UPDATE SET calendar_date=excluded.calendar_date,started_at=excluded.started_at,ended_at=excluded.ended_at,kind=excluded.kind,duration_seconds=excluded.duration_seconds,distance_meters=excluded.distance_meters,elevation_meters=excluded.elevation_meters,fetched_at=excluded.fetched_at WHERE excluded.fetched_at>=garmin_activities.fetched_at`).run(scope,a.id,a.date,a.startedAt,a.endedAt,a.kind,a.durationSeconds,a.distanceMeters,a.elevationMeters,result.fetchedAt);
   }
   db.prepare(`INSERT INTO garmin_activity_sync VALUES(?,?,?,'online',NULL) ON CONFLICT(scope_id) DO UPDATE SET attempted_at=excluded.attempted_at,succeeded_at=excluded.succeeded_at,state='online',error_code=NULL`).run(scope,result.fetchedAt,result.fetchedAt);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function failed(scope,state,at,code){if(!scope)return;db.prepare(`INSERT INTO garmin_activity_sync VALUES(?,?,NULL,?,?) ON CONFLICT(scope_id) DO UPDATE SET attempted_at=excluded.attempted_at,state=excluded.state,error_code=excluded.error_code`).run(scope,at,state,/^[A-Z_]{1,40}$/.test(code||'')?code:'UNAVAILABLE');}
 return {resolve,bind,saveActivities,failed,isVerified:scope=>!!db.prepare('SELECT 1 FROM garmin_accounts WHERE scope_id=?').get(scope)};
}
module.exports={createGarminFoundation,hashIdentity};
