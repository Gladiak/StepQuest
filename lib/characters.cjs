'use strict';
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { migrateGame, initializeHero } = require('./game-schema.cjs');
const CLASSES = ['guardian','arcanist','ranger','rogue','druid','berserker'];
class CharacterError extends Error { constructor(message) { super(message); this.code='CHARACTER'; } }
function createCharactersRepository(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS character_migrations(version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS characters(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, class_id TEXT NOT NULL,
      sex TEXT NOT NULL CHECK(sex IN ('male','female')), created_at TEXT NOT NULL,
      played_seconds INTEGER NOT NULL DEFAULT 0 CHECK(played_seconds>=0),
      steps INTEGER NOT NULL DEFAULT 0 CHECK(steps>=0), coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0)
    ) STRICT;
    INSERT OR IGNORE INTO character_migrations VALUES(1); COMMIT;`);
  migrateGame(db);
  const select='SELECT c.*,COALESCE(p.level,1) AS level,COALESCE(p.stage,1) AS stage FROM characters c LEFT JOIN hero_progress p ON p.character_id=c.id';
  const list=()=>db.prepare(select+' ORDER BY c.created_at,c.id').all();
  return {
    list,
    create(input) {
      const name=typeof input?.name==='string'?input.name.normalize('NFC').trim():'';
      if(!/^[\p{L}\p{N}][\p{L}\p{N} '\-]{1,18}[\p{L}\p{N}]$/u.test(name)) throw new CharacterError('Scegli un nome da 3 a 20 caratteri, con lettere, numeri, spazi, apostrofi o trattini.');
      if(!CLASSES.includes(input.classId)||!['male','female'].includes(input.sex))throw new CharacterError('Classe o sesso non valido.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if(list().length>=3)throw new CharacterError('Hai già tre personaggi. Libera uno slot prima di crearne un altro.');
        if(list().some(c=>c.name.toLocaleLowerCase('it')===name.toLocaleLowerCase('it')))throw new CharacterError('Esiste già un personaggio con questo nome.');
        const id=randomUUID();
        db.prepare('INSERT INTO characters(id,name,class_id,sex,created_at) VALUES(?,?,?,?,?)').run(id,name,input.classId,input.sex,new Date().toISOString());
        initializeHero(db,id,input.classId);
        db.exec('COMMIT');return db.prepare(select+' WHERE c.id=?').get(id);
      }catch(e){db.exec('ROLLBACK');throw e;}
    },
    get(id){const c=db.prepare(select+' WHERE c.id=?').get(id);if(!c)throw new CharacterError('Personaggio non trovato.');return c;},
    remove(id,confirmation){const c=this.get(id);if(confirmation!==c.name)throw new CharacterError('Il nome digitato non corrisponde.');db.prepare('DELETE FROM characters WHERE id=?').run(id);},
    addTime(id,seconds){db.prepare('UPDATE characters SET played_seconds=played_seconds+? WHERE id=?').run(Math.max(0,Math.floor(seconds)),id);},
    close(){db.close();},
  };
}
module.exports={createCharactersRepository,CharacterError};
