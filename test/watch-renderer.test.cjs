'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Faro: il motivo sonoro parte soltanto su richiesta e chiudere il ricordo interrompe il suono senza callback obsolete',async()=>{
 const oscillators=[],contexts=[],handlers={},heading={},modal={dataset:{},classList:{add(){}},setAttribute(){},querySelector:()=>heading,addEventListener:(event,fn)=>{handlers[event]=fn;}};
 class AudioContext{
  constructor(){contexts.push(this);this.state='suspended';this.currentTime=0;this.destination={};}
  async resume(){this.state='running';}
  async close(){this.state='closed';}
  createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
  createOscillator(){const oscillator={frequency:{value:0},connect(){},start(){},stop(){}};oscillators.push(oscillator);return oscillator;}
 }
 const context=vm.createContext({window:{AudioContext},AudioContext,document:{getElementById:()=>modal}});vm.runInContext(fs.readFileSync('renderer/watch-finale.js','utf8'),context);
 let actions;const node=()=>({isConnected:true,style:{setProperty(){}},append(){},setAttribute(){}}),button=(text,click)=>({text,click,isConnected:true});
 context.window.StepQuestWatch.ceremony({memory:{title:'Memory',passage:'Route',flame:'Flame',ending:'End',home:'Home'},el:node,button,dialog:(_title,_text,_body,buttons)=>{actions=buttons;}});
 assert.equal(contexts.length,0);assert.equal(heading.id,'watch-finale-title');await actions[0].click();assert.equal(contexts.length,1);assert.equal(oscillators.length,12);assert.equal(contexts[0].state,'running');
 handlers.close();assert.equal(contexts[0].state,'closed');assert.doesNotThrow(()=>oscillators.at(-1).onended());
});
