'use strict';
const {createHash}=require('node:crypto');
const {isUuid}=require('./validation.cjs');
const {RUNES,WORDS,ECHOES}=require('./runic-catalog.cjs');
function createRunic({db,progress,getHero,requireHome,money,rng,GameError}){
 db.exec('CREATE TABLE IF NOT EXISTS runic_migrations(version INTEGER PRIMARY KEY) STRICT');
 const version=db.prepare('SELECT max(version) v FROM runic_migrations').get().v||0;if(version>1)throw new Error('Versione runica non supportata.');
 if(!version)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE runic_profiles(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,auto_profile TEXT NOT NULL DEFAULT 'aggressive' CHECK(auto_profile IN ('aggressive','prudent')),echo_rank INTEGER NOT NULL DEFAULT 0 CHECK(echo_rank BETWEEN 0 AND 2),fragments INTEGER NOT NULL DEFAULT 0 CHECK(fragments>=0),initiated INTEGER NOT NULL DEFAULT 0 CHECK(initiated IN (0,1))) STRICT;
 CREATE TABLE rune_inventory(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,rune_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(character_id,rune_id)) STRICT;
 CREATE TABLE item_runewords(item_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,word TEXT NOT NULL CHECK(json_valid(word)),revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)) STRICT;
 CREATE TABLE runic_actions(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL) STRICT;
 INSERT INTO runic_migrations VALUES(1);COMMIT;`);
 const settings=id=>{const row=db.prepare('SELECT * FROM runic_profiles WHERE character_id=?').get(id);return {profile:row?.auto_profile||'aggressive',echoRank:row?.echo_rank||0,fragments:row?.fragments||0,initiated:!!row?.initiated};};
 const ensure=id=>db.prepare('INSERT OR IGNORE INTO runic_profiles(character_id) VALUES(?)').run(id);
 const quantity=(id,rune)=>db.prepare('SELECT quantity FROM rune_inventory WHERE character_id=? AND rune_id=?').get(id,rune)?.quantity||0;
 const add=(id,rune,n)=>db.prepare('INSERT INTO rune_inventory VALUES(?,?,?) ON CONFLICT(character_id,rune_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(id,rune,n);
 const wordFor=itemId=>{const row=db.prepare('SELECT word FROM item_runewords WHERE item_id=?').get(itemId);return row?JSON.parse(row.word):null;};
 const metadata=id=>new Map(db.prepare('SELECT item_id,word FROM item_runewords WHERE character_id=?').all(id).map(r=>[r.item_id,JSON.parse(r.word)]));
 function replay(id,input,kind){if(!isUuid(input?.requestId))throw new GameError('Richiesta runica non valida.');const fingerprint=createHash('sha256').update(JSON.stringify([kind,input])).digest('hex'),prior=db.prepare('SELECT * FROM runic_actions WHERE id=?').get(input.requestId);if(prior){if(prior.character_id!==id||prior.fingerprint!==fingerprint)throw new GameError('Richiesta runica non valida.');return true;}db.prepare('INSERT INTO runic_actions VALUES(?,?,?)').run(input.requestId,id,fingerprint);return false;}
 function view(id){const p=progress(id),s=settings(id);return {...s,unlocked:p.level>=15,runes:RUNES.map(r=>({...r,quantity:quantity(id,r.id)})),words:WORDS.map(w=>({...w,unlocked:p.level>=w.level})),echoes:ECHOES.map(e=>({...e,unlocked:p.level>=e.level&&p.stage>=e.depth}))};}
 function configure(id,input){requireHome(id);if(!input||!['aggressive','prudent'].includes(input.profile)||!Number.isInteger(input.echoRank)||!ECHOES[input.echoRank])throw new GameError('Impostazioni di battaglia non valide.');const p=progress(id),echo=ECHOES[input.echoRank];if(p.level<echo.level||p.stage<echo.depth)throw new GameError('Questo grado degli Echi non è ancora disponibile.');ensure(id);db.prepare('UPDATE runic_profiles SET auto_profile=?,echo_rank=? WHERE character_id=?').run(input.profile,input.echoRank,id);}
 function initiate(id,input){requireHome(id);if(progress(id).level<15)throw new GameError('Le incisioni richiedono il livello 15.');if(replay(id,input,'initiate'))return;ensure(id);if(settings(id).initiated)return;for(const rune of ['sol','tor','lum','or'])add(id,rune,1);db.prepare('UPDATE runic_profiles SET initiated=1,fragments=fragments+16 WHERE character_id=?').run(id);}
 function craft(id,input){requireHome(id);const rune=RUNES.find(r=>r.id===input?.runeId);if(!rune||progress(id).level<rune.level)throw new GameError('Runa non disponibile.');if(replay(id,input,'craft'))return;ensure(id);if(settings(id).fragments<rune.cost)throw new GameError('Frammenti insufficienti.');db.prepare('UPDATE runic_profiles SET fragments=fragments-? WHERE character_id=?').run(rune.cost,id);add(id,rune.id,1);}
 function quote(id,input){
  requireHome(id);const row=db.prepare("SELECT i.*,t.slot,t.class_id,t.effect AS template_effect FROM item_instances i JOIN item_templates t ON t.id=i.template_id WHERE i.id=? AND i.character_id=? AND i.location='inventory' AND EXISTS(SELECT 1 FROM equipped_items e WHERE e.item_id=i.id AND e.character_id=i.character_id)").get(input?.itemId,id),word=WORDS.find(w=>w.id===input?.wordId),p=progress(id),mode=input?.mode||'engrave';
  if(!row||!['weapon','body'].includes(row.slot)||row.template_effect||row.class_id&&row.class_id!==getHero(id).class_id||row.item_level>p.level||!['engrave','extract'].includes(mode))throw new GameError('Equipaggiamento runico non valido.');
  if(db.prepare('SELECT 1 FROM alchemy_attempts WHERE item_id=? AND choice_index IS NULL').get(row.id))throw new GameError('Completa prima la preparazione alchemica di questo oggetto.');
  const current=wordFor(row.id);if(mode==='engrave'&&(!word||word.slot!==row.slot||p.level<word.level||current)||mode==='extract'&&!current)throw new GameError('Incisione non disponibile per questo pezzo.');
  const recipe=mode==='extract'?current:word,needs=Object.entries(recipe.runes.reduce((counts,rune)=>(counts[rune]=(counts[rune]||0)+1,counts),{})).map(([runeId,count])=>({runeId,count,available:quantity(id,runeId)}));
  const cost=mode==='extract'?30+row.item_level:100+6*row.item_level,affordable=getHero(id).coins>=cost&&(mode==='extract'||needs.every(n=>n.available>=n.count));
  const token=createHash('sha256').update(JSON.stringify([id,mode,row,p.level,current,needs,cost])).digest('hex');
  return {itemId:row.id,wordId:recipe.id,mode,cost,needs,affordable,token};
 }
 function inscribe(id,input){requireHome(id);if(replay(id,input,'inscribe'))return;const q=quote(id,input);if(input.token!==q.token)throw new GameError('Il preventivo runico è cambiato. Riapri l’anteprima.','STALE_RUNIC');if(!q.affordable)throw new GameError('Monete o rune insufficienti.');money(id,'runic_'+q.mode,0,-q.cost,'runic:'+input.requestId);
  if(q.mode==='extract'){const word=wordFor(q.itemId);for(const rune of word.runes)add(id,rune,1);db.prepare('DELETE FROM item_runewords WHERE item_id=? AND character_id=?').run(q.itemId,id);}
  else{for(const need of q.needs)db.prepare('UPDATE rune_inventory SET quantity=quantity-? WHERE character_id=? AND rune_id=?').run(need.count,id,need.runeId);const word=WORDS.find(w=>w.id===q.wordId);db.prepare('INSERT INTO item_runewords(item_id,character_id,word) VALUES(?,?,?)').run(q.itemId,id,JSON.stringify(word));}
 }
 function award(id,enemy){if(progress(id).level<15||enemy.difficulty==='easy')return {fragments:0,rune:null};ensure(id);const fragments=(enemy.expeditionId&&enemy.elite?3:enemy.elite?1:0)+(enemy.echoRank||0)*2;db.prepare('UPDATE runic_profiles SET fragments=fragments+? WHERE character_id=?').run(fragments,id);let rune=null;if(rng()<(enemy.expeditionId&&enemy.elite?.20:enemy.elite?.10:.03)){const pool=RUNES.filter(r=>r.level<=progress(id).level);rune=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];add(id,rune.id,1);}return {fragments,rune:rune?{id:rune.id,name:rune.name}:null};}
 return {settings,view,metadata,wordFor,configure,initiate,craft,quote,inscribe,award};
}
module.exports={createRunic};
