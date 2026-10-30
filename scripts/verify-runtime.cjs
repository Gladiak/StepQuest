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

// Exercise the installed application itself, not the source checkout. This entry
// point is shipped in electron/ and always uses an isolated temporary profile.
const env={...process.env,GARMIN_API_KEY:''};delete env.ELECTRON_RUN_AS_NODE;
const progressPath=path.resolve('artifacts',`packaged-progress-${process.platform}-${process.arch}.json`);
require('node:fs').mkdirSync(path.dirname(progressPath),{recursive:true});
require('node:fs').rmSync(progressPath,{force:true});env.STEPQUEST_SMOKE_REPORT=progressPath;
const args=['--smoke-test'];if(process.platform==='linux'&&process.env.CI)args.push('--no-sandbox');
const ui=spawnSync(executable,args,{env,encoding:'utf8',timeout:90000});
const progress=require('node:fs').existsSync(progressPath)?JSON.parse(require('node:fs').readFileSync(progressPath,'utf8')):null;
assert.ifError(ui.error&&new Error(`${ui.error.message}; last stage: ${JSON.stringify(progress)}; stderr: ${ui.stderr}; stdout: ${ui.stdout}`));assert.equal(ui.status,0,`Packaged UI failed: ${JSON.stringify(progress)}\n${ui.stderr}\n${ui.stdout}`);
const line=ui.stdout.split(/\r?\n/).find(value=>value.startsWith('{"packaged":true'));
const report=progress?.stage==='complete'?progress.result:line?JSON.parse(line):null;
assert.ok(report,`Missing packaged UI report: ${JSON.stringify(progress)}\n${ui.stdout}`);assert.equal(report.version,require('../package.json').version);assert.equal(report.rendererErrors,0);
for(const area of ['mine','smith','arena','guild','atlas','chronicles'])assert.equal(report[area],true,`Missing packaged check: ${area}`);assert.equal(report.backgrounds,6);
// Windows locks Chromium profile files until the process exits. Delete only the
// synthetic profile reported by this invocation, after all app handles are gone.
if(progress?.profile){assert.equal(path.resolve(path.dirname(progress.profile)),path.resolve(require('node:os').tmpdir()));assert.ok(path.basename(progress.profile).startsWith('stepquest-smoke-'));require('node:fs').rmSync(progress.profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
require('node:fs').mkdirSync('artifacts',{recursive:true});require('node:fs').writeFileSync(path.join('artifacts',`packaged-runtime-${process.platform}-${process.arch}.json`),JSON.stringify(report,null,2)+'\n');console.log('Packaged UI verified:',report);

// Record a reproducible checkpoint and reject stale build output. package.json is
// normalized by electron-builder, so its version is checked above instead.
const fs=require('node:fs'),{createHash}=require('node:crypto'),{listPackage,statFile,extractFile}=require('@electron/asar');
const resources=process.platform==='darwin'?path.resolve(path.dirname(executable),'../Resources'):path.join(path.dirname(executable),'resources'),archive=path.join(resources,'app.asar'),digest=createHash('sha256');let sourceFiles=0;
for(const name of listPackage(archive).map(n=>n.replaceAll('\\','/').replace(/^\//,'')).sort()){
 const archiveName=name.split('/').join(path.sep);if(statFile(archive,archiveName).files||name==='package.json')continue;
 const built=extractFile(archive,archiveName),source=fs.readFileSync(path.resolve(name));assert.ok(built.equals(source),`Packaged source differs from workspace: ${name}`);digest.update(name+'\0');digest.update(createHash('sha256').update(source).digest());sourceFiles++;
}
const checkpoint={files:sourceFiles,sha256:digest.digest('hex')};report.sourceCheckpoint=checkpoint;fs.writeFileSync(path.join('artifacts',`packaged-runtime-${process.platform}-${process.arch}.json`),JSON.stringify(report,null,2)+'\n');console.log('Packaged source checkpoint:',checkpoint);
