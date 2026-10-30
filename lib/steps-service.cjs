'use strict';
const { dateRange,shiftDate } = require('./dates.cjs');
const { scopeForKey } = require('./steps-repository.cjs');
const { GarminError } = require('./garmin.cjs');

function createStepsService({ repository, client, apiKey, now = Date.now }) {
  let source = client;
  let keyScope=scopeForKey(apiKey),scope = keyScope?repository.resolveScope(keyScope):repository.activeScope();
  if (scopeForKey(apiKey)) repository.activate(scope, new Date(now()).toISOString());
  const time = () => new Date(now()).toISOString();
  return Object.freeze({
    async syncWellness(day) { if(!source.getDailyWellness)throw new GarminError('UNAVAILABLE','Metriche Garmin non disponibili.');return source.getDailyWellness(day); },
    read(from, to) { return repository.read(scope, from, to); },
    async sync(from, to) {
      dateRange(from, to);
      const started = time();
      let result;
      try {
        if(source.getAccountIdentity&&keyScope){
          let identity;try{identity=await source.getAccountIdentity(to);}catch(error){if(error.code==='RATE_LIMIT')throw error;}
          if(identity){scope=repository.bindIdentity(keyScope,identity,time());repository.activate(scope,time());}
        }
        result = await source.getSteps(from, to);
      }
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
    async syncGuild(day,{includeHistory=true}={}){
      const from=shiftDate(day,-6);let history='online';
      if(includeHistory){try{const result=await source.getSteps(from,shiftDate(day,-1));repository.save(scope,result);}catch{history='partial';}}else history='not_requested';
      if(!source.getActivities||!repository.identityVerified(scope)){
        repository.activitySyncFailed(scope,'unavailable',time(),'UNAVAILABLE');return {activities:'unavailable',history};
      }
      try{const result=await source.getActivities(from,day);repository.saveActivities(scope,result);return {activities:'online',history};}
      catch(error){const state=error.code==='NETWORK'?'offline':'unavailable';repository.activitySyncFailed(scope,state,time(),error.code);return {activities:state,history};}
    },
    replaceAccount(nextClient, key, verifiedResult,identity=null) {
      const nextKeyScope=scopeForKey(key),nextScope = identity?repository.bindIdentity(nextKeyScope,identity,time()):repository.resolveScope(nextKeyScope);
      repository.save(nextScope, verifiedResult);
      repository.activate(nextScope, time());
      source = nextClient; scope = nextScope;keyScope=nextKeyScope;
      return { ...repository.read(scope, verifiedResult.from, verifiedResult.to), source: 'garmin', sync: { state: 'online' } };
    },
    info() { return { sqlite: true, schemaVersion: repository.schemaVersion(), accountScopeAvailable: Boolean(scope) }; },
  });
}
module.exports = { createStepsService };
