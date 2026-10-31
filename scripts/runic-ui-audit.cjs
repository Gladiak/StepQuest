'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{generateItem,insertItem}=require('../lib/game-items.cjs'),C=require('../lib/game-catalog.cjs');
module.exports=async({app,js,waitFor,capture,checkContrast})=>{
 const initial=(await js('window.stepquest.gameState()')).value,hero=initial.hero,file=path.join(app.getPath('userData'),'stepquest.sqlite'),db=new DatabaseSync(file),ids={};
 try{
  db.prepare('UPDATE hero_progress SET level=45,stage=100 WHERE character_id=?').run(hero.id);db.prepare('UPDATE characters SET coins=100000 WHERE id=?').run(hero.id);
  for(const [slot,id]of [['weapon','guardian-weapon-0'],['body','guardian-body-0-0'],['feet','boots-0'],['ring1','ring-0'],['ring2','ring-1'],['amulet','amulet-0']]){const item=generateItem(C.TEMPLATES.find(t=>t.id===id),{level:45,depth:100,rarity:'rare',rng:()=>.5});insertItem(db,hero.id,item);ids[slot]=item.id;}
 }finally{db.close();}
 for(const [slot,id]of Object.entries(ids))assert.equal((await js(`window.stepquest.equipItem(${JSON.stringify(id)},'${slot}')`)).ok,true);
 assert.equal((await js('window.stepquest.rest()')).ok,true);
 await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=smith]').click();document.getElementById('smith-mode-runes').click()");
 await waitFor("!!document.getElementById('runic-primer')");await capture('runic-primer');await checkContrast('runic-primer');
 const offered=await js("[...document.querySelector('#runic-target').options].map(o=>o.value)");assert.deepEqual(offered.sort(),[ids.weapon,ids.body].sort());assert.ok(initial.inventory.every(i=>!offered.includes(i.id)),'unequipped inventory pieces must not appear in inscriptions');
 await js("document.getElementById('runic-primer').click()");await waitFor("!document.getElementById('runic-primer')&&!document.getElementById('app').hasAttribute('aria-busy')");
 let s=(await js('window.stepquest.gameState()')).value;assert.equal(s.runic.fragments,16);assert.equal(s.runic.runes.length,12);assert.equal(s.runic.words.length,16);
 await js(`document.getElementById('runic-target').value=${JSON.stringify(ids.weapon)};document.getElementById('runic-target').dispatchEvent(new Event('change'))`);
 await waitFor("!document.getElementById('apply-runeword').disabled");
 for(const slot of ['weapon','body']){
  await js(`document.getElementById('runic-target').value=${JSON.stringify(ids[slot])};document.getElementById('runic-target').dispatchEvent(new Event('change'))`);
  for(const w of s.runic.words.filter(w=>w.slot===slot)){await js(`document.querySelector('[data-runic-word=${w.id}]').click()`);await checkContrast('runic-recipe-'+w.id);}
 }
 await js(`document.getElementById('runic-target').value=${JSON.stringify(ids.weapon)};document.getElementById('runic-target').dispatchEvent(new Event('change'));document.querySelector('[data-runic-word=revenge]').click()`);
 for(const lang of ['it','en','fr','es','de','ja']){
  await js(`window.StepQuestI18n.setLanguage('${lang}')`);await capture(lang+'-runic-forge');await checkContrast(lang+'-runic-forge');
  await js("document.getElementById('open-rune-collection').click()");await capture(lang+'-rune-collection');await checkContrast(lang+'-rune-collection');assert.equal(await js("document.querySelectorAll('.rune-collection-tile').length"),12);await js("document.getElementById('game-dialog').close()");
 }
 await js("window.StepQuestI18n.setLanguage('it');document.getElementById('open-rune-collection').click();document.querySelector('[data-craft-rune=sol]').click()");await waitFor("document.getElementById('game-dialog')?.open&&!document.getElementById('app').hasAttribute('aria-busy')");assert.equal((await js('window.stepquest.gameState()')).value.runic.fragments,12);await js("document.getElementById('game-dialog').close()");
 await waitFor("!document.getElementById('apply-runeword').disabled");await js("document.getElementById('apply-runeword').click()");await capture('runic-confirmation');await checkContrast('runic-confirmation');await js("document.getElementById('confirm-runeword').click()");await waitFor("!document.getElementById('app').hasAttribute('aria-busy')&&!!document.querySelector('.runic-quote')");
 s=(await js('window.stepquest.gameState()')).value;assert.equal(s.equipment.weapon.runeword.id,'revenge');
 // Extract and re-inscribe through the same quoted, recoverable flow.
 await waitFor("!document.getElementById('apply-runeword').disabled");await js("document.getElementById('apply-runeword').click();document.getElementById('confirm-runeword').click()");await waitFor("!document.getElementById('app').hasAttribute('aria-busy')");assert.equal((await js('window.stepquest.gameState()')).value.equipment.weapon.runeword,null);
 await waitFor("!document.getElementById('apply-runeword').disabled");await js("document.getElementById('apply-runeword').click();document.getElementById('confirm-runeword').click()");await waitFor("!document.getElementById('app').hasAttribute('aria-busy')");
 assert.equal((await js("window.stepquest.craftRune({runeId:'tor',requestId:crypto.randomUUID()})")).ok,true);
 const quote=(await js(`window.stepquest.previewRuneword({itemId:${JSON.stringify(ids.body)},wordId:'vigil'})`)).value;assert.equal((await js(`window.stepquest.inscribeRuneword({...${JSON.stringify(quote)},requestId:crypto.randomUUID()})`)).ok,true);
 await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=wilds]').click()");
 for(const lang of ['it','en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${lang}');document.getElementById('combat-settings').click()`);await capture(lang+'-runic-settings');await checkContrast(lang+'-runic-settings');await js("document.getElementById('game-dialog').close()");}
 await js("window.StepQuestI18n.setLanguage('it');document.getElementById('combat-settings').click();document.getElementById('auto-profile').value='prudent';document.getElementById('echo-rank').value='1';document.getElementById('save-runic-settings').click()");await waitFor("!document.getElementById('app').hasAttribute('aria-busy')");
 assert.equal((await js('window.stepquest.gameState()')).value.runic.profile,'prudent');assert.equal((await js("window.stepquest.startBattle('elite')")).ok,true);
 const active=(await js('window.stepquest.gameState()')).value.battle,modify=new DatabaseSync(file);try{modify.prepare('UPDATE battles SET enemy=?,enemy_hp=4000 WHERE id=?').run(JSON.stringify({...active.enemy,health:4000,attack:1}),active.id);}finally{modify.close();}
 assert.equal((await js(`window.stepquest.autoBattle({battleId:${JSON.stringify(active.id)},round:0})`)).ok,true);
 await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=wilds]').click()");s=(await js('window.stepquest.gameState()')).value;assert.equal(s.battle.status,'won');assert.ok(s.battle.runicSummary.every(r=>r.activations>0));assert.ok(s.battle.autoDecisions.defends>0);
 for(const lang of ['it','en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${lang}')`);await capture(lang+'-runic-victory');await checkContrast(lang+'-runic-victory');await js("document.getElementById('runic-summary').click()");await capture(lang+'-runic-report');await checkContrast(lang+'-runic-report');await js("document.getElementById('game-dialog').close()");}
 await js("document.querySelector('[data-location=home]').click()");
 for(const lang of ['it','en','fr','es','de','ja']){
  await js(`window.StepQuestI18n.setLanguage('${lang}');document.querySelector('.equipment-slot[data-item-id="${ids.weapon}"]').click()`);await waitFor("!!document.querySelector('#game-dialog .runeword-details')");await capture(lang+'-runic-item-details');await checkContrast(lang+'-runic-item-details');assert.equal(await js("document.getElementById('sell-item').disabled"),true);await js("document.getElementById('game-dialog').close()");
 }
 console.log(JSON.stringify({runicRecipes:16,runeGlyphs:12,engraving:true,recovery:true,crafting:true,prudentDefenses:s.battle.autoDecisions.defends,summary:s.battle.runicSummary,languages:6}));
};
