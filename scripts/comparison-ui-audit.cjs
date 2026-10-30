'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
module.exports=async({app,js,waitFor,capture,checkContrast})=>{
 const initial=(await js('window.stepquest.gameState()')).value,hero=initial.hero;
 const db=new DatabaseSync(path.join(app.getPath('userData'),'stepquest.sqlite'));let candidate;
 try{
  db.prepare('UPDATE hero_progress SET level=430,stage=871,hp=18341 WHERE character_id=?').run(hero.id);
  db.prepare('DELETE FROM equipped_items WHERE character_id=?').run(hero.id);
  const weapon=generateItem(C.TEMPLATES.find(t=>t.id==='guardian-weapon-0'));
  weapon.baseStats={attack:9062.59,health:13078,defense:7591.14,critical:57,critical_damage:141,dodge:9,accuracy:5};insertItem(db,hero.id,weapon);
  const current=generateItem(C.TEMPLATES.find(t=>t.id==='amulet-0'),{rarity:'legendary'});
  current.baseStats={attack:143.43,dodge:26,life_steal:15,xp_bonus:52,critical_damage:9};current.rolls=[];insertItem(db,hero.id,current);
  candidate=generateItem(C.TEMPLATES.find(t=>t.id==='amulet-5'),{rarity:'mythic'});
  candidate.baseStats={health:1666,defense:252.5};candidate.rolls=[];insertItem(db,hero.id,candidate);
  for(const [slot,item]of [['weapon',weapon],['amulet',current]])db.prepare('INSERT INTO equipped_items VALUES(?,?,?)').run(hero.id,slot,item.id);
 }finally{db.close();}
 await js(`camp(${JSON.stringify(hero.id)})`);await waitFor("document.body.dataset.location==='home'");
 const state=(await js('window.stepquest.gameState()')).value;
 const timing=await js(`(async()=>{const start=performance.now();const result=await window.stepquest.compareItems(${JSON.stringify({context:state.comparisonContext,itemIds:[candidate.id],priority:true})});return {elapsedMs:performance.now()-start,result};})()`);
 assert.equal(timing.result.ok,true);assert.equal(timing.result.value.items[0].comparisons[0].assessment.recommendation,'worse');
 await js(`document.querySelector('.inventory-cell[data-item-id="${candidate.id}"]').focus()`);
 await waitFor(`document.querySelector('.inventory-cell[data-item-id="${candidate.id}"]').dataset.comparisonState==='worse'`);
 assert.equal(await js(`document.activeElement.dataset.itemId===${JSON.stringify(candidate.id)}`),true,'async badges must preserve focus');
 assert.equal(await js(`document.querySelector('.inventory-cell[data-item-id="${candidate.id}"] .upgrade-badge')===null`),true);
 await js(`document.querySelector('.inventory-cell[data-item-id="${candidate.id}"]').click()`);
 await waitFor("document.querySelector('#game-dialog .gear-comparison').dataset.assessment==='worse'");
 for(const language of ['it','en','fr','es','de','ja']){
  await js(`window.StepQuestI18n.setLanguage('${language}')`);
  await waitFor("document.querySelector('#game-dialog .comparison-summary').textContent.includes(window.StepQuestI18n.translate('Mantieni quello attuale'))");
  assert.equal(await js("document.querySelector('#game-dialog .comparison-summary').textContent.includes('+2,4%')"),false);
  await capture(language+'-comparison-regression');await checkContrast(language+'-comparison-regression');
 }
 await js("document.getElementById('game-dialog').close();window.StepQuestI18n.setLanguage('it')");
 const jewels=require('./game-smoke-fixture.cjs').jewelry(path.join(app.getPath('userData'),'stepquest.sqlite'),hero);
 for(const [itemId,slot]of [[jewels.ring1,'ring1'],[jewels.ring2,'ring2']])assert.equal((await js(`window.stepquest.equipItem(${JSON.stringify(itemId)},${JSON.stringify(slot)})`)).ok,true);
 await js(`camp(${JSON.stringify(hero.id)})`);
 await js(`document.querySelector('.inventory-cell[data-item-id="${jewels.replacement}"]').click();document.querySelector('[data-compare-slot=ring2]').click();document.querySelector('[data-compare-slot=ring2]').focus()`);
 await waitFor("document.querySelector('#game-dialog .gear-comparison').dataset.assessment!=='pending'");
 assert.equal(await js("document.querySelector('#game-dialog .gear-comparison').dataset.comparisonSlot"),'ring2');
 assert.equal(await js("document.querySelector('[data-compare-slot=ring2]').getAttribute('aria-pressed')"),'true');
 assert.equal(await js("document.activeElement.dataset.compareSlot"),'ring2');
 await capture('comparison-ring-choice');await checkContrast('comparison-ring-choice');
 await js("document.getElementById('game-dialog').close()");
 const unchanged=(await js('window.stepquest.gameState()')).value;
 assert.equal(unchanged.hero.steps,state.hero.steps);assert.equal(unchanged.hero.coins,state.hero.coins);assert.equal(unchanged.equipment.amulet.id,state.equipment.amulet.id);
 console.log(JSON.stringify({comparisonRegression:true,comparisonRoundTripMs:+timing.elapsedMs.toFixed(2),languages:6,focusPreserved:true,ringChoicePreserved:true}));
};
