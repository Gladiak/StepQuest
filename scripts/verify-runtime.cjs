'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const relative = {
  darwin: `mac${process.arch === 'arm64' ? '-arm64' : ''}/StepQuest.app/Contents/MacOS/StepQuest`,
  win32: 'win-unpacked/StepQuest.exe',
  linux: 'linux-unpacked/stepquest',
}[process.platform];
assert(relative, `Unsupported platform: ${process.platform}`);
const executable = path.resolve('dist', relative);
// Exercise the shipped Electron/Node runtime without opening a window or profile.
const result = spawnSync(executable, ['-e', `
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const result = db.prepare('SELECT 1 AS ok').get();
  if (result.ok !== 1) process.exit(1);
  db.close();
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, sqlite: true }));
`], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', GARMIN_API_KEY: '' },
  encoding: 'utf8',
  timeout: 30000,
});
if (result.error) throw result.error;
assert.equal(result.status, 0, `Packaged runtime failed: ${result.stderr}`);
const info = JSON.parse(result.stdout.trim());
assert.equal(info.platform, process.platform);
assert.equal(info.arch, process.arch);
assert.equal(info.sqlite, true);
console.log('Packaged runtime verified:', info);
