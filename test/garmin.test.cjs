'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGarminClient, normalizeSteps, BASE_URL, TOKEN_PATH } = require('../lib/garmin.cjs');
const { dateRange, shiftDate, today } = require('../lib/dates.cjs');
const { stepsCsv } = require('../lib/csv.cjs');
const NOW = Date.parse('2026-10-28T10:00:00Z');
const jwt = expiry => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: expiry })).toString('base64url')}.c2lnbmF0dXJl`;
const validJwt = jwt(NOW / 1000 + 86400);
const key = 'GCDC_test-key';
function mockClient(handler, options = {}) {
  const calls = [];
  const client = createGarminClient({ apiKey: key, now: () => NOW, ...options, fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    return handler(url.replace(BASE_URL, ''), init, calls);
  } });
  return { client, calls };
}
const json = value => new Response(JSON.stringify(value), { status: 200 });
const recorded=(id,extra={})=>({activityId:id,startTimeLocal:'2026-10-28 09:00:00',startTimeGMT:'2026-10-28 08:00:00',duration:1200,elapsedDuration:1250,distance:2000,elevationGain:10,activityType:{typeKey:'walking'},manualActivity:false,parentId:null,...extra});

test('identità Garmin: usa solo userProfilePk autenticato, cache e rifiuto di identità discordanti',async()=>{
 const {client,calls}=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json({data:[{userProfilePk:123},{userProfilePk:123}]}));assert.equal(await client.getAccountIdentity('2026-10-28'),'123');assert.equal(await client.getAccountIdentity('2026-10-28'),'123');assert.equal(calls.filter(c=>c.method==='GET').length,1);
 for(const data of [[{userProfilePk:123},{userProfilePk:456}],[{userProfilePk:-1}]]){const f=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json({data}));await assert.rejects(f.client.getAccountIdentity('2026-10-28'),e=>e.code==='INVALID_RESPONSE');}
 const empty=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json({data:[]}));assert.equal(await empty.client.getAccountIdentity('2026-10-28'),null);
});
test('attività: paginazione completa, ID unici, solo riepiloghi e nessun nome o GPS nel risultato',async()=>{
 const page=Array.from({length:50},(_,i)=>recorded(i+1,{activityName:'PRIVATE',startLatitude:42}));const {client,calls}=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json(path.includes('start=0&')?page:[page[0],recorded(51)]));const result=await client.getActivities('2026-10-28','2026-10-28');assert.equal(result.activities.length,51);assert.equal(result.activities[0].kind,'walk');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes('Latitude'),false);assert.ok(calls.filter(c=>c.method==='GET').every(c=>c.url.includes('excludeChildren=true')));
});
test('attività: ignora manuali, figli multisport e sessioni future; mantiene data locale e UTC',async()=>{
 const {client}=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json([recorded(1,{manualActivity:true}),recorded(2,{parentId:99}),recorded(3,{startTimeLocal:'2026-10-28 15:00:00',startTimeGMT:'2026-10-28 14:00:00'}),recorded(4,{startTimeLocal:'2026-10-28 01:00:00',startTimeGMT:'2026-10-27 23:00:00',activityType:{typeKey:'lap_swimming'}})]));const result=await client.getActivities('2026-10-28','2026-10-28');assert.equal(result.activities.length,1);assert.equal(result.activities[0].date,'2026-10-28');assert.equal(result.activities[0].startedAt,Date.parse('2026-10-27T23:00:00Z'));assert.equal(result.activities[0].kind,'swim');
});
test('attività: risposte malformate, durate invalide e copie discordanti non danno risultati parziali',async()=>{
 for(const payload of [{data:[]},[recorded(1,{duration:-1})],[recorded(1),recorded(1,{distance:3000})],[recorded(1,{activityId:Number.MAX_SAFE_INTEGER+1})],[recorded(1,{startTimeGMT:'2026-10-28 99:00:00'})]]){const {client}=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json(payload));await assert.rejects(client.getActivities('2026-10-28','2026-10-28'),e=>e.code==='INVALID_RESPONSE');}
});
test('attività: lookback massimo di sette giorni e limite pagine esplicito',async()=>{
 const {client,calls}=mockClient(path=>path===TOKEN_PATH?new Response(validJwt):json(Array.from({length:50},(_,i)=>recorded(i+1))));await assert.rejects(client.getActivities('2026-10-20','2026-10-28'));assert.equal(calls.length,0);await assert.rejects(client.getActivities('2026-10-28','2026-10-28'),e=>e.code==='ACTIVITY_LIMIT');assert.equal(calls.filter(c=>c.method==='GET').length,20);
});

test('autenticazione ApiKey senza corpo, JWT in testo e lettura Bearer', async () => {
  const { client, calls } = mockClient((path, init) => {
    if (path === TOKEN_PATH) {
      assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, `ApiKey ${key}`); assert.equal(init.body, undefined);
      return new Response(` ${validJwt}\n`);
    }
    assert.equal(init.headers.Authorization, `Bearer ${validJwt}`);
    assert.equal(init.redirect, 'error');
    return json([{ calendarDate: '2026-10-28', totalSteps: 1234, stepGoal: 8000, totalDistance: 900 }]);
  });
  const result = await client.getSteps('2026-10-28', '2026-10-28');
  assert.deepEqual(result.days, [{ date: '2026-10-28', steps: 1234, goal: 8000, distanceMeters: 900 }]);
  await client.getSteps('2026-10-28', '2026-10-28');
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(JSON.stringify(client.status()).includes(validJwt), false);
});
test('richieste concorrenti condividono una sola emissione token', async () => {
  const { client, calls } = mockClient(path => path === TOKEN_PATH ? new Response(validJwt) : json([]));
  await Promise.all([client.getSteps('2026-10-28', '2026-10-28'), client.getSteps('2026-10-27', '2026-10-27')]);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});
test('30 giorni suddivisi in 28 + 2 con estremi inclusivi', async () => {
  const { client, calls } = mockClient(path => path === TOKEN_PATH ? new Response(validJwt) : json([]));
  const result = await client.getSteps('2026-09-29', '2026-10-28');
  assert.equal(result.days.length, 30);
  assert.deepEqual(calls.filter(call => call.method === 'GET').map(call => call.url.replace(BASE_URL, '')), [
    '/usersummary-service/stats/steps/daily/2026-09-29/2026-10-26',
    '/usersummary-service/stats/steps/daily/2026-10-27/2026-10-28',
  ]);
});
test('401 rinnova il token e riprova una sola volta', async () => {
  const { client, calls } = mockClient(path => path === TOKEN_PATH ? new Response(validJwt) : new Response('unauthorized', { status: 401 }));
  await assert.rejects(client.getSteps('2026-10-28', '2026-10-28'), error => error.status === 401);
  assert.equal(calls.filter(call => call.method === 'POST').length, 2);
  assert.equal(calls.filter(call => call.method === 'GET').length, 2);
});
test('401 seguito da token nuovo permette il download', async () => {
  let reads = 0;
  const { client } = mockClient(path => path === TOKEN_PATH ? new Response(validJwt) : ++reads === 1 ? new Response(null, { status: 401 }) : json([]));
  assert.equal((await client.getSteps('2026-10-28', '2026-10-28')).days.length, 1);
});
test('token prossimo alla scadenza viene rinnovato', async () => {
  let clock = NOW;
  const { client, calls } = mockClient(path => path === TOKEN_PATH ? new Response(jwt(clock / 1000 + 120)) : json([]), { now: () => clock });
  await client.getSteps('2026-10-28', '2026-10-28'); clock += 115000;
  await client.getSteps('2026-10-28', '2026-10-28');
  assert.equal(calls.filter(call => call.method === 'POST').length, 2);
});
test('429 rispetta Retry-After senza inviare altre richieste', async () => {
  const { client, calls } = mockClient(() => new Response('limited', { status: 429, headers: { 'retry-after': '120' } }));
  await assert.rejects(client.getSteps('2026-10-28', '2026-10-28'), error => error.retryAt === NOW + 120000);
  await assert.rejects(client.getSteps('2026-10-28', '2026-10-28'), error => error.code === 'RATE_LIMIT');
  assert.equal(calls.length, 1);
});
test('nessun dato è distinto da zero passi e assenza obiettivo', () => {
  assert.deepEqual(normalizeSteps([{ calendarDate: '2026-10-27', totalSteps: 0 }, {}], ['2026-10-27', '2026-10-28']), [
    { date: '2026-10-27', steps: 0, goal: null, distanceMeters: null },
    { date: '2026-10-28', steps: null, goal: null, distanceMeters: null },
  ]);
});
test('204 rappresenta intervallo privo di dati', async () => {
  const { client } = mockClient(path => path === TOKEN_PATH ? new Response(validJwt) : new Response(null, { status: 204 }));
  assert.equal((await client.getSteps('2026-10-28', '2026-10-28')).days[0].steps, null);
});
test('rifiuta dati negativi, frazioni, fuori intervallo o duplicati discordanti', () => {
  for (const rows of [
    [{ calendarDate: '2026-10-28', totalSteps: -1 }], [{ calendarDate: '2026-10-28', totalSteps: 1.5 }],
    [{ calendarDate: '2026-10-29', totalSteps: 1 }],
    [{ calendarDate: '2026-10-28', totalSteps: 1 }, { calendarDate: '2026-10-28', totalSteps: 2 }],
  ]) assert.throws(() => normalizeSteps(rows, ['2026-10-28']), error => error.code === 'INVALID_RESPONSE');
});
test('rifiuta token scaduti o risposta OAuth JSON inattesa', async () => {
  for (const body of [jwt(NOW / 1000 - 1), '{"access_token":"secret"}', 'invalid']) {
    const { client } = mockClient(() => new Response(body));
    await assert.rejects(client.getSteps('2026-10-28', '2026-10-28'), error => error.code === 'INVALID_TOKEN' && !error.message.includes('secret'));
  }
});
test('errori di rete e HTML non espongono credenziali o corpi provider', async () => {
  const { client } = mockClient(() => { throw new Error(`Secret ${key}`); });
  await assert.rejects(client.getSteps('2026-10-28', '2026-10-28'), error => error.code === 'NETWORK' && !error.message.includes(key));
  const invalid = mockClient(path => path === TOKEN_PATH ? new Response(validJwt) : new Response('<html>secret</html>')).client;
  await assert.rejects(invalid.getSteps('2026-10-28', '2026-10-28'), error => error.code === 'INVALID_RESPONSE' && !error.message.includes('secret'));
});
test('chiave assente non invia richieste', async () => {
  const { client, calls } = mockClient(() => { throw new Error(); }, { apiKey: '' });
  await assert.rejects(client.getSteps('2026-10-28', '2026-10-28'), error => error.code === 'NO_KEY');
  assert.equal(calls.length, 0);
});
test('date impossibili, ordine errato e intervalli eccessivi rifiutati prima della rete', async () => {
  const { client, calls } = mockClient(() => { throw new Error(); });
  for (const range of [['2026-02-30', '2026-03-01'], ['2026-10-28', '2026-10-27'], ['2025-01-01', '2026-10-28']]) await assert.rejects(client.getSteps(...range));
  assert.equal(calls.length, 0);
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(dateRange('2026-10-24', '2026-10-26').length, 3);
  assert.match(today('Europe/Rome'), /^\d{4}-\d{2}-\d{2}$/);
});
test('CSV mantiene zero e campi mancanti e usa separatori italiani', () => {
  assert.equal(stepsCsv({ days: [{ date: '2026-10-28', steps: 0, goal: null, distanceMeters: 0 }] }), '\uFEFFdata;passi;obiettivo_passi;distanza_metri\r\n2026-10-28;0;;0\r\n');
});

test('metriche giornaliere: usa stesso token, date esatte e normalizza sonno/stress/intensità',async()=>{
 const date='2026-10-28';const {client,calls}=mockClient(url=>{
  if(url===TOKEN_PATH)return new Response(validJwt);
  if(url.startsWith('/usersummary-service/v2/dailysummaries?'))return Response.json({data:[{calendarDate:date,intensityMinutes:{moderate:20,vigorous:5}},{calendarDate:'2026-10-27',stress:{avgLevel:65,restDurationInMillis:21600000}}]});
  return Response.json({calendarDate:date,sleepWindowConfirmed:true,sleepScores:{overall:{value:85}},sleepTimeSeconds:28000});
 });
 const m=await client.getDailyWellness(date);assert.equal(m.moderate,20);assert.equal(m.sleepScore,85);assert.equal(m.stress,65);assert.equal(calls.filter(c=>c.method==='POST').length,1);
 assert.ok(calls[1].url.includes('startDate=2026-10-27&endDate=2026-10-28'));assert.ok(calls[2].url.endsWith('dailySleep?date=2026-10-28'));
});
test('metriche giornaliere: errore sonno non perde intensità, formato summary inatteso rifiutato',async()=>{
 const {client}=mockClient(url=>url===TOKEN_PATH?new Response(validJwt):url.includes('dailysummaries')?Response.json({data:[{calendarDate:'2026-10-28',intensityMinutes:{moderate:30,vigorous:0}}]}):new Response('',{status:503}));
 const m=await client.getDailyWellness('2026-10-28');assert.equal(m.sleepUnavailable,true);assert.equal(m.sleepScore,null);assert.equal(m.moderate,30);
 const malformed=mockClient(url=>url===TOKEN_PATH?new Response(validJwt):Response.json({invalid:true}));await assert.rejects(malformed.client.getDailyWellness('2026-10-28'),e=>e.code==='INVALID_RESPONSE');
});
