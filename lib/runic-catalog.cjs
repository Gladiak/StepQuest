'use strict';
const RUNES=[
 ['sol','Sol',4,'attack_percent',2],['tor','Tor',4,'defense_percent',2],['lum','Lum',4,'health_percent',2],['or','Or',4,'accuracy_percent',1],
 ['vel','Vel',8,'critical_percent',1],['ka','Ka',8,'magic_damage_flat',3],['ash','Ash',8,'health_flat',12],['ith','Ith',8,'regeneration_flat',1],
 ['naer','Naer',16,'attack_flat',3],['vael','Vael',16,'dodge_percent',1],['esh','Esh',16,'block_percent',1],['thal','Thal',16,'damage_reduction_percent',1]
].map(([id,name,cost,attribute,value],art)=>({id,name,cost,attribute,value,art,level:cost===16?30:15}));
const WORDS=[
 ['ember','Brace','weapon',['sol','tor'],'third','damage',.25,'Ogni terza azione d’attacco riuscita infligge il 25% di danni in più.','both'],
 ['fracture','Frattura','weapon',['ka','tor'],'third','pierce',.35,'Ogni terza azione d’attacco riuscita ignora il 35% della difesa.','both'],
 ['revenge','Rappresaglia','weapon',['tor','or'],'counter','damage',.35,'Dopo una difesa, il prossimo attacco infligge il 35% di danni in più.','prudent'],
 ['hunter','Caccia alle ombre','weapon',['vel','ka'],'exposed','damage',.25,'Infliggi il 25% di danni in più durante le aperture del nemico.','both'],
 ['execution','Giudizio','weapon',['ash','ka','esh'],'execute','damage',.20,'Contro nemici sotto il 35% di vita infliggi il 20% di danni in più.','both'],
 ['star','Stella infranta','weapon',['naer','lum','ka'],'first','pierce',.50,'Il primo attacco riuscito ignora il 50% della difesa.','both'],
 ['siphon','Patto cremisi','weapon',['vel','ash','ith'],'critical','heal',.03,'Un critico cura il 3% della vita massima. Recupero: tre turni.','both'],
 ['resolve','Cuore indomito','weapon',['naer','or','thal'],'wounded','damage',.18,'Sotto metà vita i tuoi attacchi infliggono il 18% di danni in più.','both'],
 ['vigil','Veglia','body',['tor','sol'],'defend','shield',.06,'Difendere crea una barriera del 6% della vita massima per il turno.','prudent'],
 ['beacon','Ultimo Faro','body',['lum','or'],'emergency','shield',.12,'Una volta per scontro, sopravvivere sotto il 30% di vita prepara una barriera del 12%.','both'],
 ['oak','Respiro della quercia','body',['ith','lum'],'third','heal',.025,'Ogni terza azione d’attacco riuscita cura il 2,5% della vita massima.','both'],
 ['mirror','Specchio del custode','body',['esh','tor'],'block','reflect',.25,'Una parata riflette danni pari al 25% del tuo attacco, una volta per turno.','both'],
 ['dusk','Manto del crepuscolo','body',['vael','vel','tor'],'heavy','ward',.15,'Riduce del 15% il danno dei colpi potenti, entro il limite di protezione.','both'],
 ['purity','Sigillo puro','body',['thal','lum','ith'],'defend','cleanse',1,'Difendere rimuove veleno e ferite. Recupero: tre turni.','prudent'],
 ['aegis','Egida delle stelle','body',['esh','naer','lum'],'endure','shield',.06,'Dopo tre turni con danni subiti prepara una barriera del 6% per il turno seguente.','both'],
 ['return','Promessa del ritorno','body',['ith','or','vael'],'defend','heal',.03,'Difendere cura il 3% della vita massima. Recupero: tre turni.','prudent']
].map(([id,name,slot,runes,trigger,effect,value,description,profile])=>({id,name,slot,runes,trigger,effect,value,description,profile,level:Math.max(runes.length===3?30:15,...runes.map(id=>RUNES.find(r=>r.id===id).level))}));
const ECHOES=[{rank:0,name:'Percorso ordinario',level:1,depth:1,description:'Le regole e le ricompense del percorso attuale.'},{rank:1,name:'Echi I · Bastione',level:30,depth:60,description:'Per equipaggiamento leggendario potenziato. Protezione, carica e apertura. +2 frammenti per vittoria.'},{rank:2,name:'Echi II · Frattura',level:45,depth:100,description:'Per set unici completi e potenziati. Raccolta, alba, apertura e assalto. +4 frammenti per vittoria. Le ferite riducono le cure del 30% per due turni.'}];
const loadout=equipment=>Object.values(equipment).filter(i=>i?.runeword).map(i=>i.runeword);
const bonuses=words=>words.flatMap(w=>w.runes.map(id=>RUNES.find(r=>r.id===id)).filter(Boolean).map(r=>({attribute_id:r.attribute,value:r.value})));
module.exports={RUNES,WORDS,ECHOES,loadout,bonuses};
