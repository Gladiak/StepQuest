'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
module.exports=async({app,js,waitFor,capture,checkContrast})=>{
 const db=new DatabaseSync(path.join(app.getPath('userData'),'stepquest.sqlite'));let hero=(await js('window.stepquest.gameState()')).value.hero;
 const originalHero=hero.id;
 const audit=async name=>{await js('document.fonts.ready');await capture(name);await checkContrast(name);};
 const mount=async()=>{await js(`camp(${JSON.stringify(hero.id)})`);await js("document.querySelector('[data-location=guild]').click();document.querySelector('[data-guild-mode=atlas]').click()");};
 const idle=()=>waitFor("!document.getElementById('app').hasAttribute('aria-busy')&&!document.querySelector('dialog[open]')");
 const choose=async(node,choice)=>{await js(`document.querySelector('[data-atlas-node=${node}]').click();document.querySelector('[data-atlas-choice="${choice}"]').click()`);await audit('atlas-'+node+'-confirm');await js("document.getElementById('confirm-atlas-choice').click()");await idle();};
 try{
  // This fixture is isolated from the real profile, including the full-suite hero.
  const created=await js("window.stepquest.createCharacter({name:'Atlas',classId:'guardian',sex:'female'})");assert.equal(created.ok,true);hero=created.value;
  db.prepare('UPDATE characters SET steps=10000 WHERE id=?').run(hero.id);await mount();const balance=(await js('window.stepquest.gameState()')).value.hero.steps;assert.equal(await js("document.querySelectorAll('[data-atlas-node]').length"),10);await audit('atlas-new-province');
  await js("document.querySelector('[data-atlas-node=watch]').click()");assert.equal(await js("document.getElementById('atlas-start')===null"),true);await audit('atlas-watch-locked');
  await js("document.querySelector('[data-atlas-node=caravan]').click();document.getElementById('atlas-open-quest').click()");assert.equal(await js("document.querySelector('[data-guild-quest=caravan-return]').getAttribute('aria-pressed')"),'true');
  const scope=db.prepare("SELECT value FROM app_state WHERE name='active_scope'").get().value;
  for(const q of require('../lib/guild-catalog.cjs').CONTRACTS)db.prepare("INSERT INTO guild_contracts(id,character_id,scope_id,quest_id,accepted_at,accepted_day,accepted_week,baseline_steps,status,choice,claimed_at) VALUES(?,?,?,?,?,'2026-10-30','2026-10-26',0,'claimed',?,?)").run(randomUUID(),hero.id,scope,q.id,Date.now()-1000,q.id==='river-bridge'?1:0,Date.now());
  await mount();for(const language of ['it','en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${language}')`);for(const node of ['oak','well']){await js(`document.querySelector('[data-atlas-node=${node}]').click()`);await audit(language+'-atlas-event-'+node);}}await js("window.StepQuestI18n.setLanguage('it')");await choose('oak',0);await choose('well',1);await audit('atlas-transformed');
  const state=(await js('window.stepquest.gameState()')).value;assert.equal(state.hero.steps,balance);assert.equal(state.atlas.events,2);assert.equal(state.atlas.variants.river,1);
  for(const language of ['it','en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${language}')`);for(const node of ['refuge','tracks','caravan','signs','pact','message','bridge','oak','well','watch']){await js(`document.querySelector('[data-atlas-node=${node}]').click()`);await audit(language+'-atlas-'+node);}}
  await js("window.StepQuestI18n.setLanguage('it');document.querySelector('[data-atlas-node=watch]').click();document.getElementById('atlas-start').click()");await audit('atlas-departure-confirm');await js("document.getElementById('confirm-atlas-expedition').click()");await idle();assert.equal((await js('window.stepquest.gameState()')).value.hero.steps,balance-75);await audit('atlas-watch-trail');
  await mount();await js("document.querySelector('[data-atlas-node=watch]').click();document.getElementById('atlas-resume').click()");
  await js("document.getElementById('expedition-auto').checked=false;document.getElementById('expedition-auto').dispatchEvent(new Event('change'))");
  for(const option of ['search','bless','rune','guardian']){await js(`document.querySelector('[data-expedition-choice=${option}]').click()`);await idle();await audit('atlas-watch-'+option);}
  let game=(await js('window.stepquest.gameState()')).value;assert.equal(game.battle.enemy.id,'warden');assert.equal(game.hero.steps,balance-75);assert.equal(await js("document.querySelector('.world-enemy img').complete&&document.querySelector('.world-enemy img').naturalWidth>0"),true);
  db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(game.battle.id);await js("document.querySelector('[data-battle-action=Auto]').click()");await idle();game=(await js('window.stepquest.gameState()')).value;assert.equal(game.atlas.complete,true);assert.equal(game.expedition.status,'completed');await audit('atlas-watch-victory');
  await js("document.getElementById('return-to-atlas').click()");await audit('atlas-completed-province');await js("document.getElementById('atlas-equip-title').click()");await idle();assert.equal((await js('window.stepquest.gameState()')).value.guild.equippedTitle,'province');
  db.prepare("UPDATE guild_contracts SET choice=0 WHERE character_id=? AND quest_id='river-bridge'").run(hero.id);db.prepare("UPDATE guild_contracts SET choice=1 WHERE character_id=? AND quest_id='mountain-pact'").run(hero.id);await mount();assert.equal(await js("document.querySelectorAll('.atlas-bridge').length"),1);await audit('atlas-bridge-and-mine');
  for(const language of ['en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${language}');document.querySelector('[data-atlas-node=watch]').click()`);await audit(language+'-atlas-complete');}
  await js("window.StepQuestI18n.setLanguage('it');document.querySelector('[data-location=home]').click()");
  const deleted=await js(`window.stepquest.deleteCharacter(${JSON.stringify(hero.id)},'Atlas')`);assert.equal(deleted.ok,true);await js(`camp(${JSON.stringify(originalHero)})`);
 }finally{db.close();}
};
