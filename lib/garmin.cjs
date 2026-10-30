'use strict';
const {normalizeWellness}=require('./daily-effects.cjs');
const {normalizeActivity}=require('./garmin-activities.cjs');
const { dateRange, validDate, shiftDate } = require('./dates.cjs');
const BASE_URL = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
class GarminError extends Error {
  constructor(code, message, extras = {}) { super(message); this.code = code; Object.assign(this, extras); }
}
function normalizeSteps(payload, days) {
  if (!Array.isArray(payload)) throw new GarminError('INVALID_RESPONSE', 'Garmin ha restituito un formato inatteso per i passi.');
  const records = new Map(days.map(date => [date, { date, steps: null, goal: null, distanceMeters: null }]));
  const seen = new Set();
  const measure = value => value == null ? null : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : NaN;
  for (const row of payload) {
    if (!row || typeof row !== 'object') throw new GarminError('INVALID_RESPONSE', 'Riga Garmin non valida.');
    if (!row.calendarDate && row.totalSteps == null && row.stepGoal == null && row.totalDistance == null) continue;
    if (!records.has(row.calendarDate)) throw new GarminError('INVALID_RESPONSE', 'Garmin ha restituito una data fuori intervallo.');
    const record = { date: row.calendarDate, steps: measure(row.totalSteps), goal: measure(row.stepGoal), distanceMeters: measure(row.totalDistance) };
    if (Object.values(record).some(value => typeof value === 'number' && !Number.isFinite(value))
      || (record.steps !== null && !Number.isSafeInteger(record.steps))
      || (record.goal !== null && !Number.isSafeInteger(record.goal))) {
      throw new GarminError('INVALID_RESPONSE', 'Garmin ha restituito misure non valide.');
    }
    if (seen.has(record.date) && JSON.stringify(records.get(record.date)) !== JSON.stringify(record)) {
      throw new GarminError('INVALID_RESPONSE', 'Garmin ha restituito riepiloghi discordanti per lo stesso giorno.');
    }
    records.set(record.date, record); seen.add(record.date);
  }
  return [...records.values()];
}
function createGarminClient({ apiKey, fetchImpl = fetch, now = Date.now, timeoutMs = 20000 } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  let token = null, pendingToken = null, retryAt = 0, identity = null;
  async function request(path, method, authorization) {
    if (now() < retryAt) throw new GarminError('RATE_LIMIT', 'Limite Garmin raggiunto. Attendi prima di riprovare.', { retryAt });
    let response;
    try {
      response = await fetchImpl(`${BASE_URL}${path}`, {
        method, headers: { Authorization: authorization, Accept: method === 'POST' ? '*/*' : 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new GarminError('NETWORK', error.name === 'TimeoutError' ? 'Garmin non ha risposto in tempo. Riprova.' : 'Connessione a Garmin non riuscita. Controlla la rete.');
    }
    if (!response.ok) {
      if (response.status === 429) {
        const value = response.headers.get('retry-after');
        const seconds = value === null ? NaN : Number(value);
        const date = Date.parse(value);
        retryAt = Math.max(now() + 1000, Number.isFinite(seconds) ? now() + seconds * 1000 : Number.isFinite(date) ? date : now() + 60000);
      }
      await response.body?.cancel();
      const messages = {
        401: 'Accesso Garmin non autorizzato. Verifica che la chiave sia valida e non scaduta.',
        403: 'Accesso negato da Garmin. Verifica i permessi della chiave Personal API.',
        429: 'Limite di richieste Garmin raggiunto. Attendi prima di riprovare.',
      };
      throw new GarminError(response.status === 429 ? 'RATE_LIMIT' : 'HTTP', messages[response.status] || `Servizio Garmin non disponibile (HTTP ${response.status}).`, { status: response.status, retryAt: retryAt || null });
    }
    if (response.status === 204) return '';
    const limit = method === 'POST' ? 65536 : 8 * 1024 * 1024;
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) { await reader.cancel(); throw new GarminError('INVALID_RESPONSE', 'Risposta Garmin troppo grande.'); }
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      if (error instanceof GarminError) throw error;
      throw new GarminError('NETWORK', 'Download Garmin interrotto. Riprova.');
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async function obtainToken() {
    if (!key) throw new GarminError('NO_KEY', 'Inserisci la tua chiave Garmin Personal API nelle impostazioni.');
    const jwt = (await request(TOKEN_PATH, 'POST', `ApiKey ${key}`)).trim();
    let expiresAt;
    try {
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) throw new Error();
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      if (typeof payload.exp !== 'number') throw new Error();
      expiresAt = payload.exp * 1000;
      if (!Number.isFinite(expiresAt) || expiresAt <= now() || expiresAt > 8.64e15) throw new Error();
    } catch { throw new GarminError('INVALID_TOKEN', 'Garmin ha restituito un token privo di una scadenza valida.'); }
    token = { jwt, expiresAt, refreshAt: expiresAt - Math.min(60000, (expiresAt - now()) / 10) };
    return token;
  }
  async function getToken() {
    if (pendingToken) return pendingToken;
    if (token && now() < token.refreshAt) return token;
    pendingToken = obtainToken().finally(() => { pendingToken = null; });
    return pendingToken;
  }
  async function get(path) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await getToken();
      try {
        const body = await request(path, 'GET', `Bearer ${current.jwt}`);
        if (!body.trim()) return null;
        try { return JSON.parse(body); }
        catch { throw new GarminError('INVALID_RESPONSE', 'Garmin ha restituito una risposta JSON non valida.'); }
      } catch (error) {
        if (error.status === 401) {
          if (token === current) token = null;
          if (attempt === 0) continue;
        }
        throw error;
      }
    }
  }
  return Object.freeze({
    async getAccountIdentity(day){
      validDate(day);if(identity)return identity;
      const summary=await get(`/usersummary-service/v2/dailysummaries?startDate=${shiftDate(day,-6)}&endDate=${day}`);
      if(summary===null)return null;
      if(!Array.isArray(summary.data))throw new GarminError('INVALID_RESPONSE','Identità Garmin non disponibile.');
      const ids=new Set(summary.data.map(row=>row?.userProfilePk).filter(value=>value!=null));
      if(ids.size>1||[...ids].some(id=>!Number.isSafeInteger(id)||id<=0))throw new GarminError('INVALID_RESPONSE','Identità Garmin non valida.');
      identity=ids.size?String([...ids][0]):null;return identity;
    },
    async getActivities(from,to){
      dateRange(from,to,7);const records=new Map(),limit=50;
      for(let page=0;page<20;page++){
        const payload=await get(`/activitylist-service/activities/search/activities?start=${page*limit}&limit=${limit}&startDate=${from}&endDate=${to}&excludeChildren=true`);
        const rows=payload===null?[]:payload;
        if(!Array.isArray(rows)||rows.length>limit)throw new GarminError('INVALID_RESPONSE','Elenco attività Garmin non valido.');
        for(const row of rows){let activity;try{activity=normalizeActivity(row,{from,to,now:now()});}catch{throw new GarminError('INVALID_RESPONSE','Riepilogo attività Garmin non valido.');}
          if(activity){const prior=records.get(activity.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(activity))throw new GarminError('INVALID_RESPONSE','Attività Garmin discordanti.');records.set(activity.id,activity);}}
        if(rows.length<limit)return {from,to,activities:[...records.values()],fetchedAt:new Date(now()).toISOString()};
      }
      throw new GarminError('ACTIVITY_LIMIT','Troppe attività Garmin. Riprova più tardi.');
    },
    async getDailyWellness(day) {
      validDate(day);
      const summary=await get(`/usersummary-service/v2/dailysummaries?startDate=${shiftDate(day,-1)}&endDate=${day}`);
      let sleep=null,sleepUnavailable=false;
      try{sleep=await get(`/sleep-service/sleep/dailySleep?date=${day}`);}catch(error){if(error.code==='RATE_LIMIT')throw error;sleepUnavailable=true;}
      if(summary!==null&&!Array.isArray(summary?.data))throw new GarminError('INVALID_RESPONSE','Riepilogo giornaliero Garmin non valido.');
      return {...normalizeWellness(day,summary,sleep,new Date(now()).toISOString()),sleepUnavailable};
    },
    async getSteps(from, to) {
      const days = dateRange(from, to);
      const rows = [];
      for (let i = 0; i < days.length; i += 28) {
        const chunk = days.slice(i, i + 28);
        const payload = await get(`/usersummary-service/stats/steps/daily/${chunk[0]}/${chunk.at(-1)}`);
        rows.push(...normalizeSteps(payload === null ? [] : payload, chunk));
      }
      return { from, to, days: rows, fetchedAt: new Date(now()).toISOString() };
    },
    status() { return { configured: Boolean(key), tokenValid: Boolean(token && now() < token.expiresAt), expiresAt: token ? new Date(token.expiresAt).toISOString() : null }; },
  });
}
module.exports = { createGarminClient, normalizeSteps, GarminError, BASE_URL, TOKEN_PATH };
