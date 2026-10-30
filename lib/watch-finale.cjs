'use strict';

// The mechanic belongs to the saved encounter, never to a live Atlas choice.
const MECHANIC='lantern-v1';
function watchIntent(enemy,round,buffs={}){
 if(enemy.mechanic!==MECHANIC)return null;
 const phase=buffs.watchPhase===2?2:1;
 if(phase===1){const heavy=(round+1)%3===0;return {phase,kind:heavy?'strike':'attack',label:'La veglia del Custode',text:heavy?'Intento: colpo della lanterna. Difendi per ridurre i danni.':'Intento: attacco del Custode.',multiplier:heavy?1.5:1,vulnerable:false};}
 const turn=(buffs.watchTurn||0)%3,kind=['gather','dawn','exposed'][turn];
 return {phase,kind,label:'L’alba prigioniera',text:turn===0?'Intento: raccoglie la luce. Il prossimo turno scatenerà l’alba.':turn===1?'Intento: alba spezzata. Difendi ora; poi il Custode sarà vulnerabile.':'Intento: Custode esposto. I tuoi attacchi infliggono il 50% di danni in più.',multiplier:turn===1?2.3:turn===2?.65:0,vulnerable:turn===2};
}
function watchMemory(snapshot,boosts={}){
 const river=snapshot.guild['river-bridge'];
 return {version:1,title:'La notte in cui tornarono le stelle',passage:river===0?'Hai raggiunto il Faro sul ponte che avevi restituito alla provincia.':river===1?'I traghettatori che avevi aiutato ti hanno condotto verso il Faro.':'Hai seguito le campane lungo la riva nascosta, aprendo una strada verso il Faro.',flame:boosts.watchFlameChoice==='shield'?'Hai custodito l’ultima fiamma per affrontare l’alba del Custode.':'Hai affidato all’ultima fiamma le tue ferite prima di salire alla cima.',ending:'La luce supera il fiume, accarezza la Quercia e raggiunge il Rifugio. Una dopo l’altra, le finestre si accendono. La provincia conosce di nuovo la strada di casa.',home:'Il cartografo chiude la sua mappa. «Stanotte nessuno dovrà cercare la strada al buio. Questo lo dobbiamo a te.»'};
}
module.exports={MECHANIC,watchIntent,watchMemory};
