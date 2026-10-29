'use strict';
// Runs only with --smoke-test: main.cjs has already isolated both SQLite and the
// Chromium profile in a new temporary directory before any store is opened.
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),{DatabaseSync}=require('node:sqlite');
module.exports=async(window,app,report=()=>{})=>{
 assert.ok(app.getPath('userData').startsWith(path.join(os.tmpdir(),'stepquest-smoke-')));
 const errors=[];window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 if(window.webContents.isLoading())await new Promise(resolve=>window.webContents.once('did-finish-load',resolve));
 const js=async code=>{let timer;try{return await Promise.race([window.webContents.executeJavaScript(code),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Packaged renderer timeout: '+code)),15000);})]);}finally{clearTimeout(timer);}},wait=async code=>{for(let n=0;n<200;n++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Packaged UI timeout: '+code);};
 report('loading');await wait("document.body.dataset.screen==='welcome'");report('welcome');const created=await js("window.stepquest.createCharacter({name:'PackageTester',classId:'guardian',sex:'male'})");assert.equal(created.ok,true);const hero=created.value;
 await js(`camp(${JSON.stringify(hero.id)})`);await wait("document.body.dataset.screen==='game'");
 const db=new DatabaseSync(path.join(app.getPath('userData'),'stepquest.sqlite'));
 try{
  db.prepare('UPDATE characters SET coins=1000 WHERE id=?').run(hero.id);await js(`camp(${JSON.stringify(hero.id)})`);
  for(const scene of ['mine','smith','arena']){report('background-'+scene);await js(`document.querySelector('[data-location=${scene}]').click()`);await js(`new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('Missing ${scene} background'));image.src='assets/scene-${scene}.png';})`);}
  await js("document.querySelector('[data-location=mine]').click();document.getElementById('start-mining').click()");await wait("document.getElementById('collect-mining')!==null&&!document.getElementById('app').hasAttribute('aria-busy')");let state=(await js('window.stepquest.gameState()')).value;
  db.prepare('UPDATE mining_runs SET started_at=? WHERE id=?').run(Date.now()-120*60000-1000,state.mine.job.id);await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=mine]').click();document.getElementById('collect-mining').click()");await wait("!document.getElementById('app').hasAttribute('aria-busy')");assert.ok((await js('window.stepquest.gameState()')).value.mine.materials[0].quantity>8);
  await js("document.querySelector('[data-location=smith]').click()");await wait("document.getElementById('craft-item')&&!document.getElementById('craft-item').disabled");await js("document.getElementById('craft-item').click();document.getElementById('confirm-craft').click()");await wait("document.getElementById('game-dialog')?.open&&!document.getElementById('confirm-craft')&&!document.getElementById('app').hasAttribute('aria-busy')");state=(await js('window.stepquest.gameState()')).value;assert.equal(state.inventory.length,3);assert.equal(state.hero.coins,886);
  await js("document.getElementById('game-dialog').close();document.querySelector('[data-location=arena]').click();document.querySelector('[data-arena-slot=\"0\"]').click()");await wait("document.querySelector('[data-arena-action=auto]')!==null");await js("document.querySelector('[data-arena-action=auto]').click()");await wait("document.querySelector('.arena-result')!==null&&!document.getElementById('app').hasAttribute('aria-busy')");state=(await js('window.stepquest.gameState()')).value;assert.equal(state.arena.session.status,'won');assert.equal(state.arena.session.rewardXp,12);assert.deepEqual(errors,[]);
  const result={packaged:true,platform:process.platform,arch:process.arch,version:app.getVersion(),mine:true,smith:true,arena:true,backgrounds:3,rendererErrors:errors.length};report('complete',{result});console.log(JSON.stringify(result));
 }finally{db.close();}
};
