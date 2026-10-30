'use strict';
const assert=require('node:assert/strict');
module.exports=async(window,label)=>{
 const result=await window.webContents.executeJavaScript(`(()=>{
  const failures=[];let controls=0,slots=0;
  const visible=n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&!n.closest('[hidden],dialog:not([open])');};
  const box=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:r.left+parseFloat(s.borderLeftWidth)+parseFloat(s.paddingLeft),right:r.right-parseFloat(s.borderRightWidth)-parseFloat(s.paddingRight),top:r.top+parseFloat(s.borderTopWidth)+parseFloat(s.paddingTop),bottom:r.bottom-parseFloat(s.borderBottomWidth)-parseFloat(s.paddingBottom)};};
  const ranges=node=>{const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),out=[];for(let text;text=walker.nextNode();)if(text.textContent.trim()){const r=document.createRange();r.selectNodeContents(text);const parent=text.parentElement,style=getComputedStyle(parent),clamped=Number.parseInt(style.webkitLineClamp,10)>0&&['hidden','clip'].includes(style.overflowY),clip=clamped?parent.getBoundingClientRect():null;for(const measured of r.getClientRects()){
   // Chromium reports ranges for lines hidden by an intentional line clamp.
   // Keep ordinary overflowing text detectable, and measure only visible clamp lines.
   const rect=clip?{left:measured.left,right:measured.right,top:Math.max(measured.top,clip.top),bottom:Math.min(measured.bottom,clip.bottom)}:measured;
   if(rect.bottom>rect.top)out.push({rect,parent,text:text.textContent.trim()});
  }}return out;};
  for(const button of document.querySelectorAll('button')){
   if(!visible(button))continue;controls++;const bounds=box(button);
   for(const {rect,parent,text} of ranges(button)){
    if(rect.top<bounds.top-1.5||rect.bottom>bounds.bottom+1.5)failures.push({type:'button-text-height',text,button:button.className,overflow:Math.round(Math.max(bounds.top-rect.top,rect.bottom-bounds.bottom)*10)/10});
    const style=getComputedStyle(parent),clipped=style.textOverflow==='ellipsis'||style.webkitLineClamp!=='none';
    if(!clipped&&(rect.left<bounds.left-1.5||rect.right>bounds.right+1.5))failures.push({type:'button-text-width',text,button:button.className});
   }
  }
  for(const slot of document.querySelectorAll('.equipment-slot')){
   slots++;const caption=slot.querySelector(':scope>span:not(.empty-equipment)'),name=slot.querySelector('small'),image=slot.querySelector('.item-sprite,.empty-equipment');
   const a=caption.getBoundingClientRect(),b=name.getBoundingClientRect(),c=image.getBoundingClientRect(),bounds=box(slot);
   if(a.bottom+1>b.top||a.left<c.right+5||b.left<c.right+5||a.top<bounds.top-1||b.bottom>bounds.bottom+1)failures.push({type:'equipment-spacing',text:name.textContent});
  }
  for(const node of document.querySelectorAll('.top h1,.top p,.portrait p,.portrait .class-tag,.game-location h1,.game-location p,.game-panel-heading h2,.game-panel-heading p,.welcome .tagline,.bottom-note,.creator .bottom')){if(!visible(node))continue;if(node.scrollWidth>node.clientWidth+1)failures.push({type:'text-horizontal-overflow',text:node.textContent});const panel=node.closest('.portrait,.creator');if(panel&&node.getBoundingClientRect().bottom>box(panel).bottom+1)failures.push({type:'creator-text-overflow',text:node.textContent});}
  for(const card of document.querySelectorAll('.hero-card:not(.empty-slot)')){const progress=card.querySelector('.hero-progress'),choose=card.querySelector('.choose');if(!progress||progress.scrollWidth>progress.clientWidth+1||choose.getBoundingClientRect().bottom>box(card).bottom+1)failures.push({type:'hero-progress-or-card-overflow',buttonOverflow:choose.getBoundingClientRect().bottom-box(card).bottom,progressOverflow:progress?progress.scrollWidth-progress.clientWidth:null});}
  const atlas=document.querySelector('.atlas-stage');if(atlas&&!document.querySelector('dialog[open]')){const bounds=atlas.getBoundingClientRect(),pins=[...atlas.querySelectorAll('[data-atlas-node]')];if(pins.length!==10||pins.filter(n=>n.getAttribute('aria-pressed')==='true').length!==1)failures.push({type:'atlas-selection'});for(const pin of pins){const r=pin.getBoundingClientRect();if(r.left<bounds.left||r.right>bounds.right||r.top<bounds.top||r.bottom>bounds.bottom)failures.push({type:'atlas-marker-clipped',node:pin.dataset.atlasNode});const hit=document.elementFromPoint(r.left+r.width/2,r.top+10);if(!hit||!pin.contains(hit))failures.push({type:'atlas-marker-obscured',node:pin.dataset.atlasNode});}}
  const tabs=[...document.querySelectorAll('.wild-mode-tabs button')];if(tabs.length&&tabs.map(n=>n.dataset.wildMode).join(',')!=='skirmish,expedition')failures.push({type:'wild-tabs-order'});
  const footer=document.querySelector('.game-bottom');if(footer){
   if(footer.querySelector('#quick-bag,.icon-action[data-action-hint^="Zaino"]'))failures.push({type:'toolbar-backpack-removed'});
   if(footer.querySelector('.action-orb,[role=meter]'))failures.push({type:'toolbar-redundant-meters'});
   const buttons=[...footer.querySelectorAll('button')],r=footer.getBoundingClientRect();if(r.height>64||Math.abs(r.left+r.width/2-innerWidth/2)>1)failures.push({type:'toolbar-size-or-centering'});
   for(let i=0;i<buttons.length;i++){const b=buttons[i].getBoundingClientRect();if(b.left<r.left||b.right>r.right||b.top<r.top||b.bottom>r.bottom)failures.push({type:'toolbar-control-outside'});if(i){const a=buttons[i-1].getBoundingClientRect();if(Math.abs(b.left-a.right)>1)failures.push({type:'toolbar-spacing',gap:b.left-a.right});}}
   const top=footer.getBoundingClientRect().top;for(const panel of document.querySelectorAll('.equipment-panel,.inventory-panel,.market-categories,.shop-panel,.encounter-panel,.enemy-panel, .expedition-panel,.expedition-report,.alchemy-layout,.settlement-layout,.atlas-layout,.chronicle-layout'))if(panel.getBoundingClientRect().bottom>top-8)failures.push({type:'panel-overlap',panel:panel.className});}
  for(const panel of document.querySelectorAll('.expedition-panel'))if(panel.scrollHeight>panel.clientHeight+1&&!['auto','scroll'].includes(getComputedStyle(panel).overflowY))failures.push({type:'expedition-panel-overflow'});
  const dialog=document.querySelector('.game-dialog[open]');if(dialog){
   const body=dialog.querySelector('.game-dialog-body'),heading=dialog.querySelector('h2'),actions=dialog.querySelector('.actions'),r=dialog.getBoundingClientRect(),b=body.getBoundingClientRect(),h=heading.getBoundingClientRect(),a=actions.getBoundingClientRect();
   if(r.top<16||r.bottom>innerHeight-16||r.left<16||r.right>innerWidth-16)failures.push({type:'dialog-outside-window'});
   if(b.top<h.bottom-1||b.bottom>a.top+1||b.height<40)failures.push({type:'dialog-sections-overlap'});
   if(body.scrollWidth>body.clientWidth+1||heading.scrollWidth>heading.clientWidth+1)failures.push({type:'dialog-horizontal-overflow'});
  }
  return {failures,controls,slots};
 })()`);
 assert.deepEqual(result.failures,[],label+': ingombri del testo');
 return {screen:label,controls:result.controls,slots:result.slots};
};
