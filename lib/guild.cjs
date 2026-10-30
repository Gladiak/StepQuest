'use strict';
const {randomUUID}=require('node:crypto');
const {validDate,shiftDate}=require('./dates.cjs');
const {CONTRACTS,STORIES}=require('./guild-catalog.cjs');
function weekOf(day){const weekday=new Date(validDate(day)+'T12:00:00Z').getUTCDay();return shiftDate(day,-((weekday+6)%7));}
function createGuild({db,today,now,outsideBattle,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS guild_migrations(version INTEGER PRIMARY KEY) STRICT');
 const version=db.prepare('SELECT max(version) v FROM guild_migrations').get().v||0;
 if(version>1)throw new Error('Versione Gilda non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE guild_contracts(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,scope_id TEXT NOT NULL,quest_id TEXT NOT NULL,accepted_at INTEGER NOT NULL,accepted_day TEXT NOT NULL,accepted_week TEXT NOT NULL,baseline_steps INTEGER,status TEXT NOT NULL CHECK(status IN ('active','claimed','abandoned')),progress_steps INTEGER NOT NULL DEFAULT 0,choice INTEGER,claimed_at INTEGER) STRICT;
 CREATE UNIQUE INDEX one_guild_contract ON guild_contracts(character_id) WHERE status='active';
 CREATE UNIQUE INDEX guild_completed_story ON guild_contracts(character_id,quest_id) WHERE status='claimed';
 CREATE INDEX guild_owner ON guild_contracts(character_id,accepted_week);
 CREATE TABLE guild_activity_claims(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,scope_id TEXT NOT NULL,activity_id TEXT NOT NULL,contract_id TEXT NOT NULL REFERENCES guild_contracts(id) ON DELETE CASCADE,PRIMARY KEY(character_id,scope_id,activity_id)) STRICT;
 CREATE TABLE guild_profiles(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,title_id TEXT) STRICT;
 INSERT INTO guild_migrations VALUES(1);COMMIT;`);
 const exists=name=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE name=? AND type='table'").get(name);
 const scope=()=>exists('app_state')?db.prepare("SELECT value FROM app_state WHERE name='active_scope'").get()?.value||null:null;
 const active=id=>db.prepare("SELECT * FROM guild_contracts WHERE character_id=? AND status='active'").get(id);
 function dailySteps(source,from,to){
  if(!exists('daily_steps'))return [];
  // Revisions retain per-day high-water marks through downward corrections.
  return db.prepare(`SELECT calendar_date,max(steps) steps FROM (
   SELECT calendar_date,steps FROM daily_steps WHERE scope_id IN (SELECT key_scope FROM garmin_connections WHERE scope_id=? UNION SELECT ?) AND calendar_date BETWEEN ? AND ?
   UNION ALL SELECT calendar_date,steps FROM step_revisions WHERE scope_id IN (SELECT key_scope FROM garmin_connections WHERE scope_id=? UNION SELECT ?) AND calendar_date BETWEEN ? AND ?
  ) GROUP BY calendar_date`).all(source,source,from,to,source,source,from,to);
 }
 function progress(row){
  const quest=CONTRACTS.find(q=>q.id===row.quest_id),day=today();
  let steps=dailySteps(row.scope_id,row.accepted_day,day).reduce((sum,d)=>sum+(d.calendar_date===row.accepted_day?(row.baseline_steps===null?0:Math.max(0,(d.steps||0)-row.baseline_steps)):(d.steps||0)),0);
  steps=Math.min(quest.steps,Math.max(row.progress_steps,steps));
  if(steps!==row.progress_steps)db.prepare('UPDATE guild_contracts SET progress_steps=? WHERE id=?').run(steps,row.id);
  const activities=db.prepare(`SELECT a.* FROM garmin_activities a WHERE a.scope_id=? AND a.started_at>=? AND a.ended_at<=? AND a.calendar_date<=?
   AND NOT EXISTS(SELECT 1 FROM guild_activity_claims c WHERE c.character_id=? AND c.scope_id=a.scope_id AND c.activity_id=a.activity_id) ORDER BY a.started_at,a.activity_id`).all(row.scope_id,row.accepted_at,now(),day,row.character_id);
  const candidates=activities.filter(a=>quest.kinds.includes(a.kind)),best=candidates.reduce((seconds,a)=>Math.max(seconds,a.duration_seconds),0),matched=candidates.find(a=>a.duration_seconds>=quest.minutes*60);
  const sameAccount=scope()===row.scope_id;
  return {id:row.id,questId:row.quest_id,acceptedDay:row.accepted_day,baselineAvailable:row.baseline_steps!==null,steps,stepTarget:quest.steps,minutes:Math.min(quest.minutes,Math.floor(best/60)),minuteTarget:quest.minutes,ready:sameAccount&&(steps>=quest.steps||!!matched),sameAccount,activityId:matched?.activity_id||null};
 }
 function view(id){
  const day=today(),week=weekOf(day),source=scope(),rows=db.prepare("SELECT * FROM guild_contracts WHERE character_id=? AND status='claimed' ORDER BY claimed_at,id").all(id),completed=new Set(rows.map(r=>r.quest_id)),current=active(id);
  const used=db.prepare('SELECT count(*) n FROM guild_contracts WHERE character_id=? AND accepted_week=?').get(id,week).n;
  const sync=source?db.prepare('SELECT state,succeeded_at,attempted_at FROM garmin_activity_sync WHERE scope_id=?').get(source):null;
  const titles=STORIES.filter(story=>CONTRACTS.filter(q=>q.story===story.id).every(q=>completed.has(q.id))).map(story=>({id:story.id,name:story.title}));
  const atlasCatalog=require('./atlas-catalog.cjs');if(exists('atlas_milestones')&&atlasCatalog.NODES.filter(n=>n.questId).every(n=>completed.has(n.questId))&&db.prepare("SELECT 1 FROM atlas_milestones WHERE character_id=? AND milestone_id='warden'").get(id))titles.push(atlasCatalog.WARDEN_TITLE);
  if(exists('chronicle_awards'))for(const b of require('./chronicle-catalog.cjs').BADGES.filter(b=>b.titleReward))if(db.prepare('SELECT 1 FROM chronicle_awards WHERE character_id=? AND badge_id=?').get(id,b.id))titles.push(b.titleReward);
  return {day,week,nextWeek:shiftDate(week,7),connected:!!source,todayStepsAvailable:source?dailySteps(source,day,day)[0]?.steps!=null:false,identityVerified:source?!!db.prepare('SELECT 1 FROM garmin_accounts WHERE scope_id=?').get(source):false,weeklyLimit:3,weeklyUsed:used,sync:sync?{state:sync.state,lastSuccess:sync.succeeded_at,lastAttempt:sync.attempted_at}:{state:source?'not_synced':'not_connected',lastSuccess:null,lastAttempt:null},active:current?progress(current):null,titles,equippedTitle:db.prepare('SELECT title_id FROM guild_profiles WHERE character_id=?').get(id)?.title_id||null,
   contracts:CONTRACTS.map(q=>({...q,storyName:STORIES.find(s=>s.id===q.story).name,titleReward:q.requires?STORIES.find(s=>s.id===q.story).title:null,completed:completed.has(q.id),unlocked:!q.requires||completed.has(q.requires)})),journal:rows.map(row=>({questId:row.quest_id,choice:row.choice,claimedAt:row.claimed_at}))};
 }
 function accept(id,input){
  outsideBattle(id);const quest=CONTRACTS.find(q=>q.id===input?.questId),state=view(id),source=scope();
  if(!quest||!source)throw new GameError('Collega Garmin prima di accettare un incarico.');
  if(active(id)||state.weeklyUsed>=3||state.contracts.find(q=>q.id===quest.id).completed||!state.contracts.find(q=>q.id===quest.id).unlocked)throw new GameError('Incarico non disponibile.');
  const baseline=dailySteps(source,today(),today())[0]?.steps??null;
  db.prepare("INSERT INTO guild_contracts(id,character_id,scope_id,quest_id,accepted_at,accepted_day,accepted_week,baseline_steps,status) VALUES(?,?,?,?,?,?,?,?,'active')").run(randomUUID(),id,source,quest.id,now(),today(),weekOf(today()),baseline);
 }
 function claim(id,input){
  outsideBattle(id);if(typeof input?.id!=='string'||![0,1].includes(input.choice))throw new GameError('Scelta della Gilda non valida.');
  const row=db.prepare('SELECT * FROM guild_contracts WHERE id=? AND character_id=?').get(input.id,id);
  if(row?.status==='claimed'){if(row.choice!==input.choice)throw new GameError('La scelta è già stata salvata.');return;}
  if(!row||row.status!=='active')throw new GameError('Incarico non disponibile.');const state=progress(row);
  if(!state.ready)throw new GameError('Completa prima l’obiettivo dell’incarico.');
  if(state.activityId&&state.steps<state.stepTarget)db.prepare('INSERT INTO guild_activity_claims VALUES(?,?,?,?)').run(id,row.scope_id,state.activityId,row.id);
  db.prepare("UPDATE guild_contracts SET status='claimed',choice=?,claimed_at=? WHERE id=?").run(input.choice,now(),row.id);
  const quest=CONTRACTS.find(q=>q.id===row.quest_id);if(quest.requires)db.prepare('INSERT INTO guild_profiles VALUES(?,?) ON CONFLICT(character_id) DO NOTHING').run(id,quest.story);
 }
 function abandon(id,input){outsideBattle(id);const row=active(id);if(!row||row.id!==input?.id)throw new GameError('Incarico non disponibile.');db.prepare("UPDATE guild_contracts SET status='abandoned' WHERE id=?").run(row.id);}
 function equipTitle(id,input){outsideBattle(id);if(input?.titleId!==null&&!view(id).titles.some(t=>t.id===input?.titleId))throw new GameError('Titolo non disponibile.');db.prepare('INSERT INTO guild_profiles VALUES(?,?) ON CONFLICT(character_id) DO UPDATE SET title_id=excluded.title_id').run(id,input.titleId);}
 return {view,accept,claim,abandon,equipTitle,needsSync:id=>!!active(id)};
}
module.exports={createGuild,weekOf};
