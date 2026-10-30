'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function createSmokeHarness(window, { captureDelay = 120 } = {}) {
 const errors = [], checks = [];
 const onConsole = event => { if (event.level === 'error') errors.push(event.message); };
 window.webContents.on('console-message', onConsole);
 if (window.webContents.isLoading()) await new Promise(resolve => window.webContents.once('did-finish-load', resolve));
 const js = code => window.webContents.executeJavaScript(code).catch(error => {
  throw new Error(error.message + ' · ' + code + ' · ' + errors.join(' | '));
 });
 const waitFor = async code => {
  for (let attempt = 0; attempt < 150; attempt++) {
   if (await js(code)) return;
   await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timeout: ' + code + ' · ' + errors.join(' | '));
 };
 const capture = async name => {
  await new Promise(resolve => setTimeout(resolve, captureDelay));
  const directory = path.join(__dirname, '../artifacts');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name + '.png'), (await window.webContents.capturePage()).toPNG());
 };
 const checkContrast = async name => {
  checks.push(await require('./layout-audit.cjs')(window, name));
  await require('./contrast-audit.cjs')(window, name);
 };
 return { js, waitFor, capture, checkContrast, errors, checks,
  dispose: () => window.webContents.removeListener('console-message', onConsole) };
}

function featureSmoke({ name, audit, hero, captureDelay }) {
 return async (window, app) => {
  const harness = await createSmokeHarness(window, { captureDelay });
  try {
   const { js, waitFor, checks, errors } = harness;
   await waitFor("document.body.dataset.screen==='welcome'");
   const response = await js(`window.stepquest.createCharacter(${JSON.stringify(hero)})`);
   assert.equal(response.ok, true, JSON.stringify(response));
   await js(`camp(${JSON.stringify(response.value.id)})`);
   await waitFor("document.body.dataset.screen==='game'");
   await audit({ app, ...harness });
   assert.deepEqual(errors, []);
   console.log(JSON.stringify({ [name]: true, screens: checks.length, rendererErrors: errors.length }));
  } finally { harness.dispose(); }
 };
}

module.exports = { createSmokeHarness, featureSmoke };
