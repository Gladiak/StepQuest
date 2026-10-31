'use strict';
const TIERS=[
 {id:'wanderer',level:1,name:'Banco del viandante',text:'Le prime lame, un pasto caldo e una promessa sulla strada.',weights:{common:45,uncommon:55},affixes:1,every:1,featured:'uncommon'},
 {id:'embers',level:4,name:'Carovana delle braci',text:'Le carovane portano pezzi scelti per chi affronta i primi pericoli.',weights:{common:10,uncommon:45,rare:45},affixes:2,every:2,featured:'rare'},
 {id:'stars',level:15,name:'Bazar delle stelle',text:'Fra i banchi brillano opere mitiche e occasioni leggendarie.',weights:{uncommon:15,rare:50,mythic:30,legendary:5},affixes:3,every:3,featured:'legendary'},
 {id:'champions',level:45,name:'Emporio dei campioni',text:'Mercanti esperti scelgono strumenti degni delle imprese del Rifugio.',weights:{rare:25,mythic:55,legendary:20},affixes:4,every:2,featured:'legendary'},
 {id:'marvels',level:150,name:'Conclave delle meraviglie',text:'Ogni carovana custodisce un’occasione leggendaria.',weights:{mythic:60,legendary:40},affixes:5,every:1,featured:'legendary'},
 {id:'eternity',level:500,name:'Crocevia dell’eternità',text:'Le grandi rotte convergono qui: leggende forgiate e provviste per l’impossibile.',weights:{mythic:35,legendary:65},affixes:5,every:1,featured:'legendary'}
];
const PURPOSES={fortune:{name:'Fortuna del viandante',attributes:['gold_bonus_percent','xp_bonus_percent']},hunt:{name:'Scorta del cacciatore',attributes:['loot_bonus_percent','potion_power_percent']}};
const tierFor=level=>TIERS.filter(t=>level>=t.level).at(-1);
const nextTier=level=>TIERS.find(t=>t.level>level)||null;
const MAX_RATIONS=20,MAX_PER_VICTORY=3;
module.exports={TIERS,PURPOSES,tierFor,nextTier,MAX_RATIONS,MAX_PER_VICTORY};
