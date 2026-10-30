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
  for(const option of ['search','bless','rune']){await js(`document.querySelector('[data-expedition-choice=${option}]').click()`);await idle();await audit('atlas-watch-'+option);}
  await js("document.getElementById('expedition-auto').checked=true;document.getElementById('expedition-auto').dispatchEvent(new Event('change'));document.querySelector('[data-expedition-choice=guardian]').click()");await waitFor("!!document.getElementById('watch-manual')");await audit('watch-boss-resolution-choice');await js("document.getElementById('watch-manual').click()");await idle();await audit('atlas-watch-guardian');
  let game=(await js('window.stepquest.gameState()')).value;assert.equal(game.battle.enemy.id,'warden');assert.equal(game.hero.steps,balance-75);assert.equal(await js("document.querySelector('.world-enemy img').complete&&document.querySelector('.world-enemy img').naturalWidth>0"),true);
  // Exercise the phase boundary and every announced response with real UI actions.
  db.prepare('UPDATE battles SET enemy_hp=? WHERE id=?').run(Math.ceil(game.battle.enemy.health/2)+1,game.battle.id);
  for(let attempt=0;attempt<8&&game.battle.intent.phase===1;attempt++){await js("document.querySelector('[data-battle-action=Attacca]').click()");await idle();game=(await js('window.stepquest.gameState()')).value;}
  assert.equal(game.battle.intent.kind,'gather');await audit('atlas-watch-phase-two');
  await js("document.querySelector('[data-battle-action=Difendi]').click()");await idle();assert.equal((await js('window.stepquest.gameState()')).value.battle.intent.kind,'dawn');await audit('atlas-watch-dawn-warning');
  for(const language of ['en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${language}')`);await audit(language+'-atlas-watch-dawn');}await js("window.StepQuestI18n.setLanguage('it')");
  await js("document.querySelector('[data-battle-action=Difendi]').click()");await idle();game=(await js('window.stepquest.gameState()')).value;assert.equal(game.battle.intent.kind,'exposed');await audit('atlas-watch-exposed');
  db.prepare('UPDATE battles SET enemy_hp=1 WHERE id=?').run(game.battle.id);await js("document.querySelector('[data-battle-action=Auto]').click()");await waitFor("document.querySelector('[data-watch-finale=true]')&&!document.getElementById('app').hasAttribute('aria-busy')");await new Promise(resolve=>setTimeout(resolve,3000));await audit('atlas-watch-rekindling');assert.equal(await js("document.querySelectorAll('.watch-window-light').length"),6);await js("document.querySelector('#game-dialog .actions button').click()");await idle();game=(await js('window.stepquest.gameState()')).value;assert.equal(game.atlas.complete,true);assert.equal(game.expedition.status,'completed');await audit('atlas-watch-victory');
  await js("document.getElementById('return-to-atlas').click()");await audit('atlas-completed-province');await js("document.getElementById('atlas-equip-title').click()");await idle();assert.equal((await js('window.stepquest.gameState()')).value.guild.equippedTitle,'province');
  for(const language of ['it','en','fr','es','de','ja']){
   await js(`window.StepQuestI18n.setLanguage('${language}');document.getElementById('atlas-replay-finale').click()`);await audit(language+'-watch-finale-replay');
   await js("document.querySelector('#game-dialog .actions button').click();document.getElementById('atlas-start').click()");await audit(language+'-watch-call');await js("document.querySelector('#game-dialog .actions button').click()");
  }
  await js("window.StepQuestI18n.setLanguage('it');document.querySelector('[data-guild-mode=board]').click();document.getElementById('open-chronicles').click();document.querySelector('[data-chronicle=beacon]').click()");assert.equal(await js("!!document.getElementById('chronicle-watch-replay')"),true);await audit('watch-chronicle-memory');
  await js("document.getElementById('chronicle-watch-replay').click()");await audit('watch-chronicle-replay');await js("document.querySelector('#game-dialog .actions button').click();document.querySelector('[data-location=home]').click()");await audit('watch-home-return');
  db.prepare("UPDATE guild_contracts SET choice=0 WHERE character_id=? AND quest_id='river-bridge'").run(hero.id);db.prepare("UPDATE guild_contracts SET choice=1 WHERE character_id=? AND quest_id='mountain-pact'").run(hero.id);await mount();assert.equal(await js("document.querySelectorAll('.atlas-bridge').length"),1);await audit('atlas-bridge-and-mine');
  for(const language of ['en','fr','es','de','ja']){await js(`window.StepQuestI18n.setLanguage('${language}');document.querySelector('[data-atlas-node=watch]').click()`);await audit(language+'-atlas-complete');}
  await js("window.StepQuestI18n.setLanguage('it');document.querySelector('[data-location=home]').click()");
  const deleted=await js(`window.stepquest.deleteCharacter(${JSON.stringify(hero.id)},'Atlas')`);assert.equal(deleted.ok,true);await js(`camp(${JSON.stringify(originalHero)})`);
 }finally{db.close();}
};
