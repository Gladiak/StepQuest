'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function node(resetKey='',max=1000){let top=0;return {id:'',className:'panel',dataset:{scrollResetKey:resetKey},scrollLeft:0,max,get scrollTop(){return top;},set scrollTop(value){top=Math.min(this.max,value);}};}
function fixture(t){
 let nodes=[],observer;const handlers={},abort=new AbortController(),root={querySelectorAll:()=>nodes,addEventListener:(type,handler)=>{handlers[type]=handler;}};
 const context=vm.createContext({window:{},MutationObserver:class{constructor(callback){this.callback=callback;this.connected=false;observer=this;}observe(){this.connected=true;}disconnect(){this.connected=false;}},setTimeout,clearTimeout});vm.runInContext(fs.readFileSync('renderer/scroll-state.js','utf8'),context);const manager=context.window.StepQuestScroll.create({root,signal:abort.signal});t.after(()=>abort.abort());
 return {manager,handlers,abort,get nodes(){return nodes;},set nodes(value){nodes=value;},get observer(){return observer;}};
}
test('panel scroll survives updates to the same view, while navigation starts at the top',t=>{
 const f=fixture(t);f.manager.render('forge',()=>{f.nodes=[node()];});f.nodes[0].scrollTop=350;f.manager.render('forge',()=>{f.nodes=[node()];});assert.equal(f.nodes[0].scrollTop,350);f.manager.render('mine',()=>{f.nodes=[node()];});assert.equal(f.nodes[0].scrollTop,0);
});
test('changing a detail selection resets that panel while preserving the recipe list',t=>{
 const f=fixture(t);f.manager.render('runes',()=>{f.nodes=[node('weapon'),node('ember')];});f.nodes[0].scrollTop=400;f.nodes[1].scrollTop=200;f.manager.render('runes',()=>{f.nodes=[node('weapon'),node('revenge')];});assert.equal(f.nodes[0].scrollTop,400);assert.equal(f.nodes[1].scrollTop,0);
});
test('late quotes restore the saved offset after short loading content has grown',t=>{
 const f=fixture(t);f.manager.render('forge',()=>{f.nodes=[node()];});f.nodes[0].scrollTop=400;f.manager.render('forge',()=>{f.nodes=[node('',30)];});assert.equal(f.nodes[0].scrollTop,30);f.nodes[0].max=1000;f.observer.callback();assert.equal(f.nodes[0].scrollTop,400);
});
test('user gestures and disposal stop late restoration from moving the reader',t=>{
 const f=fixture(t);f.manager.render('forge',()=>{f.nodes=[node()];});f.nodes[0].scrollTop=400;f.manager.render('forge',()=>{f.nodes=[node()];});assert.equal(f.observer.connected,true);f.handlers.wheel();assert.equal(f.observer.connected,false);f.manager.render('forge',()=>{f.nodes=[node()];});assert.equal(f.observer.connected,true);f.abort.abort();assert.equal(f.observer.connected,false);
});
