'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createStepsRepository, scopeForKey } = require('../lib/steps-repository.cjs');
const { createStepsService } = require('../lib/steps-service.cjs');
const { GarminError } = require('../lib/garmin.cjs');
const { stepsCsv } = require('../lib/csv.cjs');
const key = 'GCDC_test-account-a', scope = scopeForKey(key);
const snapshot = (steps = 1200, at = '2026-10-28T10:00:00.000Z') => ({ from: '2026-10-27', to: '2026-10-28', fetchedAt: at, days: [
  { date: '2026-10-27', steps, goal: 8000, distanceMeters: steps === null ? null : 900 },
  { date: '2026-10-28', steps: 0, goal: 8000, distanceMeters: 0 },
] });
function database(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stepquest-db-test-'));
  const filename = path.join(directory, 'stepquest.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return filename;
}
test('SQLite conserva passi, zero e timestamp dopo chiusura e riapertura', t => {
  const filename = database(t);
  let repo = createStepsRepository(filename); repo.activate(scope); repo.save(scope, snapshot()); repo.close();
  repo = createStepsRepository(filename);
  try {
    const result = repo.read(scope, '2026-10-27', '2026-10-28');
    assert.equal(result.days[0].steps, 1200); assert.equal(result.days[1].steps, 0);
    assert.equal(result.cache.storedDays, 2); assert.equal(result.cache.dataDays, 2);
    assert.equal(result.source, 'cache'); assert.equal(result.fetchedAt, snapshot().fetchedAt);
    assert.equal(repo.activeScope(), scope); assert.equal(repo.schemaVersion(), 1);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  } finally { repo.close(); }
});
test('sync ripetuto è idempotente; correzioni Garmin generano revisioni distinte', t => {
  const filename = database(t), repo = createStepsRepository(filename);
  try {
    repo.save(scope, snapshot()); repo.save(scope, snapshot(1200, '2026-10-28T11:00:00.000Z'));
    assert.equal(repo.read(scope, '2026-10-27', '2026-10-28').days[0].revision, 1);
    repo.save(scope, snapshot(900, '2026-10-28T12:00:00.000Z'));
    const result = repo.read(scope, '2026-10-27', '2026-10-28');
    assert.equal(result.days[0].steps, 900); assert.equal(result.days[0].revision, 2);
    const inspect = new DatabaseSync(filename);
    assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM daily_steps').get().count, 2);
    assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM step_revisions').get().count, 3);
    assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM sync_runs').get().count, 3);
    inspect.close();
  } finally { repo.close(); }
});
test('snapshot meno recente non sovrascrive osservazioni nuove', t => {
  const repo = createStepsRepository(database(t));
  try {
    repo.save(scope, snapshot(2200, '2026-10-28T12:00:00.000Z')); repo.save(scope, snapshot());
    assert.equal(repo.read(scope, '2026-10-27', '2026-10-28').days[0].steps, 2200);
  } finally { repo.close(); }
});
test('assenza Garmin e giorno mai scaricato rimangono distinti da zero', t => {
  const repo = createStepsRepository(database(t));
  try {
    repo.save(scope, snapshot(null));
    const result = repo.read(scope, '2026-10-26', '2026-10-28');
    assert.deepEqual(result.days.map(row => [row.steps, row.availability]), [[null, 'not_downloaded'], [null, 'no_data'], [0, 'available']]);
    assert.equal(result.cache.storedDays, 2); assert.equal(result.cache.dataDays, 1);
    assert.ok(stepsCsv(result).includes('2026-10-28;0;8000;0'));
  } finally { repo.close(); }
});
test('una transazione interrotta non salva un intervallo parziale', t => {
  const filename = database(t), repo = createStepsRepository(filename);
  repo.activate(scope);
  const inspect = new DatabaseSync(filename);
  inspect.exec("CREATE TRIGGER fail_second BEFORE INSERT ON daily_steps WHEN NEW.calendar_date='2026-10-28' BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END");
  try {
    assert.throws(() => repo.save(scope, snapshot()));
    assert.equal(repo.read(scope, '2026-10-27', '2026-10-28').cache.storedDays, 0);
    assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM step_revisions').get().count, 0);
    assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM sync_runs').get().count, 0);
  } finally { inspect.close(); repo.close(); }
});
test('chiavi diverse non condividono storico o correzioni', t => {
  const repo = createStepsRepository(database(t));
  try {
    repo.save(scope, snapshot());
    const other = scopeForKey('GCDC_other-account'); repo.activate(other);
    assert.equal(repo.read(other, '2026-10-27', '2026-10-28').cache.storedDays, 0);
    assert.equal(repo.read(scope, '2026-10-27', '2026-10-28').days[0].steps, 1200);
    assert.equal(scopeForKey(` ${key} `), scope); assert.equal(scopeForKey(''), null);
    assert.equal(JSON.stringify(repo.read(scope, '2026-10-27', '2026-10-28')).includes(key), false);
  } finally { repo.close(); }
});
test('sync riuscito persiste e fallback offline riaperto non cambia data di freschezza', async t => {
  const filename = database(t);
  let repo = createStepsRepository(filename);
  let service = createStepsService({ repository: repo, apiKey: key, client: { getSteps: async () => snapshot() } });
  assert.equal((await service.sync('2026-10-27', '2026-10-28')).source, 'garmin'); repo.close();
  repo = createStepsRepository(filename);
  service = createStepsService({ repository: repo, apiKey: key, now: () => Date.parse('2026-10-29T10:00:00Z'), client: { getSteps: async () => { throw new GarminError('NETWORK', 'Rete non disponibile.'); } } });
  try {
    assert.equal(service.read('2026-10-27', '2026-10-28').days[0].steps, 1200);
    const offline = await service.sync('2026-10-27', '2026-10-28');
    assert.equal(offline.source, 'cache'); assert.equal(offline.sync.state, 'offline');
    assert.equal(offline.fetchedAt, snapshot().fetchedAt); assert.equal(offline.cache.latestAttemptOutcome, 'failure');
    assert.equal(offline.cache.latestErrorCode, 'NETWORK'); assert.equal(offline.days[0].revision, 1);
  } finally { repo.close(); }
});
test('senza cache non inventa una sincronizzazione riuscita; scope attivo funziona senza chiave', async t => {
  const repo = createStepsRepository(database(t));
  try {
    const client = { getSteps: async () => { throw new GarminError('NO_KEY', 'Chiave assente.'); } };
    const fresh = createStepsService({ repository: repo, apiKey: key, client });
    await assert.rejects(fresh.sync('2026-10-27', '2026-10-28'), error => error.code === 'NO_KEY');
    repo.save(scope, snapshot());
    const restored = createStepsService({ repository: repo, apiKey: '', client });
    assert.equal((await restored.sync('2026-10-27', '2026-10-28')).sync.state, 'offline');
  } finally { repo.close(); }
});
test('versione schema futura rifiutata senza cancellare dati', t => {
  const filename = database(t);
  const db = new DatabaseSync(filename); db.exec('PRAGMA user_version=99; CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES (\'kept\');'); db.close();
  assert.throws(() => createStepsRepository(filename), /versione più recente/);
  const inspect = new DatabaseSync(filename); assert.equal(inspect.prepare('SELECT value FROM sentinel').get().value, 'kept'); inspect.close();
});
