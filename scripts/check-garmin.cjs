'use strict';
const path = require('node:path');
const { createGarminClient } = require('../lib/garmin.cjs');
const { today, shiftDate } = require('../lib/dates.cjs');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
(async () => {
  const end = today();
  const result = await createGarminClient({ apiKey: process.env.GARMIN_API_KEY }).getSteps(shiftDate(end, -6), end);
  console.log(JSON.stringify({ connection: 'ok', from: result.from, to: result.to, daysWithData: result.days.filter(row => row.steps !== null).length, totalSteps: result.days.reduce((sum, row) => sum + (row.steps ?? 0), 0) }, null, 2));
})().catch(error => { console.error(`${error.code || 'ERROR'}: ${error.message}`); process.exitCode = 1; });
