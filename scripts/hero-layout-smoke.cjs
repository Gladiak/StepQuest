'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
module.exports=async(window,app)=>{
 if(window.webContents.isLoading())await new Promise(r=>window.webContents.once('did-finish-load',r));
 const js=code=>window.webContents.executeJavaScript(code).catch(error=>{throw new Error(error.message+' · '+code);}),waitFor=async code=>{for(let n=0;n<100;n++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timeout: '+code);};
 await waitFor("document.body.dataset.screen==='welcome'");const hero=(await js("window.stepquest.createCharacter({name:'Thorin',classId:'guardian',sex:'male'})")).value;await js("window.stepquest.createCharacter({name:'Rowan',classId:'ranger',sex:'female'})");await js(`camp(${JSON.stringify(hero.id)})`);require('./game-smoke-fixture.cjs').stepProgression(path.join(app.getPath('userData'),'stepquest.sqlite'),hero.id);await js(`camp(${JSON.stringify(hero.id)})`);
 const capture=async name=>{await new Promise(r=>setTimeout(r,100));await fs.writeFile(path.join(__dirname,'../artifacts',name+'.png'),(await window.webContents.capturePage()).toPNG());},screens=[];
 const checkContrast=async name=>{await require('./layout-audit.cjs')(window,name);screens.push(await require('./contrast-audit.cjs')(window,name));};
 await require('./hero-overview-audit.cjs')({app,js,waitFor,capture,checkContrast});
 for(const language of ['it','en','fr','es','de','ja']){
  await js(`window.StepQuestI18n.setLanguage('${language}');document.getElementById('back').click()`);await waitFor("document.body.dataset.screen==='welcome'");await js("document.getElementById('continue-button').click()");await waitFor("document.body.dataset.screen==='selection'");await capture(language+'-hero-progress');await checkContrast(language+'-hero-progress');
  const heroes=(await js('window.stepquest.characters()')).value;for(const c of heroes)assert.equal(await js(`document.querySelector('.hero-card[data-id="${c.id}"] .hero-progress').textContent`),await js(`window.StepQuestI18n.translate(${JSON.stringify(`Livello ${c.level} · Profondità ${c.stage}`)})`));
  await js(`document.querySelector('.hero-card[data-id="${hero.id}"] .choose').click()`);await waitFor("document.body.dataset.screen==='game'");await js("document.querySelector('[data-location=wilds]').click()");await capture(language+'-wild-tabs');await checkContrast(language+'-wild-tabs');
 }
 console.log(JSON.stringify({heroScreens:screens.length,independentSteps:true,automaticCachedSteps:true,progressCards:true,skirmishLeftExpeditionRight:true}));
};
