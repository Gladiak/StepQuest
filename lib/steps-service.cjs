'use strict';
const { dateRange } = require('./dates.cjs');
const { scopeForKey } = require('./steps-repository.cjs');
const { GarminError } = require('./garmin.cjs');

function createStepsService({ repository, client, apiKey, now = Date.now }) {
  let source = client;
  let scope = scopeForKey(apiKey) || repository.activeScope();
  if (scopeForKey(apiKey)) repository.activate(scope, new Date(now()).toISOString());
  const time = () => new Date(now()).toISOString();
  return Object.freeze({
    async syncWellness(day) { if(!source.getDailyWellness)throw new GarminError('UNAVAILABLE','Metriche Garmin non disponibili.');return source.getDailyWellness(day); },
    read(from, to) { return repository.read(scope, from, to); },
    async sync(from, to) {
      dateRange(from, to);
      const started = time();
      let result;
      try { result = await source.getSteps(from, to); }
      catch (error) {
        if (scope) repository.failed(scope, from, to, started, time(), error.code);
        const cached = repository.read(scope, from, to);
        if (!cached.cache.storedDays) throw error;
        return { ...cached, sync: { state: 'offline', error: { code: error.code || 'SYNC_ERROR', message: error.message, retryAt: error.retryAt || null } } };
      }
      if (!scope) throw new GarminError('NO_KEY', 'La chiave Garmin non è configurata.');
      try { repository.save(scope, result, started); }
      catch { throw new GarminError('DATABASE', 'Passi scaricati, ma il salvataggio SQLite non è riuscito. Riprova senza chiudere l’app.'); }
      return { ...repository.read(scope, from, to), source: 'garmin', sync: { state: 'online' } };
    },
    replaceAccount(nextClient, key, verifiedResult) {
      const nextScope = scopeForKey(key);
      repository.save(nextScope, verifiedResult);
      repository.activate(nextScope, time());
      source = nextClient; scope = nextScope;
      return { ...repository.read(scope, verifiedResult.from, verifiedResult.to), source: 'garmin', sync: { state: 'online' } };
    },
    info() { return { sqlite: true, schemaVersion: repository.schemaVersion(), accountScopeAvailable: Boolean(scope) }; },
  });
}
module.exports = { createStepsService };
