'use strict';
window.StepQuestScroll=Object.freeze({
 create({root,signal}){
  const selector='.equipment-panel,.inventory-panel,.market-categories,.shop-panel,.encounter-panel,.enemy-panel,.expedition-panel,.expedition-report,.alchemy-layout>section,.alchemy-workspace,.settlement-layout>section';
  let context=null,observer=null,timer=null;
  function cancel(){observer?.disconnect();observer=null;clearTimeout(timer);timer=null;}
  for(const event of ['wheel','touchstart','pointerdown','keydown'])root.addEventListener(event,cancel,{capture:true,passive:true,signal});
  signal.addEventListener('abort',cancel,{once:true});
  const panels=()=>[...root.querySelectorAll(selector)];
  const key=(node,index)=>[index,node.id,node.className,node.dataset.scrollResetKey||''].join(':');
  function render(nextContext,draw){
   cancel();const positions=new Map();
   if(context===nextContext)panels().forEach((node,index)=>{if(node.scrollTop||node.scrollLeft)positions.set(key(node,index),{top:node.scrollTop,left:node.scrollLeft});});
   context=nextContext;draw();
   if(!positions.size||signal.aborted)return;
   const restore=()=>panels().forEach((node,index)=>{const saved=positions.get(key(node,index));if(saved){node.scrollTop=saved.top;node.scrollLeft=saved.left;}});
   restore();
   // Quotes and comparison results can arrive after the panel was rebuilt.
   // Retry as content grows, until the next user gesture or a short settle period.
   observer=new MutationObserver(restore);observer.observe(root,{childList:true,subtree:true});timer=setTimeout(cancel,600);
  }
  return {render};
 }
});
