'use strict';
const {parentPort}=require('node:worker_threads');
const {createSimulator}=require('./comparison-simulation.cjs');
const simulator=createSimulator();
parentPort.on('message',({id,input})=>{
 try { parentPort.postMessage({id,value:simulator.evaluate(input)}); }
 catch { parentPort.postMessage({id,error:'Confronto non disponibile.'}); }
});
