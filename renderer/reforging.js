'use strict';
window.StepQuestReforging=Object.freeze({
 create({getGame,state,el,button,fmt,titled,itemIcon,rarity,tier,bindItem,dialog,run,inspect,render,isBusy,isLocked,api}){
  const PAGE_SIZE=12;
  const matches=(item,filter)=>filter==='all'||filter==='weapons'&&item.slot==='weapon'||filter==='armor'&&['body','feet'].includes(item.slot)||filter==='accessories'&&['ring','amulet'].includes(item.slot);
  function quoteDetails(target){
   const content=el('div','reforge-quote');content.dataset.fromLevel=target.fromLevel;content.dataset.targetLevel=target.targetLevel;content.dataset.cost=target.cost;
   for(const [label,value]of [['Livello dell’oggetto',`${fmt(target.fromLevel)} → ${fmt(target.targetLevel)}`],['Costo base',`${fmt(target.baseCost)} monete`],['Adeguamento di livello',`${fmt(target.upgradeCost)} monete`],['Totale',`${fmt(target.cost)} monete`]]){
    const row=el('p','reforge-quote-row');row.append(el('span','',label),el('strong','',value));content.append(row);
   }
   return content;
  }
  function screen({left,bench,right}){
   const g=getGame(),inventory=new Map(g.inventory.map(item=>[item.id,item])),filter=state.reforgeFilter||'all';
   const targets=g.smith.reforges.map(quote=>({...quote,item:inventory.get(quote.id)})).filter(q=>q.item&&matches(q.item,filter));
   const target=targets.find(q=>q.id===state.reforgeItem)||targets[0];if(target)state.reforgeItem=target.id;
   left.append(el('p','settlement-muted','Scegli un pezzo dalla griglia. Il livello sale fino a quello dell’eroe, con un costo aggiuntivo.'),el('p','settlement-muted','La riforgiatura non assegna esperienza al Fabbro.'));
   bench.append(titled('Scegli l’oggetto','Passa su un oggetto per vederne le caratteristiche.'));
   const filters=el('nav','reforge-filters');filters.setAttribute('aria-label','Categorie di equipaggiamento');
   for(const [value,label]of [['all','Tutti'],['weapons','Armi'],['armor','Armature'],['accessories','Accessori']]){
    const b=button(label,()=>{state.reforgeFilter=value;state.reforgePage=0;render();},'secondary');b.dataset.reforgeFilter=value;b.setAttribute('aria-pressed',String(value===filter));b.disabled=isBusy();filters.append(b);
   }
   bench.append(filters);
   const grid=el('div','inventory-grid reforge-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Equipaggiamento da riforgiare');
   const pages=Math.max(1,Math.ceil(targets.length/PAGE_SIZE)),page=Math.min(state.reforgePage||0,pages-1);state.reforgePage=page;
   for(const quote of targets.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)){
    const item=quote.item,id='reforge-choice-'+item.id;
    const b=button('',()=>{state.reforgeItem=item.id;render();document.getElementById(id)?.focus({preventScroll:true});},'inventory-cell reforge-cell',id);
    b.dataset.reforgeItem=item.id;b.setAttribute('aria-pressed',String(item.id===target?.id));b.disabled=isBusy();
    b.append(itemIcon(item),el('span','reforge-item-name',item.name),el('small','reforge-item-level',`Lv. ${fmt(item.level)}`));
    if(item.equippedSlot)b.append(el('span','equipped-marker','◆'));
    bindItem(b,item);grid.append(b);
   }
   bench.append(grid);
   if(!targets.length)bench.append(el('p','','Nessun equipaggiamento disponibile.'));
   const pager=el('div','inventory-pager');
   const previous=button('‹',()=>{state.reforgePage=page-1;render();},'secondary'),next=button('›',()=>{state.reforgePage=page+1;render();},'secondary');
   previous.id='reforge-previous';next.id='reforge-next';previous.setAttribute('aria-label','Pagina precedente');next.setAttribute('aria-label','Pagina successiva');previous.disabled=isBusy()||page===0;next.disabled=isBusy()||page===pages-1;
   pager.append(previous,el('span','',`${page+1} / ${pages}`),next);bench.append(pager);
   right.append(titled('Pezzo selezionato','Il preventivo viene verificato alla conferma'));
   if(!target)return;
   const selected=el('div','reforge-selected');selected.append(itemIcon(target.item),rarity(el('h3','',target.item.name),target.item.rarity));right.append(selected,quoteDetails(target));
   if(!target.eligible)right.append(el('p','error',target.reason));
   else if(target.pending)right.append(el('p','error','Completa prima la preparazione alchemica di questo oggetto.'));
   else if(g.hero.coins<target.cost)right.append(el('p','error','Monete insufficienti.'));
   const details=button('Esamina equipaggiamento',()=>inspect(target.item),'secondary','inspect-reforge-item');details.disabled=isBusy();right.append(details);
   const reforge=button('Riforgia equipaggiamento',()=>{
    const request={requestId:crypto.randomUUID(),itemId:target.id,version:target.version,token:target.token},content=quoteDetails(target);
    content.prepend(rarity(el('h3','reforge-confirm-name',target.item.name),target.item.rarity));
    dialog('Conferma riforgiatura','Gli attributi verranno sostituiti e possono peggiorare. Il risultato è definitivo; rarità e miglioramenti restano sul pezzo.',content,[
     button('Riforgia',()=>run(()=>api.reforgeItem(request),'Equipaggiamento riforgiato.',()=>inspect(getGame().inventory.find(item=>item.id===target.id))),'','confirm-reforge')
    ]);
   },'','reforge-item');
   reforge.disabled=isLocked()||target.pending||!target.eligible||g.hero.coins<target.cost;right.append(reforge);
   right.append(el('p','settlement-muted','Rarità, modello, slot, set, incantamento e rifinitura conservati.'),el('p','settlement-muted','Bonus di profondità conservato.'),el('p','settlement-muted',`Affissi ricalcolati: ${target.item.rolls.length}`));
  }
  return Object.freeze({screen});
 }
});
