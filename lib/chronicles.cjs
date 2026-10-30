'use strict';
const {BADGES,TOUR}=require('./chronicle-catalog.cjs');
const {NODES}=require('./atlas-catalog.cjs');
function createChronicles({db,today,now,outsideBattle,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS chronicle_migrations(version INTEGER PRIMARY KEY) STRICT');
 const version=db.prepare('SELECT max(version) v FROM chronicle_migrations').get().v||0;
 if(version>1)throw new Error('Versione Cronache non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE chronicle_profiles(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,started_at INTEGER NOT NULL,started_day TEXT NOT NULL,baseline INTEGER NOT NULL,tour_started INTEGER,tour_baseline INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE TABLE chronicle_days(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,day TEXT NOT NULL,steps INTEGER NOT NULL CHECK(steps>=0),PRIMARY KEY(character_id,day)) STRICT;
 CREATE TABLE chronicle_activities(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,activity_id TEXT NOT NULL,kind TEXT NOT NULL,day TEXT NOT NULL,recorded_at INTEGER NOT NULL,PRIMARY KEY(character_id,activity_id)) STRICT;
 CREATE TABLE chronicle_awards(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,badge_id TEXT NOT NULL,earned_at INTEGER NOT NULL,variant INTEGER,recovered INTEGER NOT NULL CHECK(recovered IN (0,1)),seen INTEGER NOT NULL DEFAULT 0 CHECK(seen IN (0,1)),PRIMARY KEY(character_id,badge_id)) STRICT;
 CREATE TABLE chronicle_display(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 2),badge_id TEXT NOT NULL,PRIMARY KEY(character_id,slot),UNIQUE(character_id,badge_id),FOREIGN KEY(character_id,badge_id) REFERENCES chronicle_awards(character_id,badge_id) ON DELETE CASCADE) STRICT;
 CREATE TABLE chronicle_tour(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,stop INTEGER NOT NULL CHECK(stop BETWEEN 0 AND 4),reached_at INTEGER NOT NULL,variant INTEGER,PRIMARY KEY(character_id,stop)) STRICT;
 INSERT INTO chronicle_migrations VALUES(1);COMMIT;`);
 const maxToday=id=>db.prepare('SELECT max(credited_steps) n FROM hero_step_claims WHERE character_id=? AND calendar_date=?').get(id,today()).n||0;
 function reconcile(id){
  let p=db.prepare('SELECT * FROM chronicle_profiles WHERE character_id=?').get(id);const first=!p;
  if(first){db.prepare('INSERT INTO chronicle_profiles(character_id,started_at,started_day,baseline) VALUES(?,?,?,?)').run(id,now(),today(),maxToday(id));p=db.prepare('SELECT * FROM chronicle_profiles WHERE character_id=?').get(id);}
  // Daily maxima deduplicate verified key aliases and account switches. Spending
  // the wallet, downward corrections and old-day imports cannot replay progress.
  const days=db.prepare('SELECT calendar_date,max(credited_steps) n FROM hero_step_claims WHERE character_id=? AND calendar_date BETWEEN ? AND ? GROUP BY calendar_date').all(id,p.started_day,today());
  const saveDay=db.prepare('INSERT INTO chronicle_days VALUES(?,?,?) ON CONFLICT(character_id,day) DO UPDATE SET steps=max(steps,excluded.steps)');
  for(const d of days)saveDay.run(id,d.calendar_date,Math.max(0,d.n-(d.calendar_date===p.started_day?p.baseline:0)));
  const activity=db.prepare('INSERT OR IGNORE INTO chronicle_activities VALUES(?,?,?,?,?)');
  const source=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_state'").get()?db.prepare("SELECT value FROM app_state WHERE name='active_scope'").get()?.value:null;
  if(source)for(const a of db.prepare('SELECT * FROM garmin_activities WHERE scope_id=? AND started_at>=? AND ended_at<=? AND calendar_date<=?').all(source,p.started_at,now(),today()))if(['walk','run','cycle','swim'].includes(a.kind)&&a.duration_seconds>=(a.kind==='swim'?900:1200))activity.run(id,a.activity_id,a.kind,a.calendar_date,now());
  const totals=db.prepare('SELECT coalesce(sum(steps),0) steps,sum(steps>=2000) days FROM chronicle_days WHERE character_id=?').get(id),counts=Object.fromEntries(db.prepare('SELECT kind,count(*) n FROM chronicle_activities WHERE character_id=? GROUP BY kind').all(id).map(r=>[r.kind,r.n]));
  const claims=db.prepare("SELECT quest_id,choice FROM guild_contracts WHERE character_id=? AND status='claimed'").all(id).filter(q=>NODES.some(n=>n.questId===q.quest_id)),choices=Object.fromEntries(db.prepare('SELECT event_id,choice FROM atlas_choices WHERE character_id=?').all(id).map(r=>[r.event_id,r.choice]));
  const visits=new Set(db.prepare('SELECT node_id FROM atlas_visits WHERE character_id=?').all(id).filter(r=>NODES.some(n=>n.id===r.node_id)).map(r=>r.node_id));
  for(const q of claims)visits.add(NODES.find(n=>n.questId===q.quest_id).id);
  const warden=Number(!!db.prepare("SELECT 1 FROM atlas_milestones WHERE character_id=? AND milestone_id='warden'").get(id)),arena=db.prepare('SELECT max(n) n FROM (SELECT count(*) n FROM arena_contracts WHERE character_id=? AND slot<3 AND completed=1 GROUP BY day)').get(id).n||0;
  const tourProgress=p.tour_started===null?0:Math.max(0,totals.steps-p.tour_baseline),page=db.prepare('INSERT OR IGNORE INTO chronicle_tour VALUES(?,?,?,?)');
  if(p.tour_started!==null)for(let i=0;i<5;i++)if(tourProgress>=(i+1)*5000&&(i<4||claims.length>0)){const variant=i===2?choices.oak:i===3?claims.find(q=>q.quest_id==='river-bridge')?.choice:null;page.run(id,i,now(),variant??null);}
  const pages=db.prepare('SELECT * FROM chronicle_tour WHERE character_id=? ORDER BY stop').all(id);
  const metrics={steps:totals.steps,days:totals.days||0,tour:tourProgress,walks:counts.walk||0,runs:counts.run||0,cycles:counts.cycle||0,swims:counts.swim||0,families:Object.keys(counts).length,visits:visits.size,chapters:claims.length,oak:Number(Object.hasOwn(choices,'oak')),warden,province:claims.length+Number(Object.hasOwn(choices,'oak'))+Number(Object.hasOwn(choices,'well'))+warden,crafts:db.prepare("SELECT count(*) n FROM wallet_events WHERE character_id=? AND kind='smith_craft'").get(id).n,mine:db.prepare('SELECT mine_level FROM settlement_profiles WHERE character_id=?').get(id)?.mine_level||1,arena};
  const award=db.prepare('INSERT OR IGNORE INTO chronicle_awards(character_id,badge_id,earned_at,variant,recovered) VALUES(?,?,?,?,?)');
  for(const b of BADGES)if(metrics[b.metric]>=b.target&&(b.id!=='tour'||pages.length===5))award.run(id,b.id,now(),b.id==='oak'?choices.oak:null,Number(first&&['atlas','craft'].includes(b.group)));
  return {p,metrics,pages};
 }
 function view(id){
  const {p,metrics,pages}=reconcile(id),awards=new Map(db.prepare('SELECT * FROM chronicle_awards WHERE character_id=?').all(id).map(a=>[a.badge_id,a]));
  const badges=BADGES.map(b=>{const a=awards.get(b.id);return {...b,art:b.id==='oak'&&a?.variant===1?16:b.art,value:Math.min(b.target,metrics[b.metric]),earned:!!a,earnedAt:a?.earned_at||null,recovered:!!a?.recovered,seen:!!a?.seen,variant:a?.variant??null};});
  return {startedAt:p.started_at,startedDay:p.started_day,steps:metrics.steps,days:metrics.days,activityCount:metrics.walks+metrics.runs+metrics.cycles+metrics.swims,badges,total:BADGES.length,earned:awards.size,unseen:badges.filter(b=>b.earned&&!b.seen).map(b=>b.id),display:[0,1,2].map(slot=>db.prepare('SELECT badge_id FROM chronicle_display WHERE character_id=? AND slot=?').get(id,slot)?.badge_id||null),tour:{startedAt:p.tour_started,steps:Math.min(25000,metrics.tour),complete:pages.length===5,awaitingChapter:metrics.tour>=25000&&pages.length<5,stops:TOUR.map((s,i)=>{const page=pages.find(p=>p.stop===i);return {...s,index:i,target:(i+1)*5000,reached:!!page,reachedAt:page?.reached_at||null,text:page?.variant!=null?s.variants?.[page.variant]||s.text:s.text};})}};
 }
 function display(id,input){outsideBattle(id);if(!Number.isInteger(input?.slot)||input.slot<0||input.slot>2)throw new GameError('Slot dei ricordi non valido.');const b=input.badgeId;if(b===null){db.prepare('DELETE FROM chronicle_display WHERE character_id=? AND slot=?').run(id,input.slot);return;}if(typeof b!=='string'||!BADGES.some(x=>x.id===b)||!db.prepare('SELECT 1 FROM chronicle_awards WHERE character_id=? AND badge_id=?').get(id,b))throw new GameError('Questo ricordo non è ancora tuo.');db.prepare('DELETE FROM chronicle_display WHERE character_id=? AND badge_id=?').run(id,b);db.prepare('INSERT INTO chronicle_display VALUES(?,?,?) ON CONFLICT(character_id,slot) DO UPDATE SET badge_id=excluded.badge_id').run(id,input.slot,b);}
 function read(id,input){if(!BADGES.some(b=>b.id===input?.badgeId))throw new GameError('Ricordo non valido.');db.prepare('UPDATE chronicle_awards SET seen=1 WHERE character_id=? AND badge_id=?').run(id,input.badgeId);}
 function startTour(id){outsideBattle(id);const {p,metrics}=reconcile(id);if(p.tour_started!==null)return;db.prepare('UPDATE chronicle_profiles SET tour_started=?,tour_baseline=? WHERE character_id=?').run(now(),metrics.steps,id);}
 return {view,display,read,startTour,initialize:id=>{if(!db.prepare('SELECT 1 FROM chronicle_profiles WHERE character_id=?').get(id))reconcile(id);}};
}
module.exports={createChronicles};
