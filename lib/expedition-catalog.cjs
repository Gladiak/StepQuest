'use strict';
const ROUTES=[
 {id:'grove',name:'Bosco dei sussurri',risk:'Prudente',cost:50,factor:.8,bounty:1,description:'Incontri più miti, erbe curative e piccole scoperte.'},
 {id:'ruins',name:'Rovine della veglia',risk:'Impegnativo',cost:75,factor:1,bounty:1.45,description:'Reliquie, altari e un guardiano a difesa del tesoro.'},
 {id:'research',name:'Ricerca mirata',risk:'Ricerca',research:true,cost:400,factor:1,bounty:0,description:'Scegli uno slot o un set ordinario e uno dei due premi finali.'},
 {id:'pass',name:'Passo delle ceneri',risk:'Pericoloso',cost:100,factor:1.2,bounty:1.9,description:'Nemici più feroci e una ricompensa finale maggiore.'},
 {id:'watch',atlas:true,name:'Il Faro delle Lanterne',risk:'Regionale',cost:75,factor:1,bounty:1.45,description:'Quattro tappe fra campane e rune. Le scelte della provincia cambiano il percorso.'}
];
function makePlan(route,stage,rng){
 const gold=Math.round((6+stage*2)*route.bounty),option=(id,title,kind,description,extra={})=>({id,title,kind,description,...extra});
 const stories=[
  {title:'Il viandante ferito',text:'Un esploratore ti chiama dal margine del sentiero.',options:[option('help','Condividi le provviste','aid',`Perdi il 10% della vita massima; ottieni ${gold+10} monete in sacca e +4 difesa per questa spedizione.`,{gold:gold+10,damage:.1,defense:4}),option('guide','Indicagli la strada','cache',`Nessun rischio. Ricevi ${Math.round(gold*.45)} monete in sacca.`,{gold:Math.round(gold*.45)})]},
  {title:'Il forziere delle radici',text:'La serratura è spezzata. Sottili fili di rame scompaiono nel terreno.',options:[option('open','Forza il forziere','risk',`70%: ${gold*2} monete in sacca. 30%: trappola, perdi il 18% della vita massima.`,{gold:gold*2,damage:.18,chance:.7}),option('careful','Recupera le monete sparse','cache',`Nessun rischio. ${Math.round(gold*.55)} monete in sacca.`,{gold:Math.round(gold*.55)})]},
  {title:'La carovana perduta',text:'Un carro rovesciato nasconde una cassa sigillata e una scorta di erbe.',options:[option('herbs','Raccogli le erbe','heal','Recuperi il 22% della vita massima. Nessuna moneta.',{heal:.22}),option('supplies','Apri la cassa','cache',`${gold} monete in sacca. Rinunci alle erbe.`,{gold})]},
  {title:'L’altare senza nome',text:'Un bagliore scorre tra le rune. Ogni dono chiede qualcosa in cambio.',options:[option('oath','Giura sul tuo sangue','oath','Perdi il 15% della vita massima. +25% attacco per il resto della spedizione.',{damage:.15,attack:25}),option('respect','Lascia riposare l’altare','cache',`Recuperi un antico obolo: ${Math.round(gold*.5)} monete in sacca.`,{gold:Math.round(gold*.5)})]}
 ];
 const story=stories[Math.min(stories.length-1,Math.floor(rng()*stories.length))];
 return [
  {title:'Tracce al bivio',text:'Le impronte portano verso una pattuglia. Un sentiero laterale conduce a un vecchio deposito.',options:[option('patrol','Segui le impronte','battle',`Scontro. Premi normali, più ${gold} monete in sacca.`,{gold}),option('search','Esplora il deposito','risk',`70%: ${gold} monete in sacca. 30%: perdi il 12% della vita massima.`,{gold,damage:.12,chance:.7})]},
  {title:rng()<.5?'Il campo abbandonato':'La fonte del crepuscolo',text:'Puoi recuperare le forze oppure accettare una benedizione. Il luogo potrà aiutarti una sola volta.',options:[option('rest','Recupera le forze','heal','Recuperi il 35% della vita massima. Rinunci alla benedizione.',{heal:.35}),option('bless','Accetta la benedizione','blessing','+18% attacco e +2 difesa fino alla fine della spedizione.',{attack:18,defense:2})]},
  story,
  {title:'Il custode del sentiero',text:'Il guardiano protegge l’ultimo passaggio. Puoi affrontarlo o tornare con quanto hai raccolto.',options:[option('guardian','Affronta il custode','boss','Scontro finale. Vittoria: monete bonus e un oggetto almeno non comune.',{gold:gold*2})]}
 ];
}
module.exports={ROUTES,makePlan};
