'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
module.exports=async({app,js,waitFor,capture,checkContrast})=>{
 const hero=(await js('window.stepquest.gameState()')).value.hero,db=new DatabaseSync(path.join(app.getPath('userData'),'stepquest.sqlite'));
 try{db.prepare('UPDATE hero_progress SET level=45,stage=100 WHERE character_id=?').run(hero.id);db.prepare('UPDATE characters SET coins=100000,steps=100000 WHERE id=?').run(hero.id);}finally{db.close();}
 await js(`window.stepquest.initiateRunic({requestId:crypto.randomUUID()})`);await js(`camp(${JSON.stringify(hero.id)})`);
 const window=require('electron').BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()),report=[];
 const inspect=async label=>{
  const result=await js(`(()=>{
   const failures=[],panels=[],selector='.equipment-panel,.inventory-panel,.market-categories,.shop-panel,.encounter-panel,.enemy-panel,.expedition-panel,.expedition-report,.alchemy-layout>section,.alchemy-workspace,.settlement-layout>section,.atlas-detail,.chronicle-grid,.chronicle-page,.combat-log,.arena-log,.game-dialog-body',dialog=document.querySelector('.game-dialog[open]');
   for(const panel of (dialog||document).querySelectorAll(selector)){
    if(panel.closest('dialog:not([open])'))continue;const bounds=panel.getBoundingClientRect();if(!bounds.width||!bounds.height)continue;
    const style=getComputedStyle(panel),saved=panel.scrollTop,name=panel.id||panel.className,overflow=panel.scrollHeight-panel.clientHeight;
    panels.push({name,height:panel.clientHeight,overflow,scrollable:['auto','scroll'].includes(style.overflowY)});
    if(overflow>2&&!['auto','scroll'].includes(style.overflowY))failures.push({type:'vertical-content-unreachable',name,overflow});
    if(panel.scrollWidth>panel.clientWidth+2)failures.push({type:'horizontal-overflow',name,overflow:panel.scrollWidth-panel.clientWidth});
    for(const control of panel.querySelectorAll('button,select,input,a[href]')){
     if(control.parentElement.closest(selector)!==panel)continue;
     if(control.closest('[hidden]'))continue;let r=control.getBoundingClientRect();if(!r.width||!r.height)continue;
     const top=bounds.top+panel.clientTop,bottom=top+panel.clientHeight;
     if(r.height>panel.clientHeight)continue;
     if(r.bottom>bottom)panel.scrollTop+=r.bottom-bottom+2;if(r.top<top)panel.scrollTop-=top-r.top+2;
     r=control.getBoundingClientRect();
     if(r.top<top-2||r.bottom>bottom+2)failures.push({type:'control-clipped',name,control:control.id||control.textContent.trim().slice(0,60)});
     const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!hit||!control.contains(hit))failures.push({type:'control-obscured',name,control:control.id||control.textContent.trim().slice(0,60)});
    }
    panel.scrollTop=saved;
   }
   const shell=document.querySelector('.game-shell').getBoundingClientRect();return {failures,panels,viewport:[innerWidth,innerHeight],shell:[shell.width,shell.height]};
  })()`);report.push({label,...result});assert.deepEqual(result.failures,[],label);return result;
 };
 const scenes=[['home',null],['market',null],['wilds','skirmish'],['wilds','expedition'],['alchemy',null],['smith','craft'],['smith','reforge'],['smith','refine'],['smith','runes'],['mine',null],['arena',null],['guild','board'],['guild','atlas'],['guild','chronicles']];
 for(const size of process.argv.includes('--scroll-interactions')?[]:[[1280,800],[1440,900],[1600,1000]]){
  window.setContentSize(...size);await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  for(const language of ['it','en','fr','es','de','ja']){
   await js(`window.StepQuestI18n.setLanguage('${language}')`);
   for(const [location,mode]of scenes){
    await js(`document.querySelector('[data-location=${location}]').click()`);
    if(mode)await js(location==='wilds'?`document.querySelector('[data-wild-mode=${mode}]').click()`:location==='smith'?`document.getElementById('smith-mode-${mode}').click()`:mode==='chronicles'?"document.querySelector('[data-guild-mode=board]').click();document.getElementById('open-chronicles').click()":`document.querySelector('[data-guild-mode=${mode}]').click()`);
    const label=language+'-'+size.join('x')+'-'+location+(mode?'-'+mode:'');const result=await inspect(label);
    assert.deepEqual(result.shell,size,'game fills the resized viewport');
    if(['smith-runes','guild-chronicles','wilds-skirmish'].includes(location+'-'+mode)&&['it','de','ja'].includes(language)){await capture('scroll-'+label);await checkContrast('scroll-'+label);}
   }
  }
 }
 {
  window.setContentSize(1280,800);await js("window.StepQuestI18n.setLanguage('it');document.querySelector('[data-location=smith]').click();document.getElementById('smith-mode-runes').click()");
  const before=await js("(()=>{const panel=document.querySelector('.settlement-bench');panel.scrollTop=panel.scrollHeight;return panel.scrollTop;})()");assert.ok(before>100);
  await js("document.querySelector('[data-runic-word=return]').click()");await waitFor("document.querySelector('.runic-quote')?.textContent.includes('Costo:')");assert.equal(await js("document.querySelector('.settlement-bench').scrollTop"),before,'selecting a recipe must not jump back to the top');
  await js("document.querySelector('.settlement-layout>section:last-child').scrollTop=9999");const right=await js("document.querySelector('.settlement-layout>section:last-child').scrollTop");assert.ok(right>0);
  await js("document.querySelector('[data-runic-word=return]').click()");await waitFor("document.querySelector('.runic-quote')?.textContent.includes('Costo:')");await js('new Promise(resolve=>setTimeout(resolve,50))');assert.equal(await js("document.querySelector('.settlement-layout>section:last-child').scrollTop"),right,'a late quote must retain the detail offset');
  await js("document.querySelector('[data-runic-word=beacon]').click()");assert.equal(await js("document.querySelector('.settlement-layout>section:last-child').scrollTop"),0,'a different recipe starts its description at the top');
  const wheel=await js("(()=>{const panel=document.querySelector('.settlement-bench');panel.scrollTop=0;const r=panel.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()");const debug=window.webContents.debugger;debug.attach('1.3');try{await debug.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...wheel});await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',...wheel,deltaX:0,deltaY:220});await waitFor("document.querySelector('.settlement-bench').scrollTop>0");}finally{await debug.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:false});debug.detach();}
  await js("document.getElementById('open-rune-collection').click()");await inspect('rune-collection-dialog');await checkContrast('scroll-rune-collection-dialog');await js("document.getElementById('game-dialog').close()");
  await js("document.querySelector('[data-location=wilds]').click();document.querySelector('[data-wild-mode=skirmish]').click();document.getElementById('combat-settings').click()");await inspect('strategy-dialog');await checkContrast('scroll-strategy-dialog');await js("document.getElementById('game-dialog').close()");
  assert.equal((await js("window.stepquest.rest()")).ok,true);const battle=(await js("window.stepquest.startBattle('elite')")).value.battle,update=new DatabaseSync(path.join(app.getPath('userData'),'stepquest.sqlite'));try{update.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(battle.id);}finally{update.close();}assert.equal((await js(`window.stepquest.autoBattle({battleId:${JSON.stringify(battle.id)},round:0})`)).ok,true);await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=wilds]').click()");await inspect('battle-with-loot-and-report');await checkContrast('scroll-battle-with-loot');
  await js("document.getElementById('runic-summary').click()");await inspect('battle-report-dialog');await js("document.getElementById('game-dialog').close();document.querySelector('[data-location=arena]').click();document.getElementById('arena-practice').click()");await waitFor("!!document.getElementById('arena-action-auto')");await inspect('active-arena');await js("document.getElementById('arena-action-auto').click()");await waitFor("!document.getElementById('arena-action-auto')&&!document.getElementById('app').hasAttribute('aria-busy')");await inspect('arena-results');
 }
 await fs.mkdir(path.join(__dirname,'../artifacts'),{recursive:true});await fs.writeFile(path.join(__dirname,'../artifacts/scrolling-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({scrollingScreens:report.length,failures:report.flatMap(r=>r.failures.map(f=>({label:r.label,...f})))}));
};
