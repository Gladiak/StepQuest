'use strict';
window.StepQuestInventorySales=Object.freeze({
 create({getGame,isBusy,api,root,signal,state,el,button,fmt,rarity,tier,dialog,run,active}){
  let saleRequest=0;
  function appendSaleItems(list,items){
   for(const item of items){const row=el('li');row.append(rarity(el('span','',item.name),item.rarity),el('strong','',`${fmt(item.sellPrice)} monete`));list.append(row);}
  }
  function pauseSaleConfirmation(){for(const id of ['confirm-junk-sale','confirm-rarity-sale','save-loot-filter']){const b=document.getElementById(id);if(b)b.disabled=true;}}
  async function junkSaleDialog(returnTo=null){
   if(isBusy()||active())return;pauseSaleConfirmation();const request=++saleRequest,origin=root.firstElementChild,previous=document.querySelector('#game-dialog[open]');
   let preview;try{const response=await api.previewJunkSale();if(!response.ok)throw new Error(response.error.message);preview=response.value;}catch(error){if(request===saleRequest&&!signal.aborted&&origin===root.firstElementChild&&(!previous||previous.isConnected&&previous.open))dialog('Vendi equipaggiamento inferiore',error.message,null,[],returnTo);return;}
   if(request!==saleRequest||isBusy()||active()||signal.aborted||origin!==root.firstElementChild||previous&&(!previous.isConnected||!previous.open))return;
   const content=el('div','junk-sale-preview');saleModes(content,returnTo,'inferior');
   content.append(el('p','help','Conserviamo equipaggiati, consumabili, set, oggetti di livello futuro e pezzi con vantaggi diversi. Un anello viene proposto solo se inferiore in entrambi gli slot.'));
   const list=el('ul','junk-sale-list');appendSaleItems(list,preview.items);content.append(list);
   const buttons=[];if(preview.items.length){const requestId=crypto.randomUUID();buttons.push(button(`Vendi ${preview.items.length} oggetti · ${fmt(preview.coins)} monete`,()=>run(()=>api.sellJunk({token:preview.token,requestId}),`Venduti ${preview.items.length} oggetti inferiori · +${fmt(preview.coins)} monete.`,returnTo),'','confirm-junk-sale'));}
   dialog('Vendi equipaggiamento inferiore',preview.items.length?`${preview.items.length} oggetti · ricavo totale ${fmt(preview.coins)} monete. Controlla l’elenco prima di confermare.`:'Nessun oggetto chiaramente inferiore da vendere.',content,buttons,returnTo);document.getElementById('game-dialog').dataset.panel='junk-sale';
  }
  function saleModes(content,returnTo,selected){
   const modes=el('nav','sale-modes');modes.setAttribute('aria-label','Modalità di vendita');
   for(const [mode,label,fn]of [['inferior','Vendi inferiori',()=>junkSaleDialog(returnTo)],['rarity','Vendi per rarità',()=>raritySaleDialog(returnTo)],['loot','Filtro bottino',()=>lootFilterDialog(returnTo)]]){const b=button(label,fn,'secondary');b.dataset.saleMode=mode;b.setAttribute('aria-pressed',String(mode===selected));modes.append(b);}content.append(modes);
  }
  function rarityChoices(prefix,label,values,onchange){const g=getGame();
   const choices=el('fieldset','rarity-choices');choices.append(el('legend','',label));
   for(const r of g.rarities){const row=el('label','rarity-choice'),check=el('input');check.type='checkbox';check.id=prefix+'-'+r.id;check.value=r.id;check.checked=values.includes(r.id);row.htmlFor=check.id;row.append(check,rarity(el('span','',r.name),r.id));choices.append(row);check.onchange=()=>onchange([...choices.querySelectorAll('input:checked')].map(n=>n.value));}return choices;
  }
  function raritySaleDialog(returnTo=null){
   if(isBusy()||active())return;++saleRequest;
   let selected=state.saleRarities||['common'],includeConsumables=state.saleConsumables||false,preview=null;
   const content=el('div','rarity-sale-preview');saleModes(content,returnTo,'rarity');
   const choices=rarityChoices('sale-rarity','Rarità da vendere',selected,values=>{selected=values;state.saleRarities=values;refresh();});content.append(choices);
   const consumables=el('label','sale-consumables'),check=el('input');check.id='sale-consumables';check.type='checkbox';check.checked=includeConsumables;check.onchange=()=>{includeConsumables=check.checked;state.saleConsumables=includeConsumables;refresh();};consumables.htmlFor=check.id;consumables.append(check,el('span','','Includi cibo e pozioni'));content.append(consumables);
   content.append(el('p','help','Esclusi equipaggiati, incantati, rifiniti e pezzi con una preparazione alchemica in sospeso. La selezione comprende anche set, oggetti migliori e di livello futuro.'));
   const summary=el('p','sale-summary'),list=el('ul','junk-sale-list');summary.setAttribute('aria-live','polite');content.append(summary,list);
   const confirm=button('Conferma vendita',()=>{if(!preview?.items.length)return;const current=preview;run(()=>api.sellRarity({...current.filter,token:current.token,requestId:crypto.randomUUID()}),`Venduti ${current.items.length} oggetti · +${fmt(current.coins)} monete.`,returnTo);},'','confirm-rarity-sale');confirm.disabled=true;
   dialog('Vendi per rarità','Seleziona una o più rarità, poi conferma una sola vendita.',content,[confirm],returnTo);const d=document.getElementById('game-dialog');d.dataset.panel='rarity-sale';
   async function refresh(){
    const request=++saleRequest;preview=null;confirm.disabled=true;list.replaceChildren();Object.assign(d.dataset,{saleRarities:selected.join(','),saleConsumables:String(includeConsumables)});
    if(!selected.length){summary.textContent='Seleziona almeno una rarità da vendere.';return;}
    summary.textContent='Operazione in corso…';
    try{const result=await api.previewRaritySale({rarities:selected,includeConsumables});if(request!==saleRequest||!d.isConnected||!d.open||signal.aborted)return;if(!result.ok)throw new Error(result.error.message);preview=result.value;
     summary.textContent=preview.items.length?`${preview.items.length} oggetti · ricavo totale ${fmt(preview.coins)} monete. Controlla l’elenco prima di confermare.`:'Nessun oggetto vendibile per le rarità selezionate.';
     appendSaleItems(list,preview.items);
     confirm.textContent=preview.items.length?`Vendi ${preview.items.length} oggetti · ${fmt(preview.coins)} monete`:'Conferma vendita';confirm.disabled=!preview.items.length;
    }catch(error){if(request===saleRequest&&d.isConnected)summary.textContent=error.message;}
   }
   refresh();
  }
  function lootFilterDialog(returnTo=null){const g=getGame();
   if(isBusy()||active())return;++saleRequest;
   let enabled=g.lootFilter.enabled,keep=[...g.lootFilter.keepRarities];
   const content=el('div','loot-filter-settings');saleModes(content,returnTo,'loot');
   const toggle=el('label','sale-consumables'),check=el('input');check.type='checkbox';check.id='loot-filter-enabled';check.checked=enabled;toggle.htmlFor=check.id;toggle.append(check,el('span','','Vendi automaticamente i nuovi bottini'));content.append(toggle);
   const threshold=el('label','loot-threshold'),select=el('select');threshold.htmlFor='loot-filter-threshold';threshold.append(el('span','','Conserva da questa rarità in su'));select.id='loot-filter-threshold';const custom=el('option','','Selezione personalizzata');custom.value='';select.append(custom);for(const r of g.rarities){const option=el('option','',r.name);option.value=r.id;select.append(option);}threshold.append(select);content.append(threshold);
   const choices=rarityChoices('loot-keep','Rarità da conservare',keep,values=>{keep=values;update();});content.append(choices);
   const summary=el('div','loot-filter-summary');summary.setAttribute('aria-live','polite');content.append(summary,el('p','help','Nuovi bottini, anche nelle spedizioni e nel premio finale. Cibo e pozioni seguono la rarità scelta. Zaino attuale, reagenti, equipaggiati e incantati sono protetti.'));
   const confirm=button('Salva filtro',()=>run(()=>api.saveLootFilter({enabled,keepRarities:keep}),'Filtro bottino salvato.',returnTo),'','save-loot-filter');
   function update(){
    choices.disabled=!enabled;select.disabled=!enabled;confirm.disabled=enabled&&!keep.length;const first=g.rarities.findIndex(r=>keep.includes(r.id)),suffix=g.rarities.slice(first).map(r=>r.id);select.value=first>=0&&suffix.length===keep.length&&suffix.every(id=>keep.includes(id))?suffix[0]:'';
    summary.replaceChildren();summary.append(el('p','',enabled?'Filtro attivo dopo il salvataggio':'Filtro disattivato: conservi tutti i bottini.'));
    if(enabled){for(const [label,ids]of [['Conserva:',keep],['Vendita automatica:',g.rarities.map(r=>r.id).filter(id=>!keep.includes(id))]]){const line=el('p');line.append(el('strong','',label+' '));if(!ids.length)line.append(el('span','','Nessuna'));for(const [index,id]of ids.entries()){if(index)line.append(document.createTextNode(' · '));line.append(rarity(el('span','',tier(id).name),id));}summary.append(line);}if(!keep.length)summary.append(el('p','error','Seleziona almeno una rarità da conservare.'));}
   }
   check.onchange=()=>{enabled=check.checked;update();};select.onchange=()=>{if(select.value){const rank=tier(select.value).rank;keep=g.rarities.filter(r=>r.rank>=rank).map(r=>r.id);choices.querySelectorAll('input').forEach(n=>n.checked=keep.includes(n.value));update();}};
   dialog('Filtro bottino','Scegli esplicitamente le rarità da tenere. Le altre verranno vendute a fine combattimento al normale prezzo di vendita.',content,[confirm],returnTo);document.getElementById('game-dialog').dataset.panel='loot-filter';update();
  }

  return Object.freeze({junkSaleDialog});
 }
});
