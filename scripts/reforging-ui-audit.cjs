'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
module.exports=async({app,js,waitFor,capture,checkContrast})=>{
 const initial=(await js('window.stepquest.gameState()')).value,hero=initial.hero,db=new DatabaseSync(path.join(app.getPath('userData'),'stepquest.sqlite'));let oldItem;
 try{
  db.prepare('UPDATE hero_progress SET level=45,stage=100 WHERE character_id=?').run(hero.id);
  db.prepare('UPDATE characters SET coins=100000 WHERE id=?').run(hero.id);
  oldItem=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'),{level:5,depth:205,rarity:'rare',rng:()=>.5,source:'smith'});insertItem(db,hero.id,oldItem);
  const templates=['guardian-weapon-0','guardian-body-0-0','ring-0','amulet-0','boots-0'].map(id=>C.TEMPLATES.find(t=>t.id===id));
  for(let n=0;n<24;n++)insertItem(db,hero.id,generateItem(templates[n%templates.length],{level:n+1,rarity:n%2?'uncommon':'common',rng:()=>.5}));
 }finally{db.close();}
 await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=smith]').click();document.getElementById('smith-mode-reforge').click()");
 assert.equal(await js("document.getElementById('reforge-target')===null"),true);
 assert.equal(await js("document.querySelectorAll('.reforge-cell').length"),12);
 assert.equal(await js("document.getElementById('reforge-next').disabled"),false);
 for(const filter of ['weapons','armor','accessories','all']){
  await js(`document.querySelector('[data-reforge-filter=${filter}]').click()`);
  assert.ok((await js("document.querySelectorAll('.reforge-cell').length"))>0);
 }
 for(let n=0;n<4&&!await js(`!!document.querySelector('.reforge-cell[data-reforge-item="${oldItem.id}"]')`);n++)await js("document.getElementById('reforge-next').click()");
 await js(`document.querySelector('.reforge-cell[data-reforge-item="${oldItem.id}"]').click()`);
 assert.equal(await js("document.querySelector('.reforge-quote').dataset.fromLevel"),'5');
 assert.equal(await js("document.querySelector('.reforge-quote').dataset.targetLevel"),'45');
 await js("document.getElementById('inspect-reforge-item').click()");await waitFor("!!document.querySelector('#game-dialog .item-characteristics')");
 assert.equal(await js("document.querySelector('#game-dialog .item-characteristics').dataset.itemId"),oldItem.id);await js("document.getElementById('game-dialog').close()");
 const before=(await js('window.stepquest.gameState()')).value,quote=before.smith.reforges.find(q=>q.id===oldItem.id);assert.ok(quote.upgradeCost>0);
 for(const language of ['it','en','fr','es','de','ja']){
  await js(`window.StepQuestI18n.setLanguage('${language}')`);
  await capture(language+'-reforging-grid');await checkContrast(language+'-reforging-grid');
  await js(`document.querySelector('.reforge-cell[data-reforge-item="${oldItem.id}"]').dispatchEvent(new MouseEvent('mouseenter'))`);
  await waitFor(`document.getElementById('item-tooltip')?.dataset.itemId===${JSON.stringify(oldItem.id)}&&!document.getElementById('item-tooltip').hidden`);
  await waitFor("document.querySelector('#item-tooltip .gear-comparison')?.dataset.assessment!=='pending'");
  await capture(language+'-reforging-popup');await checkContrast(language+'-reforging-popup');
  await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.getElementById('reforge-item').click()");
  assert.equal(await js("document.querySelector('#game-dialog .reforge-quote').dataset.targetLevel"),'45');
  await capture(language+'-reforging-confirm');await checkContrast(language+'-reforging-confirm');
  await js("document.getElementById('game-dialog').close()");
 }
 await js("window.StepQuestI18n.setLanguage('it');document.getElementById('reforge-item').click();document.getElementById('confirm-reforge').click()");
 await waitFor("document.getElementById('game-dialog')?.open&&!document.getElementById('confirm-reforge')&&!document.getElementById('app').hasAttribute('aria-busy')");
 const after=(await js('window.stepquest.gameState()')).value,upgraded=after.inventory.find(item=>item.id===oldItem.id);
 assert.equal(upgraded.level,45);assert.equal(upgraded.depthMultiplier,oldItem.depthMultiplier);assert.equal(upgraded.generationDepth,oldItem.generationDepth);
 assert.equal(after.hero.coins,before.hero.coins-quote.cost);assert.equal(upgraded.price,quote.newPrice);assert.equal(after.hero.steps,before.hero.steps);
 await capture('reforging-upgraded-item');await checkContrast('reforging-upgraded-item');
 console.log(JSON.stringify({reforgingGrid:true,popups:true,pagination:true,filters:true,levelUpgrade:[5,45],premium:quote.upgradeCost,languages:6}));
};
