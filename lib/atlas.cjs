'use strict';
const {VERSION,NODES,LINKS,VARIANTS,WARDEN_TITLE,makeAtlasPlan}=require('./atlas-catalog.cjs');
const {CONTRACTS}=require('./guild-catalog.cjs');
const QUEST_IDS=NODES.filter(n=>n.questId).map(n=>n.questId);
function createAtlas({db,now,outsideBattle,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS atlas_migrations(version INTEGER PRIMARY KEY) STRICT');
 const version=db.prepare('SELECT max(version) v FROM atlas_migrations').get().v||0;
 if(version>1)throw new Error('Versione Atlante non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE atlas_visits(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,node_id TEXT NOT NULL,visited_at INTEGER NOT NULL,PRIMARY KEY(character_id,node_id)) STRICT;
 CREATE TABLE atlas_choices(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,event_id TEXT NOT NULL,choice INTEGER NOT NULL CHECK(choice IN (0,1)),chosen_at INTEGER NOT NULL,PRIMARY KEY(character_id,event_id)) STRICT;
 CREATE TABLE atlas_runs(expedition_id TEXT PRIMARY KEY REFERENCES expeditions(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,snapshot TEXT NOT NULL CHECK(json_valid(snapshot))) STRICT;
 CREATE INDEX atlas_runs_owner ON atlas_runs(character_id);
 CREATE TABLE atlas_milestones(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,milestone_id TEXT NOT NULL,expedition_id TEXT NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,earned_at INTEGER NOT NULL,PRIMARY KEY(character_id,milestone_id)) STRICT;
 INSERT INTO atlas_migrations VALUES(1);COMMIT;`);
 function facts(id){
  const guild=Object.fromEntries(db.prepare("SELECT quest_id,choice FROM guild_contracts WHERE character_id=? AND status='claimed'").all(id).filter(r=>QUEST_IDS.includes(r.quest_id)).map(r=>[r.quest_id,r.choice]));
  const events=Object.fromEntries(db.prepare('SELECT event_id,choice FROM atlas_choices WHERE character_id=?').all(id).filter(r=>NODES.some(n=>n.kind==='event'&&n.id===r.event_id)).map(r=>[r.event_id,r.choice]));
  const warden=!!db.prepare("SELECT 1 FROM atlas_milestones WHERE character_id=? AND milestone_id='warden'").get(id);
  return {version:VERSION,guild,events,warden,chapters:Object.keys(guild).length};
 }
 function view(id){
  const f=facts(id),visited=new Set(db.prepare('SELECT node_id FROM atlas_visits WHERE character_id=?').all(id).map(r=>r.node_id));
  const active=db.prepare("SELECT e.id FROM expeditions e JOIN atlas_runs a ON a.expedition_id=e.id WHERE e.character_id=? AND e.status='active'").get(id);
  const nodes=NODES.map(n=>{
   const q=n.questId?CONTRACTS.find(q=>q.id===n.questId):null,choice=n.questId?f.guild[n.questId]:f.events[n.id];
   const accessible=n.kind==='hub'||n.kind==='story'?(!q?.requires||Object.hasOwn(f.guild,q.requires)):f.chapters>=n.requires;
   const transformed=choice!==undefined,resolved=n.kind==='expedition'?f.warden:transformed;
   const state=transformed?'transformed':resolved?'resolved':accessible?'available':n.kind==='story'?'unknown':'known';
   return {...n,state,accessible,visited:visited.has(n.id),choice:choice??null,description:transformed?(n.kind==='story'?VARIANTS[n.questId][choice]:n.choices[choice].text):n.description,questName:q?.name||null};
  });
  return {version:VERSION,province:'Provincia del Rifugio',nodes,links:LINKS,chapters:f.chapters,totalChapters:QUEST_IDS.length,events:Object.keys(f.events).length,totalEvents:2,wardenDefeated:f.warden,complete:f.chapters===QUEST_IDS.length&&f.warden,title:WARDEN_TITLE,activeExpeditionId:active?.id||null,cost:require('./expedition-catalog.cjs').ROUTES.find(r=>r.id==='watch').cost,variants:{caravan:f.guild['caravan-return']??null,mountain:f.guild['mountain-pact']??null,river:f.guild['river-bridge']??null,oak:f.events.oak??null,well:f.events.well??null}};
 }
 function visit(id,input){
  const node=view(id).nodes.find(n=>n.id===input?.nodeId);if(!node?.accessible)throw new GameError('Questo luogo non è ancora accessibile.');
  db.prepare('INSERT OR IGNORE INTO atlas_visits VALUES(?,?,?)').run(id,node.id,now());
 }
 function choose(id,input){
  outsideBattle(id);if(![0,1].includes(input?.choice))throw new GameError('Scelta dell’Atlante non valida.');
  const node=view(id).nodes.find(n=>n.id===input.nodeId&&n.kind==='event');if(!node?.accessible)throw new GameError('Questo luogo non è ancora accessibile.');
  if(node.choice!==null){if(node.choice!==input.choice)throw new GameError('La scelta è già stata salvata.');return;}
  db.prepare('INSERT INTO atlas_choices VALUES(?,?,?,?)').run(id,node.id,input.choice,now());visit(id,input);
 }
 function prepare(id,route,stage,rng){const state=view(id);if(!state.nodes.find(n=>n.id==='watch').accessible)throw new GameError('Concludi un capitolo della Gilda per raggiungere il Faro.');const snapshot=facts(id);return {snapshot,plan:makeAtlasPlan(route,stage,rng,snapshot)};}
 function recordStart(id,expeditionId,snapshot){db.prepare('INSERT INTO atlas_runs VALUES(?,?,?)').run(expeditionId,id,JSON.stringify(snapshot));visit(id,{nodeId:'watch'});}
 function finish(e,status){if(status!=='completed'||!db.prepare('SELECT 1 FROM atlas_runs WHERE expedition_id=? AND character_id=?').get(e.id,e.character_id))return;db.prepare("INSERT OR IGNORE INTO atlas_milestones VALUES(?,'warden',?,?)").run(e.character_id,e.id,now());}
 return {view,visit,choose,prepare,recordStart,finish};
}
module.exports={createAtlas};
