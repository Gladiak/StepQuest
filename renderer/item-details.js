'use strict';
window.StepQuestItemDetails=Object.freeze({
 create({getGame,el,fmt,tier,rollText,rarity,itemIcon,requestComparison}){
  function definition(roll){const g=getGame();return g.attributes.find(a=>a.id===roll.attribute_id);}

  function setDetails(set,count){const n=el('div','item-set');n.append(rarity(el('h4','',`${set.name} · ${count} pezzi indossati`),set.unique?'unique':'rare'));if(set.unique)n.append(el('p','help',`Classe: ${window.StepQuestItems.classes[set.class_id]} · Set unico endgame · Livello ${set.min_level}, profondità ${set.min_depth}. Soglie cumulative 2/3/4/5 pezzi. Drop: 0,1% per vittoria élite o custode idoneo; mai al mercato.`));for(const bonus of set.bonuses){const a=definition(bonus);const p=el('p',count>=bonus.pieces?'set-active':'set-inactive',`${count>=bonus.pieces?'Attivo':'Richiede '+bonus.pieces+' pezzi'} · ${a.label} ${rollText(bonus.value,a.unit)}`);n.append(rarity(p,bonus.rarity));}return n;}
  function effectText(item){const e=item.effect;if(!e)return '';if(e.kind==='heal')return `Recupera ${e.amount} punti vita.`;if(e.kind==='food')return `Recupera ${e.amount} punti vita fuori dal combattimento.`;if(e.kind==='guard')return `Riduce i danni del ${e.amount}% per ${e.turns} turni.`;return `Rimuove il veleno e recupera ${e.amount} punti vita.`;}
  function comparisonDetails(item){const g=getGame();
   const c=item.comparison;if(!c)return null;const node=el('section','gear-comparison');
   const assessment=c.assessment,verdict=assessment?.recommendation;
   const mode=c.equipped?'same':!c.eligible?'locked':verdict==='better'?'better':verdict==='worse'?'worse':'same';
   const title=c.equipped?'Attualmente equipaggiato':!c.eligible?c.reason:verdict==='better'?'↑ Equipaggiamento consigliato':verdict==='worse'?'↓ Mantieni quello attuale':verdict==='unavailable'?'Confronto non disponibile':assessment?(assessment.uncertain||assessment.reason==='unresolved'?'≈ Confronto non conclusivo':'≈ Differenza minima'):'Confronto in corso…';
   node.dataset.comparisonItem=item.id;node.dataset.comparisonSlot=c.slot;node.dataset.assessment=verdict||'pending';
   node.append(el('p','comparison-summary '+mode,title));
   if(assessment&&verdict!=='unavailable'){
    const reasons={unresolved:'Nessuna configurazione vince entro il limite di turni.',wins:verdict==='better'?'Più vittorie nelle prove.':'Meno vittorie nelle prove.',progression:verdict==='better'?'Più esperienza considerando il recupero.':'Meno esperienza considerando il recupero.',speed:verdict==='better'?'Vittorie in meno turni.':'Servono più turni per vincere.',coins:verdict==='better'?'Più monete dopo il recupero.':'Meno monete dopo il recupero.',close:'Risultati troppo vicini per consigliare il cambio.',equivalent:'Prestazioni simili nelle prove.'};
    node.append(el('p','comparison-note',reasons[assessment.reason]||''));
    if(assessment.metrics){const {before,after}=assessment.metrics,metrics=el('div','comparison-metrics');
     for(const [label,key,unit]of [['Vittorie stimate','winRate','%'],['XP per 100 passi con recupero','xpPer100Steps',''],['Turni medi per scontro','rounds','']]){const row=el('p');row.append(el('span','',label),el('strong','',`${fmt(before[key])}${unit} → ${fmt(after[key])}${unit}`));metrics.append(row);}node.append(metrics);
    }
   }
   if(!c.equipped){node.append(el('p','comparison-current',`${g.slotLabels[c.slot]} · ${c.current?'Confronto con '+c.current.name:'Slot vuoto'}`));
    if(c.changes.length){const table=el('div','comparison-table');const head=el('div','comparison-row comparison-head');head.append(el('span','','Sul personaggio'),el('span','','Prima → Dopo'),el('span','','Differenza'));table.append(head);
     for(const change of c.changes){const row=el('div','comparison-row'),unit=change.percent?'%':'';row.append(el('span','',change.label),el('span','',`${fmt(change.before)}${unit} → ${fmt(change.after)}${unit}`),el('strong','stat-difference '+(change.delta>0?'better':'worse'),`${change.delta>0?'+':''}${fmt(change.delta)}${change.percent?' p.p.':''}`));table.append(row);}node.append(table);
    }else node.append(el('p','comparison-current','Nessuna variazione degli attributi.'));
    node.append(el('p','comparison-note','Prove a vita piena, senza pozioni: tre scontri consecutivi contro normali, élite e custodi. Il recupero è convertito in passi; gli esiti restano una stima.'));
   }
   return node;
  }

  function details(item){const g=getGame();requestComparison(item);
   const n=el('div','item-characteristics'),heading=el('div','item-heading');heading.append(itemIcon(item),rarity(el('h3','',item.name),item.rarity));n.dataset.itemId=item.id;n.append(heading);
   n.append(rarity(el('div','item-quality',`${tier(item.rarity).name} · ${g.slotLabels[item.slot]||(item.slot==='ring'?'Anello':'Consumabile')}`),item.rarity));
   n.append(el('p','item-requirement',`Livello ${item.level} · Classe: ${item.classId?window.StepQuestItems.classes[item.classId]:'Tutte le classi'}`));
   if(item.depthMultiplier>1)n.append(el('p','item-requirement',`Forgiato alla profondità ${item.generationDepth} · Potenza di base e affissi ×${fmt(item.depthMultiplier)}. Valori fissati al ritrovamento.`));
   if(Object.keys(item.baseStats).length){const base=el('dl','item-stats');for(const [key,value]of Object.entries(item.baseStats)){base.append(rarity(el('dt','',g.definitions[key].label+' base'),'common'),rarity(el('dd','',fmt(value)),'common'));}n.append(base);}
   if(item.rolls.length){n.append(el('p','item-requirement',`${item.rolls.length} caratteristiche`));const rolls=el('div','rolled-properties');for(const roll of item.rolls){const a=definition(roll),row=rarity(el('div','rolled-property'),roll.rarity);row.append(el('span','',a.label),el('strong','',rollText(roll.value,a.unit)),el('small','',`${roll.value<0?'Malus':'Bonus'} · Range ${rollText(roll.min,a.unit)} … ${rollText(roll.max,a.unit)}`));rolls.append(row);}n.append(rolls);}
   else if(!item.enchantment)n.append(el('p','item-description','Nessuna caratteristica aggiuntiva o abilità.'));
   if(item.enchantment)n.append(enchantmentDetails(item));
   if(item.refinement?.rank)n.append(refinementDetails(item));
   if(item.effect)n.append(el('p','item-effect',effectText(item)),el('p','item-use','Un utilizzo. L’oggetto viene consumato.'));
   const comparison=comparisonDetails(item);if(comparison)n.append(comparison);
   if(item.setId){const set=g.classSets.find(s=>s.id===item.setId);if(set)n.append(setDetails(set,set.pieces));}
   const price=el('div','item-value');price.append(el('span','','Acquisto / vendita'),el('strong','',`◉ ${fmt(item.price)} / ${fmt(item.sellPrice)}`));n.append(price);
   return n;
  }

  function enchantmentDetails(item){const g=getGame();
   const block=el('section','enchantment-details');block.append(el('h4','','✧ Incantamento alchemico'),el('p','enchantment-name',g.alchemy.recipes.find(r=>r.id===item.enchantment.recipeId)?.name||''));
   for(const roll of item.enchantment.rolls){const a=definition(roll);block.append(el('p',roll.value<0?'enchant-penalty':'enchant-bonus',`${a.label} ${rollText(roll.value,a.unit)}`));}
   block.append(el('p','help','Vincolato: non può essere incantato di nuovo.'));return block;
  }

  function refinementDetails(item){const n=el('section','refinement-details');n.append(el('h4','',`Rifinitura ${item.refinement.rank} / ${item.refinement.maxRank}`),el('p','',`Statistiche di base e affissi positivi +${item.refinement.percent}%.`),el('p','help','Il grado resta sul pezzo. Incantamenti e malus restano invariati.'));return n;}
  return Object.freeze({definition,setDetails,comparisonDetails,details,enchantmentDetails,refinementDetails});
 }
});
