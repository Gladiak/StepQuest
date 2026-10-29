'use strict';
function raritySelection(values,rarities,GameError){
 if(!Array.isArray(values)||values.length>rarities.length||values.some(id=>typeof id!=='string'||!rarities.some(r=>r.id===id))||new Set(values).size!==values.length)throw new GameError('Filtro di rarità non valido.');
 return rarities.slice().sort((a,b)=>a.rank-b.rank).filter(r=>values.includes(r.id)).map(r=>r.id);
}
module.exports={raritySelection};
