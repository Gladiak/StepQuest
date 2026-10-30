'use strict';
const VERSION=2,WARDEN_TITLE={id:'province',name:'Cronista del Rifugio'};
const NODES=[
 {id:'refuge',kind:'hub',name:'Il Rifugio',region:'Cuore della provincia',x:16,y:74,description:'Ogni sentiero comincia da una promessa. La Gilda conserva le tue mappe e le tue storie.'},
 {id:'tracks',kind:'story',questId:'caravan-tracks',name:'Il sentiero delle lanterne',region:'Bosco delle Lanterne',x:25,y:45,description:'Fra i pini restano i segni di una carovana. Una luce lontana invita a cercare.'},
 {id:'caravan',kind:'story',questId:'caravan-return',name:'Il campo dei viandanti',region:'Bosco delle Lanterne',x:14,y:24,description:'Un accampamento attende il ritorno dei viandanti. La strada ricorderà la tua promessa.'},
 {id:'signs',kind:'story',questId:'mountain-signs',name:'La galleria dimenticata',region:'Pendici della Montagna',x:43,y:25,description:'Segni antichi e polvere d’argento custodiscono la memoria dei primi minatori.'},
 {id:'pact',kind:'story',questId:'mountain-pact',name:'Il santuario delle rune',region:'Pendici della Montagna',x:59,y:15,description:'Sopra le nuvole, la pietra ascolta. Il futuro della montagna dipende da una scelta.'},
 {id:'message',kind:'story',questId:'river-message',name:'Il villaggio del fiume',region:'Terre del Fiume',x:74,y:29,description:'Una bottiglia porta notizie dalla riva orientale. Il vecchio pontile aspetta aiuto.'},
 {id:'bridge',kind:'story',questId:'river-bridge',name:'Le due rive',region:'Terre del Fiume',x:79,y:61,description:'L’acqua separa le rive, ma i viaggiatori cercano sempre una via per incontrarsi.'},
 {id:'oak',kind:'event',name:'La quercia dei nomi',region:'Crocevia dei viandanti',x:44,y:52,requires:1,description:'Una vecchia quercia raccoglie i nomi di chi torna. Ai suoi piedi trovi una lanterna spenta.',choices:[{label:'Accendi la lanterna',text:'La luce rimane accesa fra le radici. Di notte indica ai viandanti la strada del Rifugio.'},{label:'Lascia una dedica',text:'Affidi alla quercia una promessa. I viandanti aggiungono piccoli nastri ai suoi rami.'}]},
 {id:'well',kind:'event',name:'Il pozzo delle stelle',region:'Crocevia dei viandanti',x:56,y:78,requires:2,description:'Il mosaico di un pozzo riflette un cielo dimenticato. Un anziano cartografo ti invita a fermarti.',choices:[{label:'Ricomponi il mosaico',text:'Le tessere tornano a disegnare una costellazione. Una stella del mosaico indica il Faro.'},{label:'Ascolta il cartografo',text:'Il cartografo racconta il primo viaggio della Gilda. Ora sai perché il Faro attende una luce.'}]},
 {id:'watch',kind:'expedition',name:'Il Faro delle Lanterne',region:'Confine orientale',x:93,y:32,requires:1,description:'Il faro veglia sulla provincia da secoli. Il suo custode mette alla prova chi vuole riaccenderlo.'}
];
const LINKS=[['refuge','tracks'],['tracks','caravan'],['refuge','oak'],['oak','signs'],['signs','pact'],['oak','well'],['well','bridge'],['bridge','message'],['message','watch']];
const VARIANTS={
 'caravan-tracks':['I viandanti hanno trovato riparo. Una mappa lasciata al Rifugio rivela il campo.','Le provviste sono al sicuro. I segni dei mercanti indicano il campo.'],
 'caravan-return':['Le lanterne sono tornate. Le tende si aprono ai viandanti della provincia.','Il rifugio dei viandanti è rifornito. Nessuno affronterà il bosco senza una sosta.'],
 'mountain-signs':['Le rune sono state copiate. Il santuario sulla cresta ha finalmente un nome.','Il passaggio è segnato. Gli esploratori raggiungono la cresta in sicurezza.'],
 'mountain-pact':['La galleria è un santuario protetto. Sulla montagna brillano rune di custodia.','Le mappe sono condivise. Lanterne dei minatori guidano verso la galleria.'],
 'river-message':['Il villaggio ha ricevuto la tua visita. La traghettatrice ti saluta dal pontile.','La squadra della Gilda è arrivata. Le due rive si preparano a ritrovarsi.'],
 'river-bridge':['Un ponte unisce le rive. Una bussola incisa ricorda la tua scelta.','I traghetti sono tornati. Una lanterna della Gilda veglia sul pontile.']
};
function makeAtlasPlan(route,stage,rng,snapshot){
 const plan=require('./expedition-catalog.cjs').makePlan({...route,atlas:false},stage,rng),gold=Math.round((6+stage*2)*route.bounty),choices=snapshot.guild;
 plan[0].title='Il sentiero delle campane';plan[0].text=choices['caravan-return']===1?'Le provviste del rifugio accompagnano il ricordo dei viandanti. Le campane del Faro risuonano fra i pini.':'Le lanterne dei viandanti segnano il sentiero. Le campane del Faro risuonano fra i pini.';
 plan[1].title='Le pietre di veglia';plan[1].text=snapshot.events.oak===0?'Una lanterna accesa indica un riparo fra le pietre.':snapshot.events.oak===1?'Nastri e segni dei viandanti indicano un riparo fra le pietre.':'Le pietre offrono riparo dal vento. Puoi fermarti a recuperare le forze.';
 if(choices['river-bridge']===0){
  plan[0].title='Il ponte ritrovato';plan[0].text='Sulle assi del ponte brilla la bussola che ricorda la tua promessa. Oltre il fiume, il Faro tace.';
  plan[0].options[0].title='Proteggi chi attraversa';
  plan[0].options[1]={id:'search',title:'Metti in sicurezza il passaggio',kind:'blessing',description:'+4 difesa per questa spedizione. Nessuno scontro.',defense:4};
 }else if(choices['river-bridge']===1){
  plan[0].title='La barca delle lanterne';plan[0].text='La traghettatrice ti riconosce. «Una volta ci hai riportati a casa. Ora tocca a noi accompagnarti.»';
  plan[0].options[0].title='Scorta la barca fra le ombre';
  plan[0].options[1]={id:'search',title:'Accetta il ristoro dei traghettatori',kind:'heal',description:'Recuperi il 20% della vita massima. Nessuno scontro.',heal:.2};
 }
 plan[2]={title:'L’ultima fiamma',text:choices['mountain-pact']===0?'La runa del santuario custodisce una brace ancora viva. Puoi affidarle le tue ferite o portarla alla cima.':'Fra le pietre una brace resiste al vento. Puoi affidarle le tue ferite o portarla alla cima.',options:[
  {id:'embers',title:'Scaldati all’ultima fiamma',kind:'heal',description:'Recuperi il 35% della vita massima. Rinunci alla protezione contro l’alba.',heal:.35,watchFlameChoice:'heal'},
  {id:'rune',title:'Custodisci la fiamma',kind:'blessing',description:'Riduce del 70% i danni della prima alba spezzata che ti colpisce. Una sola protezione.',watchFlame:1,watchFlameChoice:'shield'}
 ]};
 plan[3].title='Il Custode del Faro';plan[3].text='«Non custodisco una torre. Custodisco l’alba che non avete più osato chiamare.» Il Custode solleva la lanterna. A metà vita spezzerà il sigillo: osserva il suo intento e preparati a difenderti.';
 plan[3].options[0].mechanic=require('./watch-finale.cjs').MECHANIC;
 plan[3].options[0].description='Custode in due fasi. Leggi gli intenti, difendi contro l’alba e colpisci quando è esposto. Vittoria: riaccendi il Faro e ottieni il premio della spedizione.';
 return plan;
}
module.exports={VERSION,NODES,LINKS,VARIANTS,WARDEN_TITLE,makeAtlasPlan};
