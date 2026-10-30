'use strict';
const {Worker}=require('node:worker_threads');
const {createHash}=require('node:crypto');
const {VERSION}=require('./comparison-simulation.cjs');

// Only one bounded job runs at a time. The main process keeps SQLite and game
// actions responsive; neither the worker nor its messages contain save access.
function createComparisonService({cacheSize=512,maxQueue=48,timeoutMs=5000,workerFactory=()=>new Worker(require.resolve('./comparison-worker.cjs'))}={}) {
 let worker=null,current=null,sequence=0,closed=false;
 const cache=new Map(),pending=new Map(),queue=[];
 const keyFor=input=>createHash('sha256').update(JSON.stringify([VERSION,input])).digest('hex');
 function fail(error) {
  const old=worker;worker=null;old?.removeAllListeners();old?.terminate();
  if(current){clearTimeout(current.timer);current=null;}
  for(const job of pending.values())job.reject(error);
  pending.clear();queue.length=0;
 }
 function start() {
  if(closed||current||!queue.length)return;
  if(!worker){
   try { worker=workerFactory(); }
   catch(error){fail(error);return;}
   worker.on('error',()=>fail(new Error('Confronto non disponibile.')));
   worker.on('exit',()=>{if(!closed)fail(new Error('Confronto interrotto.'));});
   worker.on('message',message=>{
    if(!current||message.id!==current.id)return;
    const job=current;clearTimeout(job.timer);current=null;pending.delete(job.key);
    if(message.error)job.reject(new Error(message.error));
    else {cache.set(job.key,message.value);if(cache.size>cacheSize)cache.delete(cache.keys().next().value);job.resolve(message.value);}
    worker.unref();start();
   });
   worker.unref();
  }
  current=queue.shift();worker.ref();
  current.timer=setTimeout(()=>fail(new Error('Confronto troppo lungo. Riprova.')),timeoutMs);
  worker.postMessage({id:current.id,input:current.input});
 }
 function assess(input,{priority=false}={}) {
  if(closed)return Promise.reject(new Error('Confronto chiuso.'));
  const key=keyFor(input);
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return Promise.resolve(value);}
  if(pending.has(key)){
   const existing=pending.get(key),index=queue.indexOf(existing);
   if(priority&&index>0){queue.splice(index,1);queue.unshift(existing);}
   return existing.promise;
  }
  if(queue.length>=maxQueue)return Promise.reject(new Error('Confronti in attesa. Riprova.'));
  const job={id:++sequence,key,input};
  job.promise=new Promise((resolve,reject)=>Object.assign(job,{resolve,reject}));
  pending.set(key,job);if(priority)queue.unshift(job);else queue.push(job);start();return job.promise;
 }
 return {assess,close(){closed=true;cache.clear();fail(new Error('Confronto chiuso.'));},
  diagnostics:()=>({cacheEntries:cache.size,pending:pending.size,queued:queue.length,running:!!current})};
}
module.exports={createComparisonService};
