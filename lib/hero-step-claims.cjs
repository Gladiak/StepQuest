'use strict';
function migrateHeroStepClaims(db){
 db.exec('CREATE TABLE IF NOT EXISTS hero_steps_migrations(version INTEGER PRIMARY KEY) STRICT;');
 const version=db.prepare('SELECT max(version) version FROM hero_steps_migrations').get().version||0;
 if(version>1)throw new Error('Versione passi per personaggio non supportata.');
 if(version)return;
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(`CREATE TABLE hero_step_claims(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,scope_id TEXT NOT NULL,calendar_date TEXT NOT NULL,credited_steps INTEGER NOT NULL CHECK(credited_steps>=0),PRIMARY KEY(character_id,scope_id,calendar_date)) STRICT;
   INSERT INTO hero_step_claims
   SELECT w.character_id,c.scope_id,c.calendar_date,min(c.credited_steps,sum(w.steps_delta))
   FROM step_claims c JOIN wallet_events w ON w.kind='steps_claim' AND w.steps_delta>0 AND date(w.created_at,'localtime')=c.calendar_date
   GROUP BY w.character_id,c.scope_id,c.calendar_date;
   INSERT OR IGNORE INTO hero_step_claims
   SELECT DISTINCT w.character_id,c.scope_id,c.calendar_date,c.credited_steps
   FROM step_claims c JOIN wallet_events w ON w.kind='steps_claim' AND w.steps_delta>0
   WHERE NOT EXISTS(SELECT 1 FROM wallet_events dated WHERE dated.kind='steps_claim' AND dated.steps_delta>0 AND date(dated.created_at,'localtime')=c.calendar_date);
   INSERT INTO hero_steps_migrations VALUES(1);`);
  // Legacy claims do not record an owner or source per wallet event. When a day's
  // ownership cannot be dated, previous recipients retain its old ceiling to avoid
  // crediting spent steps again. Existing balances and legacy rows are never changed.
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
module.exports={migrateHeroStepClaims};
