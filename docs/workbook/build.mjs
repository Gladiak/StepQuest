import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outputDir = path.join(root, 'outputs/stepquest-20261028');
const previewDir = path.join(root, 'docs/workbook/previews');
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const wb = Workbook.create();
const colors = { ink: '#253B32', green: '#345C45', pale: '#EDF3E6', amber: '#FFF0CC', purple: '#68557D', muted: '#6E7970', line: '#DDE5D8' };
const names = ['Visione', 'Parametri', 'Economia', 'Combattimento', 'Loop e progressione', 'Classi', 'Mondo', 'Pixel art', 'Dati e ledger', 'Piano', 'Validazione'];
const sheets = Object.fromEntries(names.map(name => [name, wb.worksheets.add(name)]));
const letter = n => { let s=''; for (;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s;return s; };
const cell = (sheet, address, value) => sheet.getRange(address).values = [[value]];
const formula = (sheet, address, value) => sheet.getRange(address).formulas = [[value]];
const rowsMeta=[];
function setup(name, title, context, widths, rowCount=70) {
  const s=sheets[name], end=letter(widths.length);
  s.showGridLines=false;
  const range=s.getRange(`A1:${end}${rowCount}`);
  range.format.font={name:'Arial',size:10,color:colors.ink};
  range.format.verticalAlignment='center'; range.format.rowHeight=23;
  widths.forEach((width,i)=>s.getRange(`${letter(i+1)}1:${letter(i+1)}${rowCount}`).format.columnWidth=width);
  cell(s,'A2',title); s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:colors.ink};
  s.getRange(`A3:${end}3`).format.borders={bottom:{style:'thin',color:colors.line}};
  cell(s,'A4',context); s.getRange('A4').format.font={name:'Arial',size:10,italic:true,color:colors.muted};
  return s;
}
function table(s, start, headers, rows, widths, {height=42,freeze=true,numeric=[]}={}) {
  const end=letter(headers.length), last=start+rows.length;
  s.getRange(`A${start}:${end}${last}`).values=[headers,...rows];
  s.getRange(`A${start}:${end}${start}`).format={fill:colors.green,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:32};
  if(rows.length){
    const body=s.getRange(`A${start+1}:${end}${last}`);body.format.wrapText=true;body.format.verticalAlignment='top';
    for(let i=0;i<rows.length;i++){
      const row=rows[i];
      const lines=Math.max(...row.map((v,j)=>Math.ceil(String(v??'').length/(widths[j]*.96))));
      const rh=Math.max(height,Math.min(160,lines*14+12));
      s.getRange(`A${start+i+1}:${end}${start+i+1}`).format.rowHeight=rh;
      if(i%2===1)s.getRange(`A${start+i+1}:${end}${start+i+1}`).format.fill='#F5F7F1';
    }
    for(const i of numeric)s.getRange(`${letter(i+1)}${start+1}:${letter(i+1)}${last}`).setNumberFormat('#,##0');
  }
  if(freeze)s.freezePanes.freezeRows(start);
  rowsMeta.push({sheet:s.name,start,end:last,columns:headers.length});
  return last+3;
}

// Parametri: un solo punto di modifica per i due modelli.
const params=[
 ['Passi importati al giorno',3800,'passi/giorno','Profilo sintetico costante. Non è un obiettivo di salute.'],
 ['Conversione passi',1,'crediti/passo','Tutti i passi ammissibili vengono riconosciuti. Nessun cap giornaliero.'],
 ['Bonus iniziale',2000,'crediti','Una sola assegnazione per profilo. Nessun backfill storico di default.'],
 ['Spedizioni completate al giorno',2,'spedizioni/giorno','Assunzione di volume riuscito. Il modello non simula le probabilità di vittoria.'],
 ['Cibi desiderati al giorno',1,'oggetti/giorno','Opzionali. Si compra solo con fondi sufficienti.'],
 ['Prezzo di un cibo',900,'crediti/oggetto','Proposta iniziale. Cura gratuita al campo sempre disponibile.'],
 ['Materiali per spedizione',3,'materiali/spedizione','Quantità attesa nel modello, non ricompensa garantita per ogni esito.'],
 ['Giorni tra tentativi upgrade',7,'giorni','Cadenza di pianificazione del modello. Nessun cooldown reale proposto.'],
 ['Primo prezzo equipaggiamento',10000,'crediti/upgrade','Un upgrade rappresenta un acquisto o miglioramento al grado successivo.'],
 ['Crescita prezzo per upgrade',1.35,'moltiplicatore','Prezzo arrotondato al credito con ROUND, non ceil floating.'],
 ['Materiali richiesti per upgrade',35,'materiali/upgrade','Requisito di avanzamento conquistato nel gioco.'],
 ['Classe nel modello',1,'1 Guardiano, 2 Ranger, 3 Arcanista','Selettore unico delle statistiche del modello di combattimento.'],
 ['Livello eroe',10,'livello','Eroe mantenuto fisso mentre aumenta la profondità.'],
 ['Grado equipaggiamento eroe',2,'grado','Valore dimostrativo. Non è il numero degli upgrade del modello economico.'],
 ['Crescita HP per livello',0.06,'quota/livello','Crescita lineare del modello eroe.'],
 ['Crescita attacco per livello',0.08,'quota/livello','Crescita lineare del modello eroe.'],
 ['Attacco extra per grado',4,'danno/grado','Bonus di equipaggiamento uguale per il confronto iniziale.'],
 ['HP mostro al piano 1',80,'HP','Archetipo neutro, senza resistenze o abilità speciali.'],
 ['Attacco mostro al piano 1',12,'danno','Attacco prima della mitigazione.'],
 ['Armatura mostro al piano 1',15,'armatura','Modello di mitigazione: danno * 100 / (100 + armatura).'],
 ['Crescita HP mostro per piano',0.08,'quota/piano','Stress test fino al piano 40, non formula infinita del gioco definitivo.'],
 ['Crescita attacco per piano',0.06,'quota/piano','Il gioco definitivo normalizza i settori per evitare numeri illimitati.'],
 ['Crescita armatura per piano',0.03,'quota/piano','Crescita lineare.'],
 ['Intervallo boss',5,'piani','Un boss ogni cinque piani nel modello.'],
 ['Moltiplicatore HP boss',1.8,'moltiplicatore','Difficoltà boss di esempio.'],
 ['Moltiplicatore attacco boss',1.2,'moltiplicatore','Da tarare per classe e abilità.'],
 ['HP base eroe',null,'HP','Calcolati dalla classe scelta.'],
 ['Attacco base eroe',null,'danno','Calcolato dalla classe scelta.'],
 ['Armatura base eroe',null,'armatura','Calcolata dalla classe scelta.'],
 ['Probabilità critico',null,'quota','Valore atteso, non esito di un tiro casuale.'],
 ['Moltiplicatore critico',1.5,'moltiplicatore','Il modello ignora varianza, schivata e abilità.'],
];
const P=Object.fromEntries(params.map((p,i)=>[p[0],i+7]));
const ref=name=>`'Parametri'!$B$${P[name]}`;
{
const widths=[43,20,37,74];const s=setup('Parametri','Parametri di bilanciamento','Giallo = input modificabile. I numeri sono ipotesi di prototipo, non valori validati.',widths,44);
s.tabColor='#648563';table(s,6,['Parametro','Valore','Unità','Definizione e limite'],params,widths,{height:31,numeric:[1]});
s.getRange('B7:B37').format.fill=colors.amber;
for(let r=7;r<=37;r++)s.getRange(`B${r}`).setNumberFormat('#,##0.00');
for(const name of ['Passi importati al giorno','Bonus iniziale','Spedizioni completate al giorno','Cibi desiderati al giorno','Prezzo di un cibo','Materiali per spedizione','Giorni tra tentativi upgrade','Primo prezzo equipaggiamento','Materiali richiesti per upgrade','Classe nel modello','Livello eroe','Grado equipaggiamento eroe','Intervallo boss'])s.getRange(`B${P[name]}`).setNumberFormat('#,##0');
for(const name of ['Crescita HP per livello','Crescita attacco per livello','Crescita HP mostro per piano','Crescita attacco per piano','Crescita armatura per piano'])s.getRange(`B${P[name]}`).setNumberFormat('0.0%');
formula(s,`B${P['HP base eroe']}`,`=CHOOSE(${ref('Classe nel modello')},150,105,85)`);
formula(s,`B${P['Attacco base eroe']}`,`=CHOOSE(${ref('Classe nel modello')},18,24,30)`);
formula(s,`B${P['Armatura base eroe']}`,`=CHOOSE(${ref('Classe nel modello')},45,20,10)`);
formula(s,`B${P['Probabilità critico']}`,`=CHOOSE(${ref('Classe nel modello')},0.05,0.15,0.1)`);
s.getRange(`B${P['HP base eroe']}:B${P['Probabilità critico']}`).format.fill=colors.pale;
s.getRange(`B${P['Probabilità critico']}`).setNumberFormat('0.0%');
s.dataValidations.add({range:`B${P['Classe nel modello']}`,rule:{type:'whole',operator:'between',formula1:1,formula2:3}});
for(const name of ['Passi importati al giorno','Bonus iniziale','Cibi desiderati al giorno','Grado equipaggiamento eroe'])s.dataValidations.add({range:`B${P[name]}`,rule:{type:'whole',operator:'between',formula1:0,formula2:1000000}});
for(const name of ['Prezzo di un cibo','Giorni tra tentativi upgrade','Primo prezzo equipaggiamento','Materiali richiesti per upgrade','Intervallo boss','Livello eroe'])s.dataValidations.add({range:`B${P[name]}`,rule:{type:'whole',operator:'between',formula1:1,formula2:1000000}});
}

// Economia: budget di spesa e materiali con riporto giornaliero.
{
const s=setup('Economia','Economia dei passi su quattro cicli','Budget aggregato: 28 giorni con cicli da 7. Acquisti a fine ciclo, cibo prima degli upgrade. Nessuna stima di vittoria.',[11,12,12,14,12,13,13,13,11,14,11,14,14,16,3,17,17,17,17,17],50);
cell(s,'A6','Crediti guadagnati');formula(s,'C6','=SUM(C12:C15)');
cell(s,'E6','Spesa totale');formula(s,'G6','=SUM(F12:F15)+SUM(M12:M15)');
cell(s,'I6','Saldo finale');formula(s,'K6','=N15');
cell(s,'A8','Upgrade acquistati');formula(s,'C8','=SUM(K12:K15)');
cell(s,'E8','Quota crediti spesi');formula(s,'G8','=IF(C6=0,"n.a.",G6/C6)');s.getRange('G8').setNumberFormat('0.0%');
cell(s,'I8','Cibi acquistati');formula(s,'K8','=SUM(E12:E15)');
for(const address of ['C6','G6','K6','C8','K8'])s.getRange(address).setNumberFormat('#,##0');
const headers=['Ciclo','Passi','Crediti','Saldo iniziale','Cibi n.','Spesa cibo','Materiali in','Materiali iniziali','Upgrade prec.','Prezzo upgrade','Upgrade n.','Materiali finali','Spesa upgrade','Saldo finale'];
table(s,11,headers,Array.from({length:4},(_,i)=>[i+1,...Array(13).fill(null)]),Array(14).fill(13),{height:32,numeric:Array.from({length:14},(_,i)=>i)});
for(let r=12;r<=15;r++){
 formula(s,`B${r}`,`=${ref('Passi importati al giorno')}*${ref('Giorni tra tentativi upgrade')}`);
 formula(s,`C${r}`,`=INT(${ref('Passi importati al giorno')}*${ref('Conversione passi')})*${ref('Giorni tra tentativi upgrade')}`);
 formula(s,`D${r}`,r===12?`=${ref('Bonus iniziale')}`:`=N${r-1}`);
 formula(s,`E${r}`,`=MIN(${ref('Cibi desiderati al giorno')}*${ref('Giorni tra tentativi upgrade')},INT((D${r}+C${r})/${ref('Prezzo di un cibo')}))`);
 formula(s,`F${r}`,`=E${r}*${ref('Prezzo di un cibo')}`);
 formula(s,`G${r}`,`=${ref('Spedizioni completate al giorno')}*${ref('Materiali per spedizione')}*${ref('Giorni tra tentativi upgrade')}`);
 formula(s,`H${r}`,r===12?'=0':`=L${r-1}`);
 formula(s,`I${r}`,r===12?'=0':`=I${r-1}+K${r-1}`);
 formula(s,`J${r}`,`=ROUND(${ref('Primo prezzo equipaggiamento')}*${ref('Crescita prezzo per upgrade')}^I${r},0)`);
 formula(s,`K${r}`,`=IF(AND(H${r}+G${r}>=${ref('Materiali richiesti per upgrade')},D${r}+C${r}-F${r}>=J${r}),1,0)`);
 formula(s,`L${r}`,`=H${r}+G${r}-K${r}*${ref('Materiali richiesti per upgrade')}`);
 formula(s,`M${r}`,`=K${r}*J${r}`);
 formula(s,`N${r}`,`=D${r}+C${r}-F${r}-M${r}`);
}
const chart=s.charts.add('line',[s.getRange('A11:A15'),s.getRange('N11:N15')]);chart.title='Saldo a fine ciclo (crediti)';chart.setPosition('P11','U28');chart.hasLegend=false;
chart.titleTextStyle.typeface='Arial';chart.titleTextStyle.fontSize=13;chart.series.items[0].line={fill:colors.green,style:'solid',width:2};
chart.xAxis={axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:10}};chart.yAxis={numberFormatCode:'#,##0',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:10}};
cell(s,'A18','Giorni simulati');formula(s,'C18',`=4*${ref('Giorni tra tentativi upgrade')}`);
cell(s,'A20','Interpretazione');cell(s,'B21','Il saldo misura capacità di spesa. Non determina da solo potenza, vittorie o benessere.');
cell(s,'B22','Cibo opzionale: il campo gratuito deve consentire di risparmiare per equipaggiarsi.');
cell(s,'B23','Molti passi creano riserva. Materiali e padronanza governano la potenza verticale.');
cell(s,'B24','Il modello aggrega per ciclo. Non dimostra la disponibilità di monete in un giorno specifico.');
cell(s,'B25','Ipotesi costanti: passi e spedizioni per giorno. Il fallimento e l’utilità del cibo non sono simulati.');
s.getRange('N12:N15').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FBE3DB',font:{color:'#9C3927'}}});
}

// Combattimento: pressione attesa, non probabilità di vittoria.
{
const s=setup('Combattimento','Curva di pressione del combattimento','Modello statico: eroe agisce per primo, nessuna abilità, schivata o cura. Non è una stima di win rate.',[9,12,15,14,14,14,15,15,12,15,15,15,16,19,3,17,17,17,17,17],60);
cell(s,'A6','HP eroe');formula(s,'C6',`=ROUND(${ref('HP base eroe')}*(1+${ref('Crescita HP per livello')}*(${ref('Livello eroe')}-1)),0)`);
cell(s,'E6','Attacco eroe');formula(s,'G6',`=${ref('Attacco base eroe')}*(1+${ref('Crescita attacco per livello')}*(${ref('Livello eroe')}-1))+${ref('Grado equipaggiamento eroe')}*${ref('Attacco extra per grado')}`);
cell(s,'I6','Armatura eroe');formula(s,'K6',`=${ref('Armatura base eroe')}`);
cell(s,'A8','Classe selezionata');formula(s,'C8',`=CHOOSE(${ref('Classe nel modello')},"Guardiano","Ranger","Arcanista")`);
const headers=['Piano','Boss','HP mostro','Attacco mostro','Armatura','Danno eroe','Danno mostro','Turni per KO','Attacchi subiti','Danno subito','HP residui','Pressione HP','Esito teorico','Decisione'];
table(s,11,headers,Array.from({length:40},(_,i)=>[i+1,...Array(13).fill(null)]),Array(14).fill(14),{height:29,numeric:[0,2,3,4,5,6,7,8,9,10]});
for(let r=12;r<=51;r++){
 formula(s,`B${r}`,`=IF(MOD(A${r},${ref('Intervallo boss')})=0,1,0)`);
 formula(s,`C${r}`,`=ROUND(${ref('HP mostro al piano 1')}*(1+${ref('Crescita HP mostro per piano')})^(A${r}-1)*IF(B${r}=1,${ref('Moltiplicatore HP boss')},1),0)`);
 formula(s,`D${r}`,`=${ref('Attacco mostro al piano 1')}*(1+${ref('Crescita attacco per piano')})^(A${r}-1)*IF(B${r}=1,${ref('Moltiplicatore attacco boss')},1)`);
 formula(s,`E${r}`,`=${ref('Armatura mostro al piano 1')}*(1+${ref('Crescita armatura per piano')}*(A${r}-1))`);
 formula(s,`F${r}`,`=$G$6*100/(100+E${r})*(1+${ref('Probabilità critico')}*(${ref('Moltiplicatore critico')}-1))`);
 formula(s,`G${r}`,`=D${r}*100/(100+$K$6)`);
 formula(s,`H${r}`,`=ROUNDUP(C${r}/F${r},0)`);
 formula(s,`I${r}`,`=MAX(0,H${r}-1)`);
 formula(s,`J${r}`,`=I${r}*G${r}`);
 formula(s,`K${r}`,`=$C$6-J${r}`);
 formula(s,`L${r}`,`=J${r}/$C$6`);
 formula(s,`M${r}`,`=IF(K${r}>0,"Sopravvive","Non supera")`);
 formula(s,`N${r}`,`=IF(K${r}>0,"Prova tattiche","Rivedi build o percorso")`);
}
s.getRange('L12:L51').setNumberFormat('0.0%');s.getRange('D12:G51').setNumberFormat('0.0');
s.getRange('K12:K51').conditionalFormats.add('cellIs',{operator:'lessThanOrEqual',formula:0,format:{fill:'#FBE3DB',font:{color:'#9C3927'}}});
const chart=s.charts.add('line',[s.getRange('A11:A51'),s.getRange('L11:L51')]);chart.title='Pressione sul totale HP eroe';chart.setPosition('P11','U28');chart.hasLegend=false;
chart.titleTextStyle.typeface='Arial';chart.titleTextStyle.fontSize=13;chart.series.items[0].line={fill:colors.purple,style:'solid',width:2};chart.xAxis={axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:10}};chart.yAxis={numberFormatCode:'0%',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:10}};
cell(s,'A54','Limiti');cell(s,'B55','Danni critici attesi e ROUNDUP non sostituiscono una simulazione stocastica del combattimento.');
cell(s,'B56','Il livello resta fisso: il muro di difficoltà è intenzionale. Il test serve a confrontare curve e classi.');
cell(s,'B57','Per il gioco: RNG con seed, abilità e cooldown, ordine dei turni, resistenze, AI e Monte Carlo per ogni fascia.');
}

const docs={};
docs['Visione']={title:'StepQuest: decisioni di prodotto',context:'Analisi e piano iniziale al 28 ottobre 2026. Gioco progettato; persistenza SQLite realizzata in questa consegna.',widths:[29,66,68],headers:['Area','Proposta','Motivo e condizione'],rows:[
 ['Esperienza','RPG fantasy in pixel art, a turni, con spedizioni di 3–5 stanze e rientro al villaggio.','Il movimento reale prepara le scelte. La sessione desktop richiede decisioni e gestione del rischio.'],
 ['Economia','Un passo ammissibile equivale a un credito spendibile. I passi storici restano un dato separato.','Mangiare e comprare equipaggiamento spende crediti, senza diminuire i passi registrati da Garmin.'],
 ['Progressione','XP da vittorie e missioni. Materiali da esplorazione. Equipaggiamento acquistato con passi e materiali.','La disponibilità di passi facilita la preparazione. Abilità tattica e materiali controllano la potenza verticale.'],
 ['Sfida','Normale, elite e abissi opzionali con pericoli anticipati, resistenze leggibili e ritirata.','Nessuna difficoltà segreta che cresce automaticamente insieme ai passi dell’utente.'],
 ['Endless','Settori rigiocabili, combinazioni di mostri e modificatori, specializzazioni e prestigio volontario.','Servono nuove decisioni e obiettivi intermedi. La sola crescita di HP e prezzi produce grind.'],
 ['Ritorno dopo pausa','Cura e pratica gratuite al campo, saldo permanente, nessuna fame o perdita per assenza.','Un giorno con pochi passi deve ridurre gli acquisti, non impedire di giocare.'],
 ['MVP','Due classi, un bioma, sei nemici e un boss. Beta: tre classi, tre biomi, dodici archetipi e sei boss.','Prima una vertical slice con una classe. La seconda verifica la varietà tattica prima di allargare il catalogo.'],
 ['Fuori MVP','Multiplayer, PvP, gilde, mercato tra utenti, cloud cross-device, monetizzazione e generazione narrativa IA.','La base dati locale non offre un’economia competitiva affidabile. Ogni sistema aggiunge costi e superficie di abuso.'],
 ['Prima decisione','Scegliere durata media sessione e stile di combattimento prima di produrre molti sprite.','Raccomandazione: 5–10 minuti, turni leggibili, tre abilità equipaggiate e quattro scelte di percorso.'],
 ['Stato consegna','Cache passi e sincronizzazione SQLite, storico offline, migrazione schema e test.','Classi, wallet spendibile e combattimento restano progettazione. Le tabelle gioco non sono ancora abilitate.'],
]};
docs['Loop e progressione']={title:'Loop, sfida e progressione endless',context:'Regole proposte da validare con sessioni osservate, non una garanzia di coinvolgimento.',widths:[27,67,69],headers:['Sistema','Regola proposta','Trade-off e criterio di accettazione'],rows:[
 ['Ciclo del giorno','Sincronizza passi, osserva acquisti accessibili, prepara una build, scegli la spedizione, torna al campo.','Prima ricompensa leggibile in meno di due minuti. Chiudi con una scelta per la prossima camminata.'],
 ['Ciclo della spedizione','Tre-cinque stanze: incontro, bivio, risorsa, evento o boss. Prima della partenza scegli una delle tre difficoltà.','Mostra pericoli, ricompense e condizioni di ritirata. Vietare combinazioni senza contromisure disponibili.'],
 ['Combattimento a turni','Attacco base, difesa, tre abilità con cooldown, un oggetto. Mostri anticipano la prossima intenzione.','Non richiede reazione veloce. Cooldown e risorse rendono costosa la ripetizione della mossa migliore.'],
 ['Cibo','Buff per una spedizione o cura durante il run. Un cibo attivo per categoria, bonus contenuti.','Al campo si recupera gratuitamente. Il cibo accelera o abilita tattiche, non risolve la fame del personaggio.'],
 ['Sconfitta','Conserva personaggio, XP acquisita prima della spedizione ed equipaggiamento. Perdi solo parte del bottino non depositato.','Non confiscare il saldo passi. Mostrare causa e contromisura, con riprova di pratica gratuita.'],
 ['XP e competenza','XP richiede vittorie o missioni. Ricompense ridotte se l’incontro è molto sotto il grado dell’eroe.','Ripetere contenuti accessibili resta possibile. La strategia più redditizia non deve essere un combattimento banale infinito.'],
 ['Talenti','Scelte di specializzazione ogni cinque livelli. Pochi bonus numerici e nuove interazioni. Respec accessibile al campo.','Nessuna scelta iniziale irreversibile che richieda settimane di passi per essere corretta.'],
 ['Equipaggiamento','Quattro slot MVP: arma, armatura, accessorio, reliquia. Armi di classe, accessori condivisi e tag di sinergia.','Statistiche e una proprietà leggibile. Evitare dozzine di affissi e set obbligatori nella prima release.'],
 ['Gradi e settori','Ogni settore ha cinque piani e un boss. Crescono varietà, vincoli e budget nemici con statistiche normalizzate per capitolo.','Nessuna moltiplicazione senza limiti dei numeri. Il giocatore deve avvertire il vantaggio degli upgrade già ottenuti.'],
 ['Prestigio facoltativo','Dopo una soglia narrativa proponi una nuova run con modificatori e ricompense estetiche o laterali.','Consenso esplicito e anteprima di ciò che resta. Mai cancellare wallet o storico passi. Non obbligatorio per giocare.'],
 ['Continuità','Obiettivi settimanali personali e flessibili, completabili in giorni diversi. Recupero della missione senza penalità.','La serie di accessi non moltiplica la potenza. Nessun evento essenziale richiede giocare tutti i giorni.'],
 ['Frontiera di sfida','Missioni normali per apprendere, elite per testare build, abissi per chi vuole rischiare.','Target da testare: 70–85% vittorie normale e 45–65% elite per profilo e classe. Non sono risultati della simulazione.'],
 ['Desktop e movimento','Il personaggio usa passi già sincronizzati. Sul desktop si gioca da fermi dopo l’attività.','Nessun minigioco che chieda input sullo schermo mentre si cammina. Companion mobile fuori MVP.'],
]};
docs['Dati e ledger']={title:'Dati offline e futura economia transazionale',context:'Distinguere osservazioni Garmin, importazioni e crediti spendibili. Il ledger gioco è una fase successiva.',widths:[27,62,73],headers:['Dominio','Struttura o regola','Invariante e implicazione'],rows:[
 ['SQLite attuale','Database locale in userData. Scope per fingerprint SHA-256 della chiave, passi per data, stato e metadati di sincronizzazione.','Una chiave diversa non eredita la cache precedente. Il fingerprint non dimostra che due chiavi appartengano allo stesso account.'],
 ['Migrazioni','Versione schema e migrazioni transazionali. Query parametrizzate, vincoli numerici, date ISO e chiavi composte.','Mai riscrivere un DB per creare nuove tabelle. Testare upgrade da fixture vecchie e rollback su errore.'],
 ['Cache e disponibilità','NULL per misura assente, zero per misura valida uguale a zero. Distinguere giorno mai scaricato da scaricato senza dati.','Offline mostra copertura e timestamp. Una lettura locale non è un nuovo contatto con Garmin.'],
 ['Revisione osservazioni','Conservare latest steps per data e audit delle rettifiche con batch e fetched_at.','Il massimo storico non sostituisce il dato corretto. Non dedurre valuta da SUM dei passi senza riconciliazione.'],
 ['Identità gioco futura','player, provider_account, credential_binding. ID Garmin stabile verificato prima di collegare una chiave nuova.','Nessun bonus iniziale o backfill automatico al semplice cambio chiave. In caso di dubbio bloccare il mint e offrire collegamento esplicito.'],
 ['Ammissibilità','Una data di inizio profilo definisce da quando i passi sono monetizzabili. Bonus iniziale con riferimento unico.','Lo storico precedente rimane consultabile. Importare anni di passi non deve comprare subito tutta la progressione.'],
 ['Ledger futuro','wallet_entry(id, player_id, kind, amount_signed, source_date, source_revision, operation_id, created_at).','Append-only. UNIQUE(player_id, operation_id). Saldo derivato da SUM(amount_signed), mai aggiornato separatamente senza controllo.'],
 ['Mint per data','target = floor(passi corretti * tasso). delta = target - crediti netti già emessi per quella data.','Stessa revisione risincronizzata: delta zero. Incremento 1000→1500: +500. Rettifica 1500→1200: −300.'],
 ['Rettifica dopo spesa','Registra il delta negativo, non cancellare oggetti o vittorie. Spendibile = max(0, saldo ledger).','Se una rettifica produce debito, mostra la spiegazione. Nuovi crediti compensano il debito e pratica/campo restano gratuiti.'],
 ['Giorno in corso','Segna le emissioni del giorno corrente come provvisorie. Il saldo disponibile segue la stessa riconciliazione.','Mostrare che Garmin può rettificare. Alternativa conservativa: spendere solo giorni chiusi, da validare per latenza e comprensione.'],
 ['Acquisto futuro','BEGIN IMMEDIATE: verifica saldo/materiali, inserisci debito ledger, assegna item, consuma materiali, registra comando e COMMIT.','Doppio clic/retry usa stesso operation_id. Nessun item senza pagamento e nessun pagamento senza item.'],
 ['Combattimento futuro','run con seed, versione regole e stato. combat_event con ordine turni e azioni. reward_claim unico per run.','Il salvataggio dopo un turno deve riprodurre lo stesso risultato. Premi attribuiti una sola volta.'],
 ['Contenuti futuri','class, ability, item, enemy, biome, encounter_template in cataloghi versionati e deterministici.','Il save conserva IDs stabili e versione contenuti. Separare catalogo statico e istanze possedute.'],
 ['Backup e restore','Progettare export consistente del DB con backup API o VACUUM INTO. Backup prima di migrazioni gioco.','In WAL non copiare soltanto il file .sqlite aperto. Testare restore e riconciliazione prima di emettere nuovi crediti.'],
 ['Privacy locale','Permessi filesystem restrittivi, chiave Garmin cifrata separatamente. Nessun token nei log o nel DB passi.','SQLite base non cifra i passi. Cifratura del DB e backup cifrati sono un requisito successivo da valutare.'],
 ['Limite anticheat','Singleplayer offline. Il proprietario del computer può alterare file e orologio.','Hash e controlli locali rilevano errori, non garantiscono integrità competitiva. Prima di PvP o premi reali serve autorità server.'],
]};
docs['Mondo']={title:'Mondo, incontri e rigiocabilità',context:'Cataloghi iniziali e vincoli di generazione. Le quantità sono un perimetro di produzione proposto.',widths:[26,62,74],headers:['Elemento','Comportamento o contenuto','Scelta richiesta al giocatore'],rows:[
 ['Bosco delle Braci','Lupi attaccano in gruppo, goblin preparano trappole, guardaboschi corrotto carica un colpo.','Difendere prima del colpo, eliminare supporti, conservare una pulizia del veleno.'],
 ['Cripta del Sale','Scheletri resistono alle lame, cultisti proteggono un rituale, spettro alterna vulnerabilità.','Scegliere arma/tag adatto e interrompere il rituale senza inseguire solo il danno massimo.'],
 ['Forgia del Gelo','Golem accumulano armatura, salamandre lasciano zone di fuoco, sentinelle puniscono mosse ripetute.','Alternare abilità e protezioni. Rompere la guardia prima di spendere il colpo più forte.'],
 ['Dodici archetipi beta','Assaltatore, guardia, tiratore, guaritore, evocatore, imboscata, veleno, berserker, riflettore, scudo, ritualista, parassita.','Sei ruoli nel MVP, poi dodici. Riutilizzare silhouette e telegraph leggibili anche senza colore.'],
 ['Boss del bosco','Matriarca dei lupi: evoca e marca. Custode ardente: scudo e contrattacco.','Apprendere due pattern, creare finestre di vulnerabilità e scegliere quando curarsi.'],
 ['Boss della cripta','Abate vuoto: rituale a tre turni. Re ossuto: protezioni che richiedono colpi alternati.','Danno sostenuto e interruzioni hanno valore diverso. Nessuna immunità totale a una classe.'],
 ['Boss della forgia','Cuore di ferro: surriscaldamento. Drago di brina: cambio fase e colpi annunciati.','Gestire due fasi. Dare almeno una finestra affidabile di recupero.'],
 ['Affissi iniziali','Corazzato, furioso, rigenerante, volatile, rapido e silenzioso. Budget di potenza e incompatibilità per tag.','Massimo un affisso nell’MVP, due solo dopo test. Vietare rapido+one-shot o rigenerazione senza contromisura.'],
 ['Generatore di stanze','Template curati con budget per ruoli, difficoltà, sinergie, bottino e vie di uscita.','Randomizzazione vincolata, non pesca indipendente di nemici e modificatori. Validazione automatica dei seed.'],
 ['Varietà significativa','Bivi con ricompensa certa modesta o rischio dichiarato; eventi con più esiti e vantaggi per build diverse.','La scelta deve cambiare risorse, tattica o percorso. Evitare stanze che aggiungono solo testo.'],
 ['Endless sostenibile','Tre biomi combinati a settori e affissi. Ogni cinque piani boss, ogni quindici una scelta di specializzazione.','Misurare ripetizione percepita. Endless significa assenza di finale obbligato, non contenuto sempre nuovo.'],
 ['Contenuti successivi','Nuove famiglie di mostri, reliquie che cambiano regole e sfide opzionali settimanali senza ricompense esclusive.','Aggiungere prima combinazioni e interazioni, poi gradi numerici. Nessuna scarsità temporale essenziale.'],
]};

// Classi, produzione, roadmap e validazione vengono completati con l’analisi dedicata.
const game=JSON.parse(await fs.readFile(path.join(root,'docs/game-design-input.json'),'utf8'));
const review=JSON.parse(await fs.readFile(path.join(root,'docs/economy-review.json'),'utf8'));
await fs.writeFile(path.join(root,'docs/workbook/research-shape.json'),JSON.stringify({gameKeys:Object.keys(game),reviewKeys:Object.keys(review)},null,2));

docs['Classi']={title:'Classi, abilità ed equipaggiamento',context:'Sei identità di classe proposte. I valori numerici di confronto sono soltanto nel foglio Parametri.',widths:[21,39,62,48,53],headers:['Classe e fase','Risorsa e ruolo','Abilità e scelta di build','Equipaggiamento ammesso','Debolezza e contromisura'],rows:game.classes.map(c=>[
 c.class==='Ramingo'?'Ranger (beta)':`${c.class} ${['Guardiano','Arcanista'].includes(c.class)?'(MVP)':'(espansione)'}`,
 `${c.resource} ${c.strength}`,c.skills+' '+c.build_choice,c.gear,c.weakness,
])};

docs['Pixel art']={title:'Produzione pixel art e rendering',context:'Vista laterale, mappa a nodi e avamposto. Il conteggio frame non include tutto il lavoro artistico.',widths:[29,62,72],headers:['Area','Decisione proposta','Impatto sulla produzione'],rows:game.pixel_art_pipeline.map(x=>[x.topic,x.proposal,x.reason])};
// La stima di frame sarà visibile sotto l’analisi artistica.

const phases=[
 ['P0','Fondazione offline','SQLite, cache, revisioni passi e metadati sync',3,5,'Client Garmin','Completato. 24 test unitari e smoke Electron con fallback offline.'],
 ['P1','Economia e salvataggi','Profilo stabile, enrollment, ledger, rettifiche, inventario e simulatore',5,8,'P0','Replay, doppio clic, saldo negativo e restore non duplicano premi o acquisti.'],
 ['P2','Vertical slice e MVP','Prima una classe, poi due. Un bioma, sei nemici, un boss e dodici oggetti',12,18,'P1 e campione arte','Run completa offline, salvataggio per turno, due build distinguibili per classe.'],
 ['P3','Bilanciamento e ricerca','Monte Carlo, tutorial, 8–12 tester con osservazione su due settimane',8,12,'P2','Nessun blocco a zero passi, pattern compresi, niente strategia dominante osservata.'],
 ['P4','Endless e beta locale','Terza classe, tre biomi, dodici nemici, sei boss, affissi e backup UI',12,20,'P3 positivo','Quindici run senza blocchi, difficoltà leggibile, restore e migrazioni compatibili.'],
 ['P5','Espansioni','Altre tre classi, nuove reliquie, paper-doll e cooperazione da rivalutare',null,null,'Beta e decisione','Fuori stima. Ridefinire scope dopo risultati del pilot.'],
];
{
const s=setup('Piano','Piano implementativo con criteri di uscita','Stime in giornate-persona di sviluppo. Un programmatore, un artista separato. Range preliminari senza preventivo.',[10,25,61,12,12,27,65],42);
cell(s,'A6','Sviluppo restante');formula(s,'D6','=SUM(D13:D16)');formula(s,'E6','=SUM(E13:E16)');
cell(s,'A8','Con riserva 25%');formula(s,'D8','=ROUNDUP(D6*1.25,0)');formula(s,'E8','=ROUNDUP(E6*1.25,0)');
cell(s,'A10','Arte MVP: 12–20 giornate separate. La beta amplia il catalogo: stimarla dopo il primo campione.');
table(s,11,['Fase','Risultato','Lavoro','Min gg','Max gg','Dipende da','Criterio di uscita'],phases,[10,25,61,12,12,27,65],{height:62,numeric:[3,4]});
cell(s,'A21','Pianificazione');
const tasks=[
 ['PRIMA','Identità e credito storico','Legare chiavi allo stesso player tramite account verificato. Scegliere policy del giorno corrente e data di enrollment.'],
 ['PRIMA','Contratto del motore','Comandi puri, RNG con seed, regole versionate, transazione unica per risultato e reward.'],
 ['PRIMA','Campione pixel art','Una classe e un nemico con tutti i tag. Misurare ore reali e leggibilità a scala minima.'],
 ['P1','Economia senza grafica','Eseguire script di replay, rettifiche, acquisto simultaneo e restore su DB copiato.'],
 ['P2','Test di combattimento','Preparare almeno due strategie sensate per classe e tre tipologie di nemici prima dei contenuti extra.'],
 ['P3','Ricerca qualitativa','Otto-dodici partecipanti, baseline individuale e almeno due settimane. Numeri descrittivi, nessuna pretesa causale.'],
 ['P4','Pilot di quattro settimane','Misurare ritorno volontario, noia e progressione su 20–30 tester. Il calendario di osservazione si aggiunge al lavoro tecnico.'],
 ['DOPO','Distribuzione','Firma Developer ID, notarizzazione, update, backup ripristinabili e compatibilità fra versioni.'],
];
table(s,23,['Quando','Attività','Definizione di completamento'],tasks,[10,25,61],{height:57,freeze:false});
cell(s,'A35','Limiti della stima');cell(s,'B36','Riserva inclusa solo sullo sviluppo. Nessuna durata di calendario promessa e nessuna stima per P5.');
cell(s,'B37','Le dipendenze sono per fase. Arte e programmazione possono procedere in parallelo dopo il campione.');
}

{
const s=setup('Validazione','Ipotesi, rischi e fonti','Target proposti da misurare. Le fonti descrivono principi o altri prodotti, non validano automaticamente StepQuest.',[26,47,65,76],90);
const kpis=game.kpis_and_experiments;
await fs.writeFile(path.join(root,'docs/workbook/kpi-shape.json'),JSON.stringify(kpis.slice(0,2),null,2));
const metrics=[
 ['Attivazione','Prima run','Quota utenti che completano sync e prima run entro il primo avvio. Target iniziale ≥70%.','Test osservato; separare problemi Garmin, tutorial e combattimento.'],
 ['Ritorno volontario','D7 e D28','Quota coorte attivata che torna esattamente al giorno 7/28. Registrare anche ritorno nella settimana.','Definire fuso e finestra prima del pilot. Stima descrittiva su piccolo campione, non risultato atteso garantito.'],
 ['Sfida','Vittorie per fascia','70–85% normale, 45–65% elite: ipotesi per classe, livello, build e contenuto.','Misurare dopo apprendimento. Non mescolare tutorial, boss e veterani nello stesso tasso.'],
 ['Varietà','Scelte di build','Almeno due build utilizzate per classe e nessuna scelta presente in oltre il 70% dei run comparabili.','Il 70% è una soglia di indagine. Una scelta molto popolare può essere più leggibile, non necessariamente troppo forte.'],
 ['Accessibilità economica','Saldo zero','Ogni profilo completa tutorial, cura al campo e pratica anche con zero crediti spendibili.','Accettazione funzionale: zero blocchi. Distinta dalla velocità di progressione verticale.'],
 ['Economia','Giorni al primo acquisto','Misurare mediana e intervallo per profili di passi. Target iniziale 1–3 giorni per primo oggetto utile.','Il prototipo da 10.000 crediti è un upgrade, non il primo oggetto. Serve uno starter da 1.000–2.000 crediti.'],
 ['Movimento','Variazione intrautente','Confrontare medie settimanali con baseline personale di 14 giorni e copertura Garmin.','Non inferire causalità dal solo prima/dopo: meteo, lavoro e selezione possono spiegare cambiamenti.'],
 ['Motivazione','Autonomia e frustrazione','Intervista breve: scelta percepita, comprensione sconfitta, senso di obbligo, ritorno dopo un giorno fermo.','Completare numeri con osservazioni. Non usare solo minuti giocati come misura di successo.'],
 ['Persistenza','Riconciliazione ledger','Zero differenze fra replay e stato salvato su import, rettifiche, doppio clic e backup della stessa campagna.','Non dimostra resistenza a un utente che modifica o cancella volontariamente tutti i file.'],
 ['Endless','Ripetizione a 15 run','Annotare riconoscimento pattern, nuove scelte effettive e run abbandonate per noia.','Se non cambia una decisione, aggiungere numeri o colori non conta come varietà significativa.'],
];
let next=table(s,6,['Area','Misura','Target o metodo','Interpretazione'],metrics,[26,47,65,76],{height:57});
next=table(s,next,['Rischio','Gravità','Mitigazione','Verifica'],game.risks.map(r=>[r.risk,r.severity,r.mitigation,
 r.risk.includes('Garmin')?'Replay di importazioni identiche e rettifiche negative.':r.risk.includes('Scope')?'Campione di animazione e consuntivo ore.':'Playtest mirato e casi limite prima di ampliare lo scope.']),[26,47,65,76],{height:57,freeze:false});
const sources=[...game.sources,
 {id:'S08',title:'Node.js v24 SQLite',url:'https://nodejs.org/docs/latest-v24.x/api/sqlite.html',claim:'API DatabaseSync integrata. La versione effettiva va verificata nel Node incorporato in Electron.',limit:'Nessuna dipendenza nativa aggiunta. Node 22.12 nei test richiede il flag sperimentale.'},
 {id:'S09',title:'SQLite WAL e backup',url:'https://www.sqlite.org/backup.html',claim:'Online Backup API e VACUUM INTO offrono una copia consistente di un DB aperto.',limit:'Non basta copiare il solo file principale mentre WAL è attivo.'},
 {id:'S10',title:'Garmin Personal API Swagger',url:'https://developer.garmin.com/gc-developer-program/personal/swagger-docs/',claim:'Endpoint passi daily: calendarDate, totalSteps, totalDistance e stepGoal. Blocchi da massimo 28 giorni.',limit:'Non documenta un sistema valuta di gioco. La sincronizzazione non equivale al tempo reale.'},
];
table(s,next,['Fonte','Titolo','Informazione utilizzata e limite','URL diretto'],sources.map(src=>[`${src.id} · 28/10/2026`,src.title,`${src.claim} ${src.limit}`,src.url]),[26,47,65,76],{height:77,freeze:false});
}

// Risultati sintetici di verifica, con la medesima formula di budget già implementata in Economia.
// Le comparazioni salvate qui sono esempi espliciti al set iniziale, non un secondo forecast collegato al selettore.
docs['Visione'].rows.push(['Rischio economico osservato','A 1.000 passi/dì e un cibo da 900/dì: zero upgrade in 28 giorni. Senza cibo: due upgrade.','Esempi sintetici al set iniziale. Il gioco deve spiegare il risparmio e proporre uno starter economico.']);
docs['Visione'].rows.push(['Priorità di validazione','Provare per primo che una sconfitta dia informazioni utili e che due classi generino decisioni diverse.','Se non emerge una strategia da imparare, ampliare il mondo o la grafica aumenta il costo senza risolvere il loop.']);

for(const [name,doc] of Object.entries(docs)){
 if(name==='Classi') doc.rows.push(['Regola comune','Tre abilità equipaggiate, difesa e attacco base.','Ogni abilità richiede costo o cooldown e una risposta nemica leggibile.','Quattro slot. Nessuna usura obbligatoria.','Respec accessibile. Ogni classe deve poter superare ogni boss con almeno una build disponibile.']);
}

for(const [name,doc] of Object.entries(docs)){
 const s=setup(name,doc.title,doc.context,doc.widths,Math.max(70,doc.rows.length+12));
 if(name==='Visione')s.tabColor=colors.ink;
 table(s,6,doc.headers,doc.rows,doc.widths,{height:48});
}

{
const s=sheets['Pixel art'];const r=6+docs['Pixel art'].rows.length+4;
const headers=['Asset MVP','Quantità','Frame per asset','Frame unici','Nota'];
const rows=[['Classi',2,24,null,'Vista laterale. Prima una classe per la vertical slice.'],['Nemici',6,12,null,'Archetipi MVP, prima degli affissi e recolor.'],['Boss',1,24,null,'Sei boss sono un obiettivo beta, fuori da questo conteggio.']];
s.getRange(`D1:D${r+8}`).format.columnWidth=19;s.getRange(`E1:E${r+8}`).format.columnWidth=65;
table(s,r,headers,rows,[24,15,20,19,65],{height:35,freeze:false,numeric:[1,2,3]});
for(let row=r+1;row<=r+3;row++)formula(s,`D${row}`,`=B${row}*C${row}`);
cell(s,`A${r+5}`,'Totale frame base');formula(s,`D${r+5}`,`=SUM(D${r+1}:D${r+3})`);
cell(s,`A${r+7}`,'Esclusi dal totale: VFX, icone, font, sfondi, avamposto, UI, audio, revisioni e integrazione.');
}

{
const s=sheets['Dati e ledger'];const r=6+docs['Dati e ledger'].rows.length+4;
const ledger=[
 ['Import 1.000 passi','+1.000 crediti',1000,'Prima emissione per data/revisione.'],
 ['Stesso import ripetuto','0 crediti',1000,'Lo stesso evento non genera altro saldo.'],
 ['Import aggiornato 1.500','+500 crediti',1500,'Delta sul totale già emesso, non altri 1.500.'],
 ['Acquisto equipaggiamento','−1.400 crediti',100,'Addebito e inventario nella stessa transazione.'],
 ['Rettifica passi a 1.200','−300 crediti',-200,'Saldo contabile −200; spendibile 0, equipaggiamento conservato.'],
 ['Import aggiornato 1.600','+400 crediti',200,'La nuova emissione compensa il debito; nessuna duplicazione.'],
];
s.getRange(`D1:D${r+9}`).format.columnWidth=78;
table(s,r,['Evento','Delta ledger','Saldo contabile','Effetto'],ledger,[31,28,21,78],{height:42,freeze:false,numeric:[2]});
cell(s,`A${r+9}`,'Cancellare l’intero save può riavviare una campagna. Il gioco locale non garantisce anticheat o unicità globale.');
}

wb.recalculate();
const econ=sheets['Economia'];
assert.equal(econ.getRange('K6').values[0][0],16871);
assert.equal(econ.getRange('C8').values[0][0],4);
assert.equal(econ.getRange('G6').values[0][0],91529);
const cases=[{steps:1000,food:1,balance:4800,upgrades:0},{steps:8000,food:1,balance:134471,upgrades:4},{steps:0,food:1,balance:200,upgrades:0},{steps:1000,food:0,balance:6500,upgrades:2}];
const verified=[];
for(const c of cases){
 cell(sheets['Parametri'],`B${P['Passi importati al giorno']}`,c.steps);
 cell(sheets['Parametri'],`B${P['Cibi desiderati al giorno']}`,c.food);wb.recalculate();
 assert.equal(econ.getRange('K6').values[0][0],c.balance);
 assert.equal(econ.getRange('C8').values[0][0],c.upgrades);verified.push(c);
}
cell(sheets['Parametri'],`B${P['Passi importati al giorno']}`,3800);
cell(sheets['Parametri'],`B${P['Cibi desiderati al giorno']}`,1);
for(const cls of [2,3,1]){
 cell(sheets['Parametri'],`B${P['Classe nel modello']}`,cls);wb.recalculate();
 assert.equal(sheets['Parametri'].getRange(`B${P['HP base eroe']}`).values[0][0],[150,105,85][cls-1]);
}
wb.recalculate();
await fs.writeFile(path.join(root,'docs/workbook/model-verification.json'),JSON.stringify({baseline:{balance:econ.getRange('K6').values[0][0],upgrades:econ.getRange('C8').values[0][0]},testedInputs:verified,classesTested:3,firstFloor:sheets['Combattimento'].getRange('C12:M12').values[0]},null,2));
await fs.writeFile(path.join(root,'docs/workbook/inspection.ndjson'),(await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'Formula errors'})).ndjson);
for(const name of (process.argv.includes('--final') ? ['Economia','Combattimento','Pixel art','Piano','Validazione'] : names)){
 const range=name==='Economia'||name==='Combattimento'?'A1:U30':name==='Pixel art'?'A19:E28':name==='Piano'?'A21:C32':name==='Classi'?'A1:E13':name==='Validazione'?'A33:D54':`A1:${name==='Parametri'?'D':'C'}17`;
 const blob=await wb.render({sheetName:name,range,scale:1.3,format:'png'});
 await fs.writeFile(path.join(previewDir,`${name.replaceAll(' ','-')}.png`),new Uint8Array(await blob.arrayBuffer()));
}
console.log('Verifica grafica completata. Esportazione XLSX in corso.');
const exported=await SpreadsheetFile.exportXlsx(wb);
const output=path.join(outputDir,'StepQuest_Analisi_e_Piano.xlsx');
await exported.save(output);
console.log(JSON.stringify({output,sheets:names.length,tableRows:rowsMeta.reduce((sum,table)=>sum+table.end-table.start,0)},null,2));
