'use strict';
const {validDate,shiftDate}=require('./dates.cjs');
const number=(v,max=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
function normalizeWellness(day,summary,sleep,fetchedAt){
 validDate(day);
 const rows=Array.isArray(summary?.data)?summary.data:[];
 const current=rows.find(r=>r?.calendarDate===day),previous=rows.find(r=>r?.calendarDate===shiftDate(day,-1));
 const night=sleep?.calendarDate===day&&sleep.sleepWindowConfirmed===true?sleep:null;
 const stress=previous?.stress,coverage=['restDurationInMillis','lowStressDurationInMillis','mediumStressDurationInMillis','highStressDurationInMillis'].map(k=>number(stress?.[k])||0).reduce((a,b)=>a+b,0);
 return {date:day,fetchedAt,moderate:number(current?.intensityMinutes?.moderate,1440),vigorous:number(current?.intensityMinutes?.vigorous,1440),sleepScore:number(night?.sleepScores?.overall?.value,100),sleepSeconds:number(night?.sleepTimeSeconds,86400),stress:coverage>=21600000?number(stress?.avgLevel,100):null,stressDate:shiftDate(day,-1)};
}
function effectsFor(metrics,relieved=false){
 const moderate=number(metrics?.moderate,1440),vigorous=number(metrics?.vigorous,1440),score=number(metrics?.sleepScore,100),stress=number(metrics?.stress,100);
 const minutes=moderate===null||vigorous===null?null:moderate+2*vigorous;
 return {xpPercent:minutes===null?0:Math.min(15,Math.floor(minutes/15)*5),healingPercent:score!==null&&score>=80?10:score!==null&&score<50&&!relieved?-3:0,attackPercent:stress!==null&&stress>=60&&!relieved?-2:0,relieved};
}
function createDailyEffectsStore(db,{today,now=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS wellness_migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS daily_wellness(scope_id TEXT NOT NULL,calendar_date TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),fetched_at TEXT NOT NULL,PRIMARY KEY(scope_id,calendar_date)) STRICT;
 CREATE TABLE IF NOT EXISTS daily_relief(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,calendar_date TEXT NOT NULL,PRIMARY KEY(character_id,calendar_date)) STRICT;
 INSERT OR IGNORE INTO wellness_migrations VALUES(1);`);
 function read(id){
  const day=today(),exists=db.prepare("SELECT 1 FROM sqlite_master WHERE name='app_state'").get();
  const scope=exists?db.prepare("SELECT value FROM app_state WHERE name='active_scope'").get()?.value:null;
  const row=scope?db.prepare('SELECT * FROM daily_wellness WHERE scope_id=? AND calendar_date=?').get(scope,day):null;
  const fresh=row&&now()-Date.parse(row.fetched_at)>=0&&now()-Date.parse(row.fetched_at)<=86400000;
  const metrics=fresh?JSON.parse(row.payload):null,relieved=!!db.prepare('SELECT 1 FROM daily_relief WHERE character_id=? AND calendar_date=?').get(id,day);
  return {date:day,fetchedAt:fresh?row.fetched_at:null,metrics,effects:effectsFor(metrics,relieved)};
 }
 function save(scope,m){
  if(typeof scope!=='string'||!/^[a-f0-9]{64}$/.test(scope)||m?.date!==today()||!Number.isFinite(Date.parse(m.fetchedAt))||Date.parse(m.fetchedAt)>now()+60000)throw new Error('Dati giornalieri non validi.');
  for(const k of ['moderate','vigorous','sleepScore','sleepSeconds','stress'])if(m[k]!==null&&number(m[k],k==='sleepScore'||k==='stress'?100:k==='sleepSeconds'?86400:1440)===null)throw new Error('Misura giornaliera non valida.');
  if(m.stressDate!==shiftDate(m.date,-1))throw new Error('Data stress non valida.');
  db.prepare('INSERT INTO daily_wellness VALUES(?,?,?,?) ON CONFLICT(scope_id,calendar_date) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at WHERE excluded.fetched_at>=daily_wellness.fetched_at').run(scope,m.date,JSON.stringify(m),m.fetchedAt);
 }
 const relieve=id=>db.prepare('INSERT OR IGNORE INTO daily_relief VALUES(?,?)').run(id,today());
 return {read,save,relieve};
}
module.exports={normalizeWellness,effectsFor,createDailyEffectsStore};
