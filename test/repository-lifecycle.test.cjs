'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createCharactersRepository } = require('../lib/characters.cjs');
const { createGameRepository } = require('../lib/game-repository.cjs');

test('failed repository initialization closes its database at early and late migration failures', t => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-lifecycle-'));
 const filename = path.join(directory, 'game.sqlite');
 t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
 const characters = createCharactersRepository(filename);
 characters.close();
 createGameRepository(filename).close();
 const sql = new DatabaseSync(filename);
 t.after(() => sql.close());

 for (const table of ['game_migrations', 'chronicle_migrations']) {
  const version = sql.prepare(`SELECT max(version) AS version FROM ${table}`).get().version;
  sql.prepare(`UPDATE ${table} SET version=999 WHERE version=?`).run(version);
  const closed = [], originalClose = DatabaseSync.prototype.close;
  DatabaseSync.prototype.close = function () { closed.push(this); return originalClose.call(this); };
  try {
   assert.throws(() => createGameRepository(filename), /non supportata/);
   assert.equal(closed.length, 1, table);
   assert.throws(() => closed[0].prepare('SELECT 1'), /closed|open/i);
  } finally {
   DatabaseSync.prototype.close = originalClose;
   sql.prepare(`UPDATE ${table} SET version=? WHERE version=999`).run(version);
  }
  // A failed open leaves the save usable after the unsupported version is corrected.
  const reopened = createGameRepository(filename);
  reopened.close();
 }
});
