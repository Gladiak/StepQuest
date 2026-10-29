'use strict';
const CLASSES={guardian:'Guardiano',arcanist:'Arcanista',ranger:'Ranger',rogue:'Predone',druid:'Druido',berserker:'Berserker'};
const SLOTS={weapon:'Arma',body:'Vesti / Armatura',feet:'Stivali',ring1:'Anello I',ring2:'Anello II',amulet:'Amuleto'};
const RARITIES=[
 {id:'common',name:'Comune',rank:0,min:0,max:0,scale:1,weight:7100,light:'#343434',dark:'#d2d2cc'},
 {id:'uncommon',name:'Non comune',rank:1,min:1,max:2,scale:1,weight:2300,light:'#173f6b',dark:'#91cfff'},
 {id:'rare',name:'Raro',rank:2,min:1,max:3,scale:1.6,weight:500,light:'#574000',dark:'#e7c257'},
 {id:'mythic',name:'Mitico',rank:3,min:2,max:4,scale:2.3,weight:90,light:'#6b2300',dark:'#ff8a1f'},
 {id:'unique',name:'Unico',rank:5,min:4,max:6,scale:4.2,weight:0,light:'#17451d',dark:'#70ed83'},
 {id:'legendary',name:'Leggendario',rank:4,min:3,max:6,scale:3.2,weight:10,light:'#50246b',dark:'#d5adff'},
];
const STAT_DEFINITIONS={
 attack:{label:'Attacco',base:4,cap:100000},defense:{label:'Difesa',base:0,cap:50000},health:{label:'Vita massima',base:100,cap:1000000},
 magic_damage:{label:'Danno arcano',base:0,cap:50000},critical:{label:'Probabilità critica',base:3,cap:60,percent:true},critical_damage:{label:'Danno critico',base:150,cap:300,percent:true},
 dodge:{label:'Schivata',base:0,cap:35,percent:true},block:{label:'Parata',base:0,cap:50,percent:true},life_steal:{label:'Furto vitale',base:0,cap:15,percent:true},
 regeneration:{label:'Rigenerazione per turno',base:0,cap:1000},damage_reduction:{label:'Riduzione danni',base:0,cap:60,percent:true},
 gold_bonus:{label:'Monete ottenute',base:0,cap:200,percent:true},xp_bonus:{label:'Esperienza ottenuta',base:0,cap:200,percent:true},loot_bonus:{label:'Probabilità bottino',base:0,cap:100,percent:true},
 potion_power:{label:'Potenza delle pozioni',base:0,cap:100,percent:true},speed:{label:'Probabilità colpo rapido',base:0,cap:30,percent:true},accuracy:{label:'Precisione',base:95,cap:100,percent:true},thorns:{label:'Danno riflesso',base:0,cap:1000},
};
const attributes=[];
for(const [stat,definition]of Object.entries(STAT_DEFINITIONS)){
 const units=definition.percent?['percent']:['flat','percent'];
 for(const unit of units){const scale=unit==='percent'&&!definition.percent;
  const lo=stat==='health'&&unit==='flat'?5:1,hi=stat==='health'&&unit==='flat'?15:stat==='critical_damage'?12:unit==='percent'?4:3;
  attributes.push({id:stat+'_'+unit,stat,label:definition.label,unit,operation:scale?'scale':'add',bonus_min:lo,bonus_max:hi,malus_min:1,malus_max:stat==='health'&&unit==='flat'?6:unit==='percent'?3:2});
 }
}
const names={
 attack:[['Affilato','Possente','Spietato'],['dell’Assalto','del Duellante','della Conquista']],
 defense:[['Solido','Tenace','Adamantino'],['della Guardia','del Baluardo','della Fortezza']],
 health:[['Vigoroso','Vitale','Indomito'],['del Vigore','della Vitalità','dell’Immortale']],
 magic_damage:[['Runico','Arcano','Astrale'],['delle Rune','dell’Etere','delle Stelle']],
 critical:[['Preciso','Letale','Inesorabile'],['del Falco','del Predatore','del Carnefice']],
 critical_damage:[['Feroce','Brutale','Devastante'],['della Ferocia','della Rovina','della Catastrofe']],
 dodge:[['Agile','Sfuggente','Evanescente'],['della Brezza','dell’Ombra','del Miraggio']],
 block:[['Vigile','Saldo','Inespugnabile'],['del Custode','della Sentinella','del Bastione']],
 life_steal:[['Vorace','Vampirico','Insaziabile'],['della Sete','del Sangue','del Divoratore']],
 regeneration:[['Ristoratore','Rigenerante','Perenne'],['del Ristoro','della Rinascita','dell’Eternità']],
 damage_reduction:[['Resistente','Protetto','Incrollabile'],['della Resistenza','della Tartaruga','del Titano']],
 gold_bonus:[['Fortunato','Prospero','Opulento'],['del Mercante','del Tesoro','del Sovrano']],
 xp_bonus:[['Sapiente','Illuminato','Trascendente'],['dello Studioso','del Saggio','dell’Oracolo']],
 loot_bonus:[['Scaltro','Avventuroso','Predestinato'],['del Cercatore','della Scoperta','del Destino']],
 potion_power:[['Erboristico','Alchemico','Miracoloso'],['del Rimedio','dell’Alchimista','della Panacea']],
 speed:[['Rapido','Fulmineo','Tempestoso'],['della Lepre','del Fulmine','della Tempesta']],
 accuracy:[['Attento','Infallibile','Onnisciente'],['della Mira','dell’Occhio','della Verità']],
 thorns:[['Spinoso','Ritorsivo','Vendicativo'],['dei Rovi','della Ritorsione','della Vendetta']],
};
const affixes=[];
for(const a of attributes)for(const kind of ['prefix','suffix'])for(let grade=0;grade<3;grade++){
 const penalty=attributes[(attributes.indexOf(a)+7)%attributes.length];
 affixes.push({id:`${a.id}_${kind}_${grade}`,kind,text:names[a.stat][kind==='prefix'?0:1][grade],min_rank:grade+1,
  slots:['weapon','body','feet','ring','amulet'],rolls:[{attribute_id:a.id,sign:1,min:a.bonus_min,max:a.bonus_max,chance:1},
  {attribute_id:penalty.id,sign:-1,min:penalty.malus_min,max:penalty.malus_max,chance:.23}]});
}
const templates=[];
const add=(id,name,sprite,slot,classId,baseStats,options={})=>templates.push({id,name,sprite,slot,category:slot==='weapon'?'weapons':['body','feet'].includes(slot)?'armor':['ring','amulet'].includes(slot)?'supplies':'potions',class_id:classId||null,base_stats:baseStats,min_level:1,set_id:null,starter:false,effect:null,...options});
const weapons={
 guardian:['sword',7,['Spada di ferro','Spada da guardia','Lama del sentiero','Spada del baluardo','Lama del ponte','Spada da duello','Fendente del custode','Spada del bastione','Lama di frontiera','Spada del giuramento','Spada della torre','Lama del capitano','Spada delle rovine','Lama del santuario','Spada della corona','Lama del confine']],
 arcanist:['staff',6,['Bastone di frassino','Bastone del novizio','Bastone del pellegrino','Verga di quarzo','Bastone delle rune','Verga d’avorio','Bastone del crepuscolo','Verga del tomo','Bastone lunare','Verga dell’osservatorio','Bastone della torre','Verga del sigillo','Bastone del vuoto','Verga del prisma','Bastone del consiglio','Verga della cometa']],
 ranger:['bow',7,['Arco di quercia','Arco del cacciatore','Arco da sentiero','Arco del bosco','Arco del falco','Arco di tasso','Arco della vedetta','Arco della frontiera','Arco del cervo','Arco delle nebbie','Arco del tramonto','Arco del pioniere','Arco del nibbio','Arco delle dune','Arco del guardaboschi','Arco dell’orizzonte']],
 rogue:['daggers',7,['Pugnali di ferro','Lame del vicolo','Pugnali gemelli','Lame del sussurro','Pugnali del corvo','Lame del porto','Pugnali ricurvi','Lame del passaggio','Pugnali del sicario','Lame della notte','Pugnali della cripta','Lame dello scorpione','Pugnali del patto','Lame del velo','Pugnali della gilda','Lame dell’eclisse']],
 druid:['nature-staff',6,['Ramo di quercia','Bastone nodoso','Ramo del bosco','Bastone del cerchio','Ramo della sorgente','Bastone di salice','Ramo del germoglio','Bastone del sottobosco','Ramo del vischio','Bastone della radura','Ramo del grande albero','Bastone delle stagioni','Ramo della rugiada','Bastone del muschio','Ramo del risveglio','Bastone delle radici']],
 berserker:['axe',9,['Ascia di ferro','Ascia del taglialegna','Ascia da battaglia','Ascia della forgia','Ascia del valico','Ascia del clan','Ascia spaccaroccia','Ascia del cinghiale','Ascia del monte','Ascia del nord','Ascia del colosso','Ascia della fonderia','Ascia del tuono','Ascia delle ceneri','Ascia del condottiero','Ascia della frattura']],
};
const armorNames={guardian:['Corazza','Usbergo','Pettorale'],arcanist:['Veste','Tunica','Mantello'],ranger:['Giaco','Corpetto','Casacca'],rogue:['Giubba','Cuoio','Farsetto'],druid:['Veste','Tonaca','Manto'],berserker:['Corazza','Pettorale','Giaco']};
const armorThemes=['del sentiero','della frontiera','del presidio','delle rovine'];
for(const [classId,[sprite,attack,list]]of Object.entries(weapons)){
 add('starter-'+classId,classId==='arcanist'?'Bastone di legno':classId==='druid'?'Ramo nodoso':classId==='rogue'?'Pugnali consumati':classId==='ranger'?'Arco semplice':classId==='berserker'?'Ascia usurata':'Spada consumata',sprite,'weapon',classId,{attack},{starter:true});
 list.forEach((name,i)=>add(`${classId}-weapon-${i}`,name,sprite,'weapon',classId,{attack:attack+1+Math.floor(i/4)}));
 const armorSprite=['guardian','berserker'].includes(classId)?'armor-plate':['arcanist','druid'].includes(classId)?'armor-robe':'armor-leather';
 armorNames[classId].forEach((base,i)=>armorThemes.forEach((theme,j)=>add(`${classId}-body-${i}-${j}`,`${base} ${theme}`,armorSprite,'body',classId,{defense:3+i+j})));
}
add('starter-clothes','Vestiti logori','armor-robe','body',null,{defense:1},{starter:true});
const themes=['del viandante','del pellegrino','del custode','del guado','del valico','del bosco','della radura','del porto','del crepuscolo','della torre','della forgia','della luna','dell’alba','delle rovine','del santuario','della corona'];
themes.forEach((theme,i)=>{
 add('boots-'+i,`Stivali ${theme}`,'boots','feet',null,{defense:1+Math.floor(i/5)});
 add('ring-'+i,`Anello ${theme}`,'ring','ring',null,{});
 add('amulet-'+i,`Amuleto ${theme}`,'amulet','amulet',null,{});
});
for(let i=0;i<8;i++){
 const grade=['diluita','semplice','pura','raffinata','concentrata','distillata','superiore','perfetta'][i];
 add('potion-heal-'+i,`Pozione di cura ${grade}`,'potion-red','consumable',null,{}, {min_level:1+i*2,effect:{kind:'heal',amount:35+i*15},category:'potions'});
 add('potion-guard-'+i,`Pozione protettiva ${grade}`,'potion-blue','consumable',null,{}, {min_level:1+i*2,effect:{kind:'guard',amount:15+i*2,turns:3},category:'potions'});
 add('potion-antidote-'+i,`Antidoto ${grade}`,'potion-green','consumable',null,{}, {min_level:1+i*2,effect:{kind:'antidote',amount:5+i*4},category:'potions'});
 add('food-'+i,`Razione ${themes[i]}`,'food','food',null,{}, {min_level:1+i*2,effect:{kind:'food',amount:25+i*12},category:'supplies'});
}
const sets=[];
const setThemes={guardian:['Baluardo del Sole','Guardia del Re','Custodia Eterna','Egida del Primo Sole','Trono Inespugnabile'],arcanist:['Cerchio delle Rune','Concilio Astrale','Eredità del Vuoto','Arconte delle Stelle','Dominio dell’Infinito'],ranger:['Falco dei Sentieri','Veglia del Bosco','Orizzonte Selvaggio','Occhio dell’Eternità','Custode dell’Ultimo Orizzonte'],rogue:['Patto del Corvo','Sussurro della Notte','Eclisse Silenziosa','Lame del Crepuscolo','Sovrano delle Ombre'],druid:['Voce della Quercia','Respiro del Bosco','Ciclo delle Stagioni','Cuore del Mondo','Risveglio Primordiale'],berserker:['Furia della Forgia','Sangue del Clan','Ira del Titano','Furia dell’Antico','Apoteosi del Colosso']};
for(const [classId,list]of Object.entries(setThemes))list.forEach((name,tier)=>{
 const id=`${classId}-set-${tier}`,level=[5,12,20,30,45][tier],m=tier+1,unique=tier>=3;
 const signature={guardian:['block_percent',5],arcanist:['magic_damage_flat',5],ranger:['critical_percent',4],rogue:['speed_percent',4],druid:['regeneration_flat',3],berserker:['life_steal_percent',3]}[classId];
 sets.push({id,name,class_id:classId,min_level:level,min_depth:unique?[60,100][tier-3]:0,unique,bonuses:unique?[
  {pieces:2,rarity:'unique',attribute_id:'attack_percent',value:tier===3?35:45},
  {pieces:3,rarity:'unique',attribute_id:'health_percent',value:tier===3?60:75},
  {pieces:3,rarity:'unique',attribute_id:'defense_percent',value:tier===3?50:60},
  {pieces:4,rarity:'unique',attribute_id:signature[0],value:({guardian:[25,35],arcanist:[60,100],ranger:[25,35],rogue:[20,25],druid:[12,20],berserker:[8,12]})[classId][tier-3]},
  {pieces:5,rarity:'unique',attribute_id:'attack_percent',value:tier===3?60:75},
  {pieces:5,rarity:'unique',attribute_id:'damage_reduction_percent',value:tier===3?15:20},
  {pieces:5,rarity:'unique',attribute_id:'xp_bonus_percent',value:25},
 ]:[
  {pieces:2,rarity:'rare',attribute_id:'defense_percent',value:5*m},
  {pieces:3,rarity:'mythic',attribute_id:'health_flat',value:15*m},
  {pieces:4,rarity:'legendary',attribute_id:signature[0],value:signature[1]*m},
 ]});
 for(const key of ['weapon','body','feet','accessory','ring']){
  const slot=key==='accessory'?'amulet':key;
  const sprite=slot==='weapon'?weapons[classId][0]:slot==='body'?(['guardian','berserker'].includes(classId)?'armor-plate':['arcanist','druid'].includes(classId)?'armor-robe':'armor-leather'):slot==='feet'?'boots':slot==='ring'?'ring':'amulet';
  add(`${id}-${key}`,`${slot==='ring'?'Anello':SLOTS[slot]} · ${name}`,sprite,slot,classId,slot==='weapon'?{attack:weapons[classId][1]+3*m}:slot==='body'?{defense:4+2*m}:slot==='feet'?{defense:2+m}:{},{set_id:id,min_level:level});
 }
});
const ENEMIES=[{id:'slime',name:'Melma del sentiero',sprite:'slime',poison:true},{id:'wolf',name:'Lupo del branco',sprite:'wolf'},{id:'raider',name:'Predone delle rovine',sprite:'skull'}];
const RULES={encounter_steps:25,exchange_steps:50,exchange_coins:20,merchant_refresh_base:10,merchant_refresh_per_level:3};
const compatibleSlots=slot=>slot==='ring'?['ring1','ring2']:Object.hasOwn(SLOTS,slot)?[slot]:[];
module.exports={compatibleSlots,RULES,CLASSES,SLOTS,RARITIES,STAT_DEFINITIONS,ATTRIBUTES:attributes,AFFIXES:affixes,TEMPLATES:templates,SETS:sets,ENEMIES};
