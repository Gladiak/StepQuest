'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {setTimeout:delay}=require('node:timers/promises');
function state(context,delta=1){const c={slot:'weapon',eligible:true,equipped:false,current:{id:'old'},changes:[{stat:'attack',delta}],assessment:null,arrows:0};const item={id:'new',comparisons:[c],comparison:c};return {comparisonContext:context,inventory:[item],merchant:{offers:[]},equipment:{},research:{pending:null}};}
function fixture(t){
 const callbacks=[],updates=[],calls=[],signal=new AbortController();let game=state('A');
 const sandbox={window:{},document:{hidden:true},setTimeout,clearTimeout};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../renderer/comparisons.js'),'utf8'),sandbox);
 const api={compareItems:input=>{calls.push(input);return new Promise(resolve=>callbacks.push(resolve));}};
 const controller=sandbox.window.StepQuestComparisons.create({api,getGame:()=>game,root:{querySelectorAll:()=>[]},signal:signal.signal,onUpdate:ids=>updates.push(ids)});
 t.after(()=>signal.abort());
 return {controller,callbacks,updates,calls,signal,get game(){return game;},setGame:value=>game=value,respond(index,recommendation='better'){callbacks[index]({ok:true,value:{context:calls[index].context,items:[{id:'new',comparisons:[{slot:'weapon',assessment:{recommendation,arrows:1,gainPercent:5}}]}]}});}};
}
test('comparison renderer: context changes discard a late result and queue the new equipment',async t=>{
 const f=fixture(t);f.controller.request(f.game.inventory[0]);await delay(5);assert.equal(f.calls.length,1);
 f.setGame(state('B'));f.controller.request(f.game.inventory[0],true);f.respond(0);await delay(5);
 assert.equal(f.updates.length,0);assert.equal(f.calls.length,2);f.respond(1);await delay(5);
 assert.equal(f.updates.length,1);assert.equal(f.game.inventory[0].comparison.assessment.recommendation,'better');
});
test('comparison renderer: candidate changes invalidate results even when hero stats are unchanged',async t=>{
 const f=fixture(t);f.controller.request(f.game.inventory[0]);await delay(5);
 f.setGame(state('A',2));f.respond(0);await delay(5);assert.equal(f.updates.length,0);
 f.controller.request(f.game.inventory[0]);await delay(5);assert.equal(f.calls.length,2);f.respond(1);await delay(5);assert.equal(f.updates.length,1);
});
test('comparison renderer: abort ignores pending replies and prevents new requests',async t=>{
 const f=fixture(t);f.controller.request(f.game.inventory[0]);await delay(5);f.signal.abort();f.respond(0);await delay(5);
 f.controller.request(f.game.inventory[0]);await delay(5);assert.equal(f.calls.length,1);assert.equal(f.updates.length,0);
});
test('comparison renderer: equivalent refreshes reuse results without new IPC',async t=>{
 const f=fixture(t);f.controller.request(f.game.inventory[0]);await delay(5);f.respond(0);await delay(5);
 f.setGame(state('A'));f.controller.prepare(f.game.inventory[0]);f.controller.request(f.game.inventory[0]);await delay(5);
 assert.equal(f.calls.length,1);assert.equal(f.game.inventory[0].comparison.arrows,1);
});
test('comparison renderer: runewords invalidate candidate cache even with identical capped stats',async t=>{
 const f=fixture(t);f.controller.request(f.game.inventory[0]);await delay(5);f.respond(0);await delay(5);
 const changed=state('A');changed.inventory[0].runeword={id:'ember',trigger:'third',effect:'damage',value:.25};f.setGame(changed);f.controller.prepare(f.game.inventory[0]);assert.equal(f.game.inventory[0].comparison.assessment,null);f.controller.request(f.game.inventory[0]);await delay(5);assert.equal(f.calls.length,2);f.respond(1,'worse');await delay(5);assert.equal(f.game.inventory[0].comparison.assessment.recommendation,'worse');
});

test('comparison renderer: ring advice prefers a neutral slot over a downgrade and the smaller loss when both are worse',async t=>{
 for(const [recommendations,gains]of [[['worse','same'],[-20,0]],[['worse','worse'],[-20,-2]]]){
  const f=fixture(t),game=state('rings'),item=game.inventory[0];item.comparisons=['ring1','ring2'].map((slot,index)=>({...item.comparison,slot,current:{id:'old-'+index}}));item.comparison=item.comparisons[0];f.setGame(game);f.controller.request(item);await delay(5);
  f.callbacks[0]({ok:true,value:{context:'rings',items:[{id:item.id,comparisons:item.comparisons.map((c,index)=>({slot:c.slot,assessment:{recommendation:recommendations[index],gainPercent:gains[index],arrows:0}}))}]}});await delay(5);
  assert.equal(item.comparison.slot,'ring2');assert.equal(item.comparison.assessment.recommendation,recommendations[1]);
 }
});

test('comparison renderer: background scan finishes even when the bag exceeds the bounded cache',async()=>{
 const tasks=[],calls=[],abort=new AbortController();let nextId=0;
 const game=state('large');game.inventory=Array.from({length:600},(_,i)=>{const item=state('large').inventory[0];item.id='item-'+i;return item;});
 const sandbox={window:{},document:{hidden:false},setTimeout:(fn,ms)=>{const task={id:++nextId,fn,ms};tasks.push(task);return task.id;},clearTimeout:id=>{const task=tasks.find(t=>t.id===id);if(task)task.cancelled=true;}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../renderer/comparisons.js'),'utf8'),sandbox);
 const api={compareItems:async input=>{calls.push(input.itemIds[0]);return {ok:true,value:{context:'large',items:[{id:input.itemIds[0],comparisons:[{slot:'weapon',assessment:{recommendation:'same',arrows:0}}]}]}};}};
 const root={querySelectorAll:()=>[{dataset:{itemId:'item-0'}}]};
 const controller=sandbox.window.StepQuestComparisons.create({api,getGame:()=>game,root,signal:abort.signal,onUpdate:()=>{}});
 controller.visible();let processed=0;
 while(tasks.length&&processed++<3000){const task=tasks.shift();if(!task.cancelled)task.fn();await new Promise(resolve=>setImmediate(resolve));}
 abort.abort();assert.equal(calls.length,600);assert.equal(new Set(calls).size,600);assert.ok(processed<3000,'background queue must become idle');
});
