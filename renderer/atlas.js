'use strict';
window.StepQuestAtlas=(()=>{
 const STATUS={unknown:'Inesplorato',known:'Individuato',available:'Accessibile',resolved:'Risolto',transformed:'Trasformato'};
 const SHORT={refuge:'Rifugio',tracks:'Sentiero',caravan:'Carovana',signs:'Galleria',pact:'Santuario',message:'Villaggio',bridge:'Guado',oak:'Quercia',well:'Pozzo',watch:'Faro'};
 function render({shell,g,state,el,button,run,dialog,busy,blocked,travelling,onSelect,onQuest,onJourney,onBoard}){
  const data=g.atlas,selected=data.nodes.find(n=>n.id===state.atlasNode)||data.nodes.find(n=>n.questId===g.guild.active?.questId)||data.nodes[0];state.atlasNode=selected.id;
  const layout=el('div','atlas-layout'),map=el('section','game-dark atlas-map'),stage=el('div','atlas-stage'),detail=el('section','game-dark atlas-detail');map.setAttribute('aria-label','Mappa della Provincia del Rifugio');map.dataset.complete=String(data.complete);stage.dataset.river=data.variants.river===null?'wild':data.variants.river===0?'bridge':'ferry';stage.dataset.mountain=data.variants.mountain===null?'quiet':data.variants.mountain===0?'sanctuary':'mine';
  const picture=el('img','atlas-art');picture.src='assets/atlas-refuge.png';picture.alt='';picture.draggable=false;stage.append(picture);
  const paths=document.createElementNS('http://www.w3.org/2000/svg','svg');paths.setAttribute('viewBox','0 0 1000 500');paths.setAttribute('preserveAspectRatio','none');paths.setAttribute('class','atlas-paths');paths.setAttribute('aria-hidden','true');
  for(const [from,to]of data.links){const a=data.nodes.find(n=>n.id===from),b=data.nodes.find(n=>n.id===to),path=document.createElementNS(paths.namespaceURI,'path');path.setAttribute('d',`M ${a.x*10} ${a.y*5} Q ${(a.x+b.x)*5+18} ${(a.y+b.y)*2.5} ${b.x*10} ${b.y*5}`);path.dataset.revealed=String(b.accessible);path.dataset.resolved=String(['transformed','resolved'].includes(b.state));paths.append(path);}stage.append(paths);
  for(const node of data.nodes.filter(n=>n.state==='unknown'||n.state==='known')){const fog=el('div','atlas-fog');fog.style.left=node.x+'%';fog.style.top=node.y+'%';fog.setAttribute('aria-hidden','true');stage.append(fog);}
  const decor=(cls,x,y,text='')=>{const n=el('span',cls,text);n.style.left=x+'%';n.style.top=y+'%';n.setAttribute('aria-hidden','true');stage.append(n);return n;};
  if(data.variants.river===0)decor('atlas-bridge',79,61);else if(data.variants.river===1)decor('atlas-ferry',79,61,'◆');
  if(data.variants.mountain===0)decor('atlas-rune',59,10,'✧');else if(data.variants.mountain===1){decor('atlas-lantern',41,25);decor('atlas-lantern',46,22);}
  if(data.variants.caravan!==null)decor('atlas-lantern',data.variants.caravan===0?14:16,data.variants.caravan===0?20:69);
  if(data.variants.oak===0)decor('atlas-lantern',43,50);else if(data.variants.oak===1)decor('atlas-ribbons',44,48,'⋈');
  if(data.variants.well!==null)decor('atlas-rune',56,74,data.variants.well===0?'✦':'◇');
  if(data.wardenDefeated)decor('atlas-beacon',93,19);
  for(const node of data.nodes){
   const b=button('',()=>onSelect(node.id),'atlas-node');b.dataset.atlasNode=node.id;const tour=g.chronicles?.tour;if(tour?.startedAt!==null&&tour?.stops.find(t=>!t.reached)?.nodeId===node.id)b.dataset.tour='true';b.dataset.status=node.state;b.style.left=node.x+'%';b.style.top=node.y+'%';b.setAttribute('aria-pressed',String(selected.id===node.id));b.setAttribute('aria-label',`${node.state==='unknown'?'Terra incognita':node.name} · ${STATUS[node.state]}`);b.disabled=busy;
   b.append(el('span','atlas-seal',node.state==='unknown'?'?':node.state==='known'?'◇':node.state==='transformed'?'✧':node.state==='resolved'?'◆':node.kind==='expedition'?'⚔':'●'),el('span','atlas-label',node.state==='unknown'?'???':SHORT[node.id]));stage.append(b);
  }
  const caption=el('div','atlas-caption');caption.append(el('strong','',data.province),el('span','',`${data.chapters} / ${data.totalChapters} capitoli · ${data.events} / 2 incontri`));stage.append(caption);
  const legend=el('div','atlas-legend');for(const text of ['● Accessibile','✧ Trasformato','? Inesplorato'])legend.append(el('span','',text));stage.append(legend);map.append(stage);layout.append(map,detail);shell.append(layout);
  detail.append(el('div','eyebrow',selected.region),el('h2','',selected.state==='unknown'?'Terra incognita':selected.name),el('span','atlas-state',STATUS[selected.state]));
  if(selected.visited)detail.append(el('span','atlas-visited','Già visitato'));
  detail.append(el('p','atlas-description',selected.description));
  if(selected.kind==='hub'){
   const visit=button('Esplora il Rifugio',()=>run(()=>window.stepquest.visitAtlas({nodeId:selected.id}),'Il luogo è stato annotato nell’Atlante.'),'secondary','atlas-visit');visit.disabled=busy;detail.append(visit,button('Torna alla bacheca',onBoard,'secondary','atlas-board'));
  }else if(selected.kind==='story'){
   detail.append(el('p','atlas-hint',selected.choice!==null?'La tua scelta ha trasformato questo luogo.':selected.accessible?'Il movimento reale apre il prossimo capitolo.':'Concludi il primo capitolo di questa storia.'));
   const open=button(selected.choice!==null?'Leggi il capitolo':'Apri incarico',()=>onQuest(selected),'','atlas-open-quest');open.disabled=busy;detail.append(open);
  }else if(!selected.accessible){
   detail.append(el('p','atlas-hint',selected.requires===1?'Concludi un capitolo della Gilda per raggiungere questo luogo.':'Concludi due capitoli della Gilda per raggiungere questo luogo.'));
  }else if(selected.kind==='event'){
   if(selected.choice===null){detail.append(el('p','atlas-hint','Una scelta permanente. Nessun costo o premio economico.'));for(const [choice,ending]of selected.choices.entries()){const b=button(ending.label,()=>dialog(selected.name,ending.text,el('p','','Questa scelta resterà nella storia della provincia.'),[button('Salva la scelta',()=>run(()=>window.stepquest.chooseAtlas({nodeId:selected.id,choice}),'La provincia ricorderà la tua scelta.'),'','confirm-atlas-choice')]),'secondary');b.dataset.atlasChoice=choice;b.disabled=busy||blocked;detail.append(b);}}
   else detail.append(el('p','atlas-hint',selected.choices[selected.choice].label));
  }else{
   detail.append(el('p','atlas-hint','A metà vita il Custode libera l’alba. Leggi gli intenti, difendi e sfrutta la sua vulnerabilità.'));if(data.finale?.memory)detail.append(button('Rivivi la riaccensione',()=>window.StepQuestWatch.ceremony({memory:data.finale.memory,el,button,dialog}),'secondary','atlas-replay-finale'));
   if(data.activeExpeditionId){detail.append(button('Riprendi il viaggio',onJourney,'','atlas-resume'));}
   else{
    const start=button(data.wardenDefeated?`Rivisita il Faro · ${data.cost} passi`:`Esplora il Faro · ${data.cost} passi`,()=>window.StepQuestWatch.departure({el,button,dialog,cost:data.cost,onStart:()=>run(()=>window.stepquest.startExpedition('watch',crypto.randomUUID()),'La spedizione ha inizio.',onJourney)}),'','atlas-start');start.disabled=busy||blocked||travelling||!!g.research.pending||g.hero.steps<data.cost;detail.append(start);
    if(blocked||travelling)detail.append(el('p','atlas-hint','Completa lo scontro o rientra dalla spedizione.'));else if(g.hero.steps<data.cost)detail.append(el('p','atlas-hint','Passi insufficienti'));
   }
   detail.append(el('p','atlas-hint',data.wardenDefeated?'Il Faro è acceso. Il custode riconosce il tuo ritorno.':'La vittoria riaccende il Faro sulla mappa.'));
  }
  const chapter=el('div','atlas-chapter-progress');chapter.append(el('span','',`${data.chapters} / 6 capitoli conclusi`));const progress=el('progress');progress.max=6;progress.value=data.chapters;progress.setAttribute('aria-label','Capitoli della provincia');chapter.append(progress,el('p','',data.wardenDefeated?'Custode sconfitto':'Custode da affrontare'));detail.append(chapter);
  if(data.complete){const finish=el('div','atlas-complete');finish.append(el('strong','','La provincia ha una nuova luce.'),el('p','',data.title.name));const equip=button('Indossa il titolo',()=>run(()=>window.stepquest.equipGuildTitle({titleId:data.title.id}),'Titolo aggiornato.'),'secondary','atlas-equip-title');equip.disabled=busy||blocked||g.guild.equippedTitle===data.title.id;finish.append(equip);detail.append(finish);}
 }
 return {render};
})();
