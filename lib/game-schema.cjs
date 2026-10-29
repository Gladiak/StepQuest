'use strict';
const C=require('./game-catalog.cjs');
const {generateItem,insertItem}=require('./game-items.cjs');
function upgradeGameV2(db){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS game_rules(id TEXT PRIMARY KEY,value INTEGER NOT NULL CHECK(value>0)) STRICT;
 CREATE TABLE IF NOT EXISTS stat_definitions(id TEXT PRIMARY KEY,label TEXT NOT NULL,base REAL NOT NULL,cap REAL NOT NULL,is_percent INTEGER NOT NULL) STRICT;`);
 try{
  const columns=db.prepare('PRAGMA table_info(set_bonuses)').all();
  if(!columns.some(c=>c.name==='rarity_id'))db.exec('ALTER TABLE set_bonuses ADD COLUMN rarity_id TEXT REFERENCES item_rarities(id);');
  db.exec("UPDATE set_bonuses SET rarity_id=CASE pieces WHEN 2 THEN 'rare' WHEN 3 THEN 'mythic' ELSE 'legendary' END WHERE rarity_id IS NULL;");
  for(const [id,value]of Object.entries(C.RULES))db.prepare('INSERT OR IGNORE INTO game_rules VALUES(?,?)').run(id,value);
  for(const [id,d]of Object.entries(C.STAT_DEFINITIONS))db.prepare('INSERT OR IGNORE INTO stat_definitions VALUES(?,?,?,?,?)').run(id,d.label,d.base,d.cap,Number(!!d.percent));
  db.exec('CREATE INDEX IF NOT EXISTS battles_owner ON battles(character_id); CREATE INDEX IF NOT EXISTS wallet_owner ON wallet_events(character_id); INSERT INTO game_migrations VALUES(2); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function upgradeGameV3(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(`CREATE TABLE equipped_items_v3(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,slot TEXT NOT NULL CHECK(slot IN ('weapon','body','feet','ring1','ring2','amulet')),item_id TEXT NOT NULL UNIQUE REFERENCES item_instances(id) ON DELETE CASCADE,PRIMARY KEY(character_id,slot)) STRICT;
  INSERT INTO equipped_items_v3 SELECT e.character_id,CASE WHEN e.slot='accessory' THEN CASE WHEN t.sprite='ring' THEN 'ring1' ELSE 'amulet' END ELSE e.slot END,e.item_id FROM equipped_items e JOIN item_instances i ON i.id=e.item_id JOIN item_templates t ON t.id=i.template_id;
  DROP TABLE equipped_items; ALTER TABLE equipped_items_v3 RENAME TO equipped_items;
  UPDATE item_templates SET slot=CASE WHEN sprite='ring' THEN 'ring' ELSE 'amulet' END WHERE slot='accessory';`);
  for(const t of C.TEMPLATES.filter(t=>!C.SETS.find(s=>s.id===t.set_id)?.unique))db.prepare('INSERT INTO item_templates VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slot=excluded.slot,category=excluded.category').run(t.id,t.name,t.sprite,t.slot,t.category,t.class_id,JSON.stringify(t.base_stats),t.min_level,t.set_id,Number(t.starter),t.effect?JSON.stringify(t.effect):null);
  for(const a of C.AFFIXES)db.prepare('UPDATE affix_definitions SET slots_json=? WHERE id=?').run(JSON.stringify(a.slots),a.id);
  db.exec('INSERT INTO game_migrations VALUES(3); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function upgradeGameV4(db){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE expeditions(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('active','completed','returned','lost')),route TEXT NOT NULL,start_stage INTEGER NOT NULL,step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 4),version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),stash INTEGER NOT NULL DEFAULT 0 CHECK(stash>=0),boosts TEXT NOT NULL CHECK(json_valid(boosts)),plan TEXT NOT NULL CHECK(json_valid(plan)),log TEXT NOT NULL CHECK(json_valid(log)),battle_id TEXT REFERENCES battles(id),rewards TEXT CHECK(rewards IS NULL OR json_valid(rewards)),created_at TEXT NOT NULL,finished_at TEXT) STRICT;
 CREATE UNIQUE INDEX one_active_expedition ON expeditions(character_id) WHERE status='active';
 CREATE INDEX expeditions_owner ON expeditions(character_id); INSERT INTO game_migrations VALUES(4); COMMIT;`);
}
function upgradeGameV5(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  const mythic=C.RARITIES.find(r=>r.id==='mythic');
  db.prepare("UPDATE item_rarities SET color_light=?,color_dark=? WHERE id='mythic'").run(mythic.light,mythic.dark);
  db.exec('INSERT INTO game_migrations VALUES(5); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function upgradeGameV6(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  const save=db.prepare('INSERT INTO game_rules(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value');
  for(const id of ['encounter_steps','exchange_steps','exchange_coins'])save.run(id,C.RULES[id]);
  db.exec('INSERT INTO game_migrations VALUES(6); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function upgradeGameV7(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  const save=db.prepare('INSERT INTO game_rules(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value');
  for(const id of ['merchant_refresh_base','merchant_refresh_per_level'])save.run(id,C.RULES[id]);
  db.exec('INSERT INTO game_migrations VALUES(7); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function upgradeGameV8(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  const r=C.RARITIES.find(r=>r.id==='unique');db.prepare('INSERT OR IGNORE INTO item_rarities VALUES(?,?,?,?,?,?,?,?,?)').run(r.id,r.name,r.rank,r.min,r.max,r.scale,r.weight,r.light,r.dark);
  const cols=db.prepare('PRAGMA table_info(item_instances)').all();
  if(!cols.some(c=>c.name==='generation_depth'))db.exec('ALTER TABLE item_instances ADD COLUMN generation_depth INTEGER NOT NULL DEFAULT 1;');
  if(!cols.some(c=>c.name==='depth_multiplier'))db.exec('ALTER TABLE item_instances ADD COLUMN depth_multiplier REAL NOT NULL DEFAULT 1;');
  for(const s of C.SETS.filter(s=>s.unique)){
   db.prepare('INSERT OR IGNORE INTO item_sets VALUES(?,?,?,?)').run(s.id,s.name,s.class_id,s.min_level);
   for(const b of s.bonuses)db.prepare('INSERT OR IGNORE INTO set_bonuses VALUES(?,?,?,?,?)').run(s.id,b.pieces,b.attribute_id,b.value,b.rarity);
   for(const t of C.TEMPLATES.filter(t=>t.set_id===s.id))db.prepare('INSERT OR IGNORE INTO item_templates VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(t.id,t.name,t.sprite,t.slot,t.category,t.class_id,JSON.stringify(t.base_stats),t.min_level,t.set_id,Number(t.starter),t.effect?JSON.stringify(t.effect):null);
  }
  db.exec('INSERT INTO game_migrations VALUES(8); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function upgradeGameV9(db){
 db.exec(`BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS loot_progress(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,dry_wins INTEGER NOT NULL DEFAULT 0 CHECK(dry_wins>=0 AND dry_wins<=2)) STRICT; INSERT INTO game_migrations VALUES(9); COMMIT;`);
}
function migrateGame(db){
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 const exists=db.prepare("SELECT name FROM sqlite_master WHERE name='game_migrations'").get();
 if(exists){const version=db.prepare('SELECT max(version) AS v FROM game_migrations').get().v;if(version>9)throw new Error('Versione del gioco non supportata.');if(version===9)return;if(version===1)upgradeGameV2(db);if(version<=2)upgradeGameV3(db);if(version<=3)upgradeGameV4(db);if(version<=4)upgradeGameV5(db);if(version<=5)upgradeGameV6(db);if(version<=6)upgradeGameV7(db);if(version<=7)upgradeGameV8(db);upgradeGameV9(db);return;}
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS game_migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE game_rules(id TEXT PRIMARY KEY,value INTEGER NOT NULL CHECK(value>0)) STRICT;
 CREATE TABLE stat_definitions(id TEXT PRIMARY KEY,label TEXT NOT NULL,base REAL NOT NULL,cap REAL NOT NULL,is_percent INTEGER NOT NULL) STRICT;
 CREATE TABLE item_rarities(id TEXT PRIMARY KEY,name TEXT NOT NULL,rank INTEGER NOT NULL UNIQUE,min_properties INTEGER NOT NULL,max_properties INTEGER NOT NULL,roll_scale REAL NOT NULL,weight INTEGER NOT NULL,color_light TEXT NOT NULL,color_dark TEXT NOT NULL) STRICT;
 CREATE TABLE attribute_definitions(id TEXT PRIMARY KEY,stat TEXT NOT NULL,label TEXT NOT NULL,unit TEXT NOT NULL,operation TEXT NOT NULL,bonus_min REAL NOT NULL,bonus_max REAL NOT NULL,malus_min REAL NOT NULL,malus_max REAL NOT NULL) STRICT;
 CREATE TABLE affix_definitions(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('prefix','suffix')),name TEXT NOT NULL,min_rank INTEGER NOT NULL,slots_json TEXT NOT NULL CHECK(json_valid(slots_json))) STRICT;
 CREATE TABLE affix_ranges(affix_id TEXT NOT NULL REFERENCES affix_definitions(id),attribute_id TEXT NOT NULL REFERENCES attribute_definitions(id),sign INTEGER NOT NULL CHECK(sign IN (-1,1)),min_value REAL NOT NULL,max_value REAL NOT NULL,chance REAL NOT NULL,PRIMARY KEY(affix_id,attribute_id,sign)) STRICT;
 CREATE TABLE item_sets(id TEXT PRIMARY KEY,name TEXT NOT NULL,class_id TEXT NOT NULL,min_level INTEGER NOT NULL) STRICT;
 CREATE TABLE set_bonuses(set_id TEXT NOT NULL REFERENCES item_sets(id),pieces INTEGER NOT NULL,attribute_id TEXT NOT NULL REFERENCES attribute_definitions(id),value REAL NOT NULL,rarity_id TEXT NOT NULL REFERENCES item_rarities(id),PRIMARY KEY(set_id,pieces,attribute_id)) STRICT;
 CREATE TABLE item_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,sprite TEXT NOT NULL,slot TEXT NOT NULL,category TEXT NOT NULL,class_id TEXT,base_stats TEXT NOT NULL CHECK(json_valid(base_stats)),min_level INTEGER NOT NULL,set_id TEXT REFERENCES item_sets(id),starter INTEGER NOT NULL,effect TEXT CHECK(effect IS NULL OR json_valid(effect))) STRICT;
 CREATE TABLE hero_progress(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,level INTEGER NOT NULL DEFAULT 1 CHECK(level>=1),xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),hp INTEGER NOT NULL CHECK(hp>=0),stage INTEGER NOT NULL DEFAULT 1 CHECK(stage>=1)) STRICT;
 CREATE TABLE item_instances(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,template_id TEXT NOT NULL REFERENCES item_templates(id),name TEXT NOT NULL,rarity_id TEXT NOT NULL REFERENCES item_rarities(id),item_level INTEGER NOT NULL CHECK(item_level>=1),base_stats TEXT NOT NULL CHECK(json_valid(base_stats)),rolls TEXT NOT NULL CHECK(json_valid(rolls)),prefix_id TEXT REFERENCES affix_definitions(id),suffix_id TEXT REFERENCES affix_definitions(id),price INTEGER NOT NULL CHECK(price>=0),source TEXT NOT NULL,location TEXT NOT NULL CHECK(location IN ('inventory','merchant')),created_at TEXT NOT NULL) STRICT;
 CREATE INDEX item_instances_owner ON item_instances(character_id,location);
 CREATE TABLE equipped_items(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,slot TEXT NOT NULL CHECK(slot IN ('weapon','body','feet','accessory')),item_id TEXT NOT NULL UNIQUE REFERENCES item_instances(id) ON DELETE CASCADE,PRIMARY KEY(character_id,slot)) STRICT;
 CREATE TABLE merchant_state(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0) STRICT;
 CREATE TABLE merchant_offers(item_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,price INTEGER NOT NULL CHECK(price>0)) STRICT;
 CREATE TABLE wallet_events(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,kind TEXT NOT NULL,steps_delta INTEGER NOT NULL,coins_delta INTEGER NOT NULL,reference TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL) STRICT;
 CREATE TABLE step_claims(scope_id TEXT NOT NULL,calendar_date TEXT NOT NULL,credited_steps INTEGER NOT NULL CHECK(credited_steps>=0),PRIMARY KEY(scope_id,calendar_date)) STRICT;
 CREATE TABLE battles(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('active','won','lost','fled')),stage INTEGER NOT NULL,enemy TEXT NOT NULL CHECK(json_valid(enemy)),enemy_hp INTEGER NOT NULL,round INTEGER NOT NULL DEFAULT 0,log TEXT NOT NULL CHECK(json_valid(log)),buffs TEXT NOT NULL CHECK(json_valid(buffs)),rewards TEXT CHECK(rewards IS NULL OR json_valid(rewards)),created_at TEXT NOT NULL,finished_at TEXT) STRICT;
 CREATE INDEX battles_owner ON battles(character_id);
 CREATE INDEX wallet_owner ON wallet_events(character_id);
 CREATE UNIQUE INDEX one_active_battle ON battles(character_id) WHERE status='active';`);
 try{
  for(const [id,value]of Object.entries(C.RULES))db.prepare('INSERT INTO game_rules VALUES(?,?)').run(id,value);
  for(const [id,d]of Object.entries(C.STAT_DEFINITIONS))db.prepare('INSERT INTO stat_definitions VALUES(?,?,?,?,?)').run(id,d.label,d.base,d.cap,Number(!!d.percent));
  for(const r of C.RARITIES)db.prepare('INSERT INTO item_rarities VALUES(?,?,?,?,?,?,?,?,?)').run(r.id,r.name,r.rank,r.min,r.max,r.scale,r.weight,r.light,r.dark);
  for(const a of C.ATTRIBUTES)db.prepare('INSERT INTO attribute_definitions VALUES(?,?,?,?,?,?,?,?,?)').run(a.id,a.stat,a.label,a.unit,a.operation,a.bonus_min,a.bonus_max,a.malus_min,a.malus_max);
  for(const a of C.AFFIXES){db.prepare('INSERT INTO affix_definitions VALUES(?,?,?,?,?)').run(a.id,a.kind,a.text,a.min_rank,JSON.stringify(a.slots));for(const r of a.rolls)db.prepare('INSERT INTO affix_ranges VALUES(?,?,?,?,?,?)').run(a.id,r.attribute_id,r.sign,r.min,r.max,r.chance);}
  for(const s of C.SETS){db.prepare('INSERT INTO item_sets VALUES(?,?,?,?)').run(s.id,s.name,s.class_id,s.min_level);for(const b of s.bonuses)db.prepare('INSERT INTO set_bonuses VALUES(?,?,?,?,?)').run(s.id,b.pieces,b.attribute_id,b.value,b.rarity);}
  for(const t of C.TEMPLATES)db.prepare('INSERT INTO item_templates VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(t.id,t.name,t.sprite,t.slot,t.category,t.class_id,JSON.stringify(t.base_stats),t.min_level,t.set_id,Number(t.starter),t.effect?JSON.stringify(t.effect):null);
  db.exec('INSERT INTO game_migrations VALUES(1); COMMIT;');
 }catch(error){db.exec('ROLLBACK');throw error;}
 upgradeGameV2(db);
 upgradeGameV3(db);
 upgradeGameV4(db);
 upgradeGameV5(db);
 upgradeGameV6(db);
 upgradeGameV7(db);
 upgradeGameV8(db);
 upgradeGameV9(db);
}
function baseStats(classId,level,definitions=C.STAT_DEFINITIONS){
 const hp={guardian:115,arcanist:90,ranger:100,rogue:95,druid:105,berserker:120}[classId];
 return {...Object.fromEntries(Object.entries(definitions).map(([key,x])=>[key,x.base])),health:hp+12*(level-1),attack:4+2*(level-1)};
}
function initializeHero(db,id,classId){
 if(db.prepare('SELECT 1 FROM hero_progress WHERE character_id=?').get(id))return;
 db.prepare('INSERT INTO hero_progress(character_id,hp) VALUES(?,?)').run(id,baseStats(classId,1).health);
 for(const name of ['starter-'+classId,'starter-clothes']){const item=generateItem(C.TEMPLATES.find(t=>t.id===name),{source:'starter'});insertItem(db,id,item);db.prepare('INSERT INTO equipped_items VALUES(?,?,?)').run(id,item.slot,item.id);}
}
module.exports={migrateGame,initializeHero,baseStats};
