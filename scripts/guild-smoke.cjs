'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
module.exports=async(window,app)=>{
 const errors=[];window.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
 if(window.webContents.isLoading())await new Promise(r=>window.webContents.once('did-finish-load',r));
 const js=code=>window.webContents.executeJavaScript(code).catch(error=>{throw new Error(error.message+' · '+code+' · '+errors.join(' | '));});
 const waitFor=async code=>{for(let i=0;i<150;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timeout: '+code);};
 await waitFor("document.body.dataset.screen==='welcome'");const created=(await js("window.stepquest.createCharacter({name:'Thorin',classId:'guardian',sex:'male'})")).value;await js(`camp(${JSON.stringify(created.id)})`);await waitFor("document.body.dataset.screen==='game'");
 const capture=async name=>{await new Promise(r=>setTimeout(r,100));await fs.mkdir(path.join(__dirname,'../artifacts'),{recursive:true});await fs.writeFile(path.join(__dirname,'../artifacts',name+'.png'),(await window.webContents.capturePage()).toPNG());};
 const checks=[],checkContrast=async name=>{checks.push(await require('./layout-audit.cjs')(window,name));await require('./contrast-audit.cjs')(window,name);};
 await require('./guild-audit.cjs')({app,js,waitFor,capture,checkContrast});assert.deepEqual(errors,[]);console.log(JSON.stringify({guild:true,screens:checks.length,rendererErrors:errors.length}));
};
