'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCredentialsRepository } = require('../lib/credentials-repository.cjs');
const { createStepsRepository, scopeForKey } = require('../lib/steps-repository.cjs');
const { createCharactersRepository } = require('../lib/characters.cjs');
const key = `GCDC_${'test'.repeat(12)}`;

test('chiave SQLite: persiste al riavvio, sostituisce il valore e conserva passi e personaggi', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-credentials-'));
  const filename = path.join(dir, 'stepquest.sqlite');
  const steps = createStepsRepository(filename);
  const characters = createCharactersRepository(filename);
  let credentials = createCredentialsRepository(filename);
  try {
    const hero = characters.create({ name: 'Elara', classId: 'arcanist', sex: 'female' });
    const scope = scopeForKey(key);
    steps.activate(scope);
    steps.save(scope, { from: '2026-10-28', to: '2026-10-28', fetchedAt: '2026-10-28T12:00:00Z',
      days: [{ date: '2026-10-28', steps: 4200, goal: 6000, distanceMeters: 3000 }] });
    assert.equal(credentials.readKey(), '');
    credentials.saveKey(`  ${key}  `);
    credentials.close();
    credentials = createCredentialsRepository(filename);
    assert.equal(credentials.readKey(), key);
    credentials.saveKey(`${key}.replacement`);
    assert.equal(credentials.readKey(), `${key}.replacement`);
    assert.equal(characters.get(hero.id).name, 'Elara');
    assert.equal(steps.read(scope, '2026-10-28', '2026-10-28').days[0].steps, 4200);
    if (process.platform !== 'win32') assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  } finally {
    credentials.close(); characters.close(); steps.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('chiave SQLite: input non valido non sovrascrive la configurazione', () => {
  const credentials = createCredentialsRepository(':memory:');
  try {
    credentials.saveKey(key);
    for (const invalid of [null, {}, '', 'secret', "GCDC_'; DROP TABLE local_credentials;--"]) {
      assert.throws(() => credentials.saveKey(invalid), { message: 'Chiave Garmin non valida.' });
      assert.equal(credentials.readKey(), key);
    }
  } finally { credentials.close(); }
});
