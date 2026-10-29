'use strict';
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { dateRange } = require('./dates.cjs');

function scopeForKey(key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  return createHash('sha256').update(`stepquest:garmin-key:v1:${key.trim()}`).digest('hex');
}
function createStepsRepository(filename) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (!fs.existsSync(filename)) fs.closeSync(fs.openSync(filename, 'wx', 0o600));
    fs.chmodSync(filename, 0o600);
  }
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 1) { db.close(); throw new Error('Il database richiede una versione più recente di StepQuest.'); }
  if (version === 0) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE source_scopes (
        id TEXT PRIMARY KEY CHECK(length(id)=64), created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE app_state (
        name TEXT PRIMARY KEY, value TEXT NOT NULL REFERENCES source_scopes(id)
      ) STRICT;
      CREATE TABLE daily_steps (
        scope_id TEXT NOT NULL REFERENCES source_scopes(id), calendar_date TEXT NOT NULL,
        steps INTEGER CHECK(steps IS NULL OR steps>=0), goal INTEGER CHECK(goal IS NULL OR goal>=0),
        distance_meters REAL CHECK(distance_meters IS NULL OR distance_meters>=0),
        availability TEXT NOT NULL CHECK(availability IN ('available','no_data')),
        fetched_at TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=1),
        PRIMARY KEY(scope_id,calendar_date), CHECK((steps IS NULL)=(availability='no_data'))
      ) STRICT;
      CREATE TABLE step_revisions (
        scope_id TEXT NOT NULL, calendar_date TEXT NOT NULL, revision INTEGER NOT NULL,
        steps INTEGER, goal INTEGER, distance_meters REAL, availability TEXT NOT NULL, observed_at TEXT NOT NULL,
        PRIMARY KEY(scope_id,calendar_date,revision),
        FOREIGN KEY(scope_id,calendar_date) REFERENCES daily_steps(scope_id,calendar_date)
      ) STRICT;
      CREATE TABLE sync_runs (
        id INTEGER PRIMARY KEY, scope_id TEXT NOT NULL REFERENCES source_scopes(id),
        from_date TEXT NOT NULL, to_date TEXT NOT NULL, attempted_at TEXT NOT NULL,
        finished_at TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),
        stored_days INTEGER NOT NULL DEFAULT 0, error_code TEXT
      ) STRICT;
      CREATE INDEX sync_runs_scope_time ON sync_runs(scope_id,finished_at DESC);
      PRAGMA user_version = 1;
      COMMIT;`);
  }
  const statement = sql => db.prepare(sql);
  function ensureScope(scope, at) {
    if (typeof scope !== 'string' || !/^[a-f0-9]{64}$/.test(scope)) throw new Error('Scope sorgente non valido.');
    statement('INSERT INTO source_scopes(id,created_at) VALUES (?,?) ON CONFLICT(id) DO NOTHING').run(scope, at);
  }
  function activeScope() { return statement("SELECT value FROM app_state WHERE name='active_scope'").get()?.value || null; }
  function activate(scope, at = new Date().toISOString()) {
    ensureScope(scope, at);
    statement("INSERT INTO app_state(name,value) VALUES ('active_scope',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(scope);
  }
  function validateResult(result) {
    const dates = dateRange(result.from, result.to);
    if (!Array.isArray(result.days) || result.days.length !== dates.length) throw new Error('Snapshot passi incompleto.');
    if (typeof result.fetchedAt !== 'string' || !Number.isFinite(Date.parse(result.fetchedAt))) throw new Error('Timestamp snapshot non valido.');
    for (let i = 0; i < dates.length; i++) {
      const row = result.days[i];
      if (row.date !== dates[i] || ![row.steps, row.goal].every(n => n === null || Number.isSafeInteger(n) && n >= 0)
        || !(row.distanceMeters === null || typeof row.distanceMeters === 'number' && Number.isFinite(row.distanceMeters) && row.distanceMeters >= 0)) throw new Error('Misure snapshot non valide.');
    }
  }
  function save(scope, result, attemptedAt = result.fetchedAt) {
    validateResult(result);
    db.exec('BEGIN IMMEDIATE');
    try {
      ensureScope(scope, result.fetchedAt);
      for (const row of result.days) {
        const prior = statement('SELECT * FROM daily_steps WHERE scope_id=? AND calendar_date=?').get(scope, row.date);
        if (prior && prior.fetched_at > result.fetchedAt) continue;
        const availability = row.steps === null ? 'no_data' : 'available';
        const changed = !prior || prior.steps !== row.steps || prior.goal !== row.goal || prior.distance_meters !== row.distanceMeters;
        const revision = (prior?.revision || 0) + (changed ? 1 : 0);
        statement(`INSERT INTO daily_steps(scope_id,calendar_date,steps,goal,distance_meters,availability,fetched_at,revision)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(scope_id,calendar_date) DO UPDATE SET
          steps=excluded.steps,goal=excluded.goal,distance_meters=excluded.distance_meters,
          availability=excluded.availability,fetched_at=excluded.fetched_at,revision=excluded.revision`).run(
            scope, row.date, row.steps, row.goal, row.distanceMeters, availability, result.fetchedAt, revision);
        if (changed) statement(`INSERT INTO step_revisions(scope_id,calendar_date,revision,steps,goal,distance_meters,availability,observed_at)
          VALUES (?,?,?,?,?,?,?,?)`).run(scope, row.date, revision, row.steps, row.goal, row.distanceMeters, availability, result.fetchedAt);
      }
      statement(`INSERT INTO sync_runs(scope_id,from_date,to_date,attempted_at,finished_at,outcome,stored_days)
        VALUES (?,?,?,?,?,'success',?)`).run(scope, result.from, result.to, attemptedAt, result.fetchedAt, result.days.length);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function failed(scope, from, to, attemptedAt, finishedAt, errorCode) {
    dateRange(from, to); ensureScope(scope, attemptedAt);
    const code = typeof errorCode === 'string' && /^[A-Z_]{1,40}$/.test(errorCode) ? errorCode : 'SYNC_ERROR';
    statement(`INSERT INTO sync_runs(scope_id,from_date,to_date,attempted_at,finished_at,outcome,error_code)
      VALUES (?,?,?,?,?,'failure',?)`).run(scope, from, to, attemptedAt, finishedAt, code);
  }
  function read(scope, from, to) {
    const dates = dateRange(from, to);
    const rows = scope ? statement('SELECT * FROM daily_steps WHERE scope_id=? AND calendar_date BETWEEN ? AND ? ORDER BY calendar_date').all(scope, from, to) : [];
    const lookup = new Map(rows.map(row => [row.calendar_date, row]));
    const times = rows.map(row => row.fetched_at).sort();
    const latest = scope ? statement('SELECT finished_at,outcome,error_code FROM sync_runs WHERE scope_id=? ORDER BY id DESC LIMIT 1').get(scope) : null;
    return {
      from, to, source: 'cache', fetchedAt: times.at(-1) || null,
      days: dates.map(date => {
        const row = lookup.get(date);
        return { date, steps: row?.steps ?? null, goal: row?.goal ?? null, distanceMeters: row?.distance_meters ?? null,
          availability: row?.availability || 'not_downloaded', fetchedAt: row?.fetched_at || null, revision: row?.revision || null };
      }),
      cache: { requestedDays: dates.length, storedDays: rows.length, dataDays: rows.filter(row => row.steps !== null).length,
        oldestFetchedAt: times[0] || null, newestFetchedAt: times.at(-1) || null,
        latestAttemptAt: latest?.finished_at || null, latestAttemptOutcome: latest?.outcome || null, latestErrorCode: latest?.error_code || null },
    };
  }
  return Object.freeze({ activate, activeScope, save, failed, read, schemaVersion: () => 1, close: () => db.close() });
}
module.exports = { createStepsRepository, scopeForKey };
