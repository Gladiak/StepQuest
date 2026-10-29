'use strict';
const { DatabaseSync } = require('node:sqlite');

// La chiave resta nel processo principale e nel database locale, senza Portachiavi.
function createCredentialsRepository(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS local_credentials (
      name TEXT PRIMARY KEY CHECK(name='garmin_api_key'),
      value TEXT NOT NULL CHECK(length(value)>0)
    ) STRICT;`);
  return Object.freeze({
    readKey: () => db.prepare("SELECT value FROM local_credentials WHERE name='garmin_api_key'").get()?.value || '',
    saveKey(key) {
      if (typeof key !== 'string' || !/^GCDC_[A-Za-z0-9+/=._-]{30,2048}$/.test(key.trim())) {
        throw new Error('Chiave Garmin non valida.');
      }
      db.prepare(`INSERT INTO local_credentials(name,value) VALUES ('garmin_api_key',?)
        ON CONFLICT(name) DO UPDATE SET value=excluded.value`).run(key.trim());
    },
    close: () => db.close(),
  });
}
module.exports = { createCredentialsRepository };
