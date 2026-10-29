'use strict';
// Le regole e gli oggetti arrivano da SQLite attraverso il processo principale.
window.StepQuestItems=Object.freeze({
 classes:{guardian:'Guardiano',arcanist:'Arcanista',ranger:'Ranger',rogue:'Predone',druid:'Druido',berserker:'Berserker'},
 sprites:['sword','staff','bow','daggers','nature-staff','axe','armor-plate','armor-robe','armor-leather','boots','ring','amulet','potion-red','potion-blue','potion-green','food'],
 formatRoll:(value,unit)=>(value>0?'+':'')+value+(unit==='percent'?'%':''),
});
