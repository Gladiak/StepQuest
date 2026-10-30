'use strict';
window.StepQuestComparisons=Object.freeze({
 create({api,getGame,root,signal,onUpdate}){
  let game=null,index=new Map(),epoch=0,queue=[],running=false,runningKey=null,timer=null,idleTimer=null,background=false,backgroundCursor=0;
  const cache=new Map(),failed=new Set();
  function sync(){
   const next=getGame();if(next===game)return;
   if(next.comparisonContext!==game?.comparisonContext){epoch++;queue=[];failed.clear();backgroundCursor=0;}
   game=next;index=new Map([...game.inventory,...game.merchant.offers,...(game.research.pending?.options||[]),...Object.values(game.equipment)].map(item=>[item.id,item]));
  }
  const signature=item=>JSON.stringify([game.comparisonContext,item.id,item.comparisons?.map(c=>[c.slot,c.current?.id,c.eligible,c.equipped,c.changes])]);
  function apply(item,assessments){
   for(const c of item.comparisons||[]){c.assessment=assessments?.find(a=>a.slot===c.slot)?.assessment||null;c.arrows=c.eligible&&!c.equipped?(c.assessment?.arrows||0):0;}
   // Empty slots remain the default. Otherwise prefer a measured recommendation;
   // explicit ring buttons still let the player choose either replacement.
   const choices=item.comparisons||[],empty=choices.find(c=>!c.current);
   const preferred=empty||choices.filter(c=>c.assessment?.recommendation==='better').sort((a,b)=>(b.assessment.metrics?.after.winRate||0)-(a.assessment.metrics?.after.winRate||0)||(b.assessment.metrics?.after.xpPer100Steps||0)-(a.assessment.metrics?.after.xpPer100Steps||0))[0];
   if(!item.equippedSlot&&preferred)item.comparison=preferred;
  }
  function prepare(item){sync();const entry=cache.get(signature(item));if(entry)apply(item,entry);return item;}
  const eligible=item=>!item.equippedSlot&&item.comparisons?.some(c=>c.eligible&&!c.equipped);
  function request(item,priority=false){
   sync();item=index.get(item.id)||item;if(!eligible(item)||signal.aborted)return;
   const key=signature(item),entry=cache.get(key);
   if(key===runningKey)return;
   if(entry){apply(item,entry);return;}
   if(priority){if(failed.delete(key))apply(item,null);}else if(failed.has(key))return;
   const previous=queue.findIndex(job=>job.key===key);
   if(previous>=0){if(priority){const [job]=queue.splice(previous,1);queue.unshift(job);}return;}
   const job={id:item.id,key,epoch,context:game.comparisonContext,priority};
   if(priority)queue.unshift(job);else queue.push(job);
   if(queue.length>32)queue.pop();
   if(!timer)timer=setTimeout(()=>{timer=null;pump();},0);
  }
  function idle(){
   clearTimeout(idleTimer);
   if(!background||signal.aborted||document.hidden)return;
   idleTimer=setTimeout(()=>{
    sync();if(running||queue.length)return;
    const all=[...index.values()],items=[];
    // Scan each context once. A bounded cache must not cause endless rescanning
    // of evicted items in large bags; those are recomputed when made visible.
    while(backgroundCursor<all.length&&items.length<8){const item=all[backgroundCursor++];if(eligible(item)&&!cache.has(signature(item))&&!failed.has(signature(item)))items.push(item);}
    for(const item of items)request(item);
   },500);
  }
  async function pump(){
   if(running||signal.aborted)return;
   const job=queue.shift();if(!job){idle();return;}
   sync();if(job.epoch!==epoch||job.context!==game.comparisonContext){pump();return;}
   const item=index.get(job.id);if(!item||signature(item)!==job.key){pump();return;}
   running=true;runningKey=job.key;
   try{
    const response=await api.compareItems({context:job.context,itemIds:[job.id],priority:job.priority});
    sync();if(signal.aborted||job.epoch!==epoch||job.context!==game.comparisonContext)return;
    if(!response.ok)throw new Error(response.error.message);
    if(response.value.context!==game.comparisonContext)return;
    const current=index.get(job.id);if(!current||signature(current)!==job.key)return;
    const assessments=response.value.items.find(x=>x.id===job.id)?.comparisons;
    if(!assessments)throw new Error('Missing comparison');
    cache.set(job.key,assessments);if(cache.size>512)cache.delete(cache.keys().next().value);
    apply(current,assessments);onUpdate([job.id]);
   }catch{
    if(!signal.aborted&&job.epoch===epoch){failed.add(job.key);if(failed.size>512)failed.delete(failed.values().next().value);const current=index.get(job.id);if(current){apply(current,current.comparisons.map(c=>({slot:c.slot,assessment:{recommendation:'unavailable',arrows:0}})));onUpdate([job.id]);}}
   }finally{running=false;runningKey=null;if(!signal.aborted)timer=setTimeout(()=>{timer=null;pump();},0);}
  }
  function visible(){
   if(signal.aborted)return;sync();clearTimeout(idleTimer);
   const dialog=document.querySelector?.('#game-dialog[open]'),scope=dialog||root;
   const nodes=[...scope.querySelectorAll('.inventory-cell[data-item-id],.shop-row[data-item-id],.research-reward[data-item-id]')];
   background=nodes.length>0;
   const ids=new Set(nodes.map(node=>node.dataset.itemId)),selected=dialog?.querySelector('.item-characteristics[data-item-id]')?.dataset.itemId;if(selected)ids.add(selected);
   // Drop queued work for the old page; a current calculation is bounded and can
   // finish, but its DOM result is applied only to matching items and contexts.
   queue=queue.filter(job=>ids.has(job.id));
   for(const id of ids){const item=index.get(id);if(item){prepare(item);request(item);}}
   if(!running&&!queue.length)idle();
  }
  signal.addEventListener('abort',()=>{clearTimeout(timer);clearTimeout(idleTimer);queue=[];cache.clear();failed.clear();},{once:true});
  return {sync,prepare,request,visible,find:id=>{sync();const item=index.get(id);if(item)prepare(item);return item;}};
 }
});
