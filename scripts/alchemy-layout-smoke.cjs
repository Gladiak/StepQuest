'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
module.exports=async(window,app)=>{
 if(window.webContents.isLoading())await new Promise(r=>window.webContents.once('did-finish-load',r));
 const js=code=>window.webContents.executeJavaScript(code).catch(error=>{throw new Error(error.message+' · '+code);}),waitFor=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timeout: '+code);};
 await waitFor("document.body.dataset.screen==='welcome'");const hero=(await js("window.stepquest.createCharacter({name:'Thorin',classId:'guardian',sex:'male'})")).value;
 await js(`camp(${JSON.stringify(hero.id)})`);await waitFor("document.body.dataset.screen==='game'");await js('window.stepquest.syncSteps()');await js(`camp(${JSON.stringify(hero.id)})`);
 const capture=async name=>{await new Promise(r=>setTimeout(r,100));await fs.writeFile(path.join(__dirname,'../artifacts',name+'.png'),(await window.webContents.capturePage()).toPNG());},checks=[];
 const checkContrast=async name=>{await require('./layout-audit.cjs')(window,name);checks.push(await require('./contrast-audit.cjs')(window,name));};
 await require('./alchemy-audit.cjs')({window,app,js,waitFor,capture,checkContrast});if(process.argv.includes('--rarity-sale'))await require('./rarity-sale-audit.cjs')({app,js,waitFor,capture,checkContrast});if(process.argv.includes('--progression'))await require('./step-progression-audit.cjs')({app,js,waitFor,capture,checkContrast});console.log(JSON.stringify({alchemyLayoutScreens:checks.length,scrolling:false}));
};
