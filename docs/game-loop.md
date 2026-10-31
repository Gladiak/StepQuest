# Loop base e libreria degli oggetti

Il sistema di [incisioni runiche ed Echi](runic-system.md) aggiunge 12 rune, 16 parole, strategie automatiche esplicite e due gradi facoltativi per l’equipaggiamento avanzato. La documentazione collegata descrive ricette, costi, risorse e resoconti.

La versione corrente usa oggetti, equipaggiamento, mercato e combattimenti reali, persistenti in SQLite. I vecchi oggetti dimostrativi dell’interfaccia non vengono assegnati agli eroi.

## Partenza

Ogni nuovo personaggio riceve esattamente due oggetti comuni: l’arma semplice della propria classe e i Vestiti logori. L’arma ha solo attacco base; i vestiti hanno solo difesa base 1. Non ci sono affissi, bonus, malus, proprietà di set o abilità aggiuntive. Stivali, entrambi gli anelli e amuleto sono vuoti. Il portafoglio parte da zero.

Gli eroi già salvati ricevono il corredo una sola volta al primo caricamento del gioco. Identità, tempo, portafoglio e storico Garmin vengono mantenuti. Creare un nuovo eroe e assegnargli il corredo avviene nella stessa transazione.

## Rarità

| Rarità | Colore | Caratteristiche aggiuntive | Ampiezza dei roll |
| --- | --- | --- | --- |
| Comune | Grigio | 0 | Nessun affisso |
| Non comune | Azzurro | 1–2 | ×1 |
| Raro | Giallo scuro | 1–3 | ×1,6 |
| Mitico | Arancione | 2–4 | ×2,3 |
| Leggendario | Viola | 3–6 | ×3,2 |
| Unico (set endgame) | Verde | 4–6, solo bonus | ×4,2 |

Il conteggio include bonus e malus; il primo roll è sempre positivo. Ogni successivo affisso può estrarre il malus definito nel database (probabilità iniziale 23%). Gli attributi non si duplicano sullo stesso oggetto. Prefisso e suffisso nel nome provengono dai primi affissi positivi dei due tipi; le ulteriori proprietà rimangono elencate nel dettaglio. Gli stessi sprite sono riutilizzati fra rarità.

I valori vengono estratti entro gli intervalli di `affix_ranges`, ampliati con rarità e livello dell’oggetto: moltiplicatore `rarity.roll_scale × (1 + log2(item_level)/3)`, con estremi interi arrotondati. Anche un malus leggendario può essere più ampio di uno non comune. Valore, segno, range, rarità e affisso sorgente vengono salvati nel JSON immutabile dell’istanza; riaprire un tooltip o riavviare il gioco non ripete l’estrazione.

Il mitico usa arancione saturo (#ff8a1f sui pannelli scuri, #6b2300 sulla pergamena), distinto dall’oro dei rari. La migrazione v5 aggiorna i colori anche nei salvataggi già esistenti, senza rigenerare oggetti. Nome, bordo e caratteristiche usano la legenda della rarità; bonus/malus sono indicati anche dal segno e dalla parola, senza affidarsi al solo colore. La palette ha varianti per pergamena e pannelli scuri.

## Contenuti

La libreria contiene **405 modelli**, **24 definizioni di attributo**, **144 prefissi/suffissi** e **30 set**. I modelli comprendono 132 armi, 103 vesti/armature, 46 stivali, 46 anelli e 46 amuleti, 24 pozioni e 8 razioni, compresi corredi iniziali e pezzi di set.

L’incrocio dei 366 modelli di equipaggiamento non iniziali con coppie compatibili di prefisso e suffisso comprende 1.818.288 combinazioni strutturali, prima di contare rarità, livello, roll numerici e ulteriori caratteristiche. Non è il numero di nomi testuali distinti: alcuni affissi condividono la formulazione fra bonus fissi e percentuali.

Il catalogo completo leggibile è in [loot-library.json](loot-library.json). Il gioco carica le definizioni dalle tabelle SQLite; il JSON è un’esportazione dei dati iniziali per consultazione. Modifiche manuali alle definizioni SQLite vengono lette al riavvio e non alterano le istanze già generate.

I consumabili sono comuni e senza affissi equipaggiabili. Hanno il proprio effetto d’uso: cura, protezione temporanea, antidoto o cibo fuori combattimento. Le quantità di cura crescono col livello dell’oggetto; la protezione dura tre turni. Un utilizzo elimina una sola istanza, dopo la verifica dei requisiti. La vita piena non consuma cibo o cure.

## Attributi e set

Le 18 statistiche comprendono attacco, difesa, vita, danno arcano, critico, danno critico, schivata, parata, furto vitale, rigenerazione, riduzione danni, monete, esperienza, probabilità bottino, potenza pozioni, colpo rapido, precisione e danno riflesso. Le 24 definizioni distinguono incrementi fissi e percentuali quando applicabili.

Le quantità fisse vengono sommate alla base, poi si applicano i modificatori percentuali moltiplicativi. Probabilità e bonus percentuali intrinseci si sommano in punti percentuali. La base di classe aggiunge la vita iniziale e l’attacco/vita per livello. Vita e attacco hanno minimo 1; precisione minimo 30%; schivata massimo 35%, parata 50%, critico 60%, riduzione danni 60%, furto vitale 15%, colpo rapido 30%. I limiti impediscono statistiche negative e immunità permanenti. Una pozione protettiva può portare la riduzione temporanea fino all’80%.

Ogni classe ha cinque collezioni: tre ai livelli 5, 12 e 20 e due set unici endgame ai livelli/profondità 30/60 e 45/100. Ogni set comprende arma, corpo, stivali, anello e amuleto e può essere generato solo raro o superiore. I bonus si attivano a 2, 3 e 4 pezzi dello stesso set equipaggiati dalla classe corretta. Possederli nello zaino non basta. Togliere o sostituire un pezzo ricalcola subito gli attributi, senza accumulare più volte i bonus. I set endgame aggiungono la soglia a cinque pezzi. Le soglie attive sono visibili in “Attributi e set” e nel dettaglio dei pezzi.

## Ciclo giocabile

1. A casa: importa i passi di oggi da Garmin con un unico comando; gli import successivi aggiungono solo l’incremento giornaliero. Recupera con cibo o riposo e scegli l’equipaggiamento.
2. Al mercato: cambia 50 passi in 20 monete, acquista e vendi oggetti. Gli acquisti assegnano esattamente l’istanza esaminata.
3. Fuori dalle mura: scegli sentiero sicuro, avanzamento o élite. Iniziare costa 25 passi una sola volta. Attacca, difendi, usa una pozione o ritirati. L’intento indica quando il nemico caricherà; i tratti delle spedizioni possono cambiare il ritmo.
4. Alla vittoria: esperienza, monete e possibile bottino; il nuovo livello recupera la vita. Gli scontri normali e le élite aumentano la profondità; il sentiero sicuro consente di allenarsi senza avanzare. Nessun finale predefinito. Alla sconfitta torni al rifugio con 1 vita, senza perdita di equipaggiamento. La ritirata non assegna ricompense e non restituisce il costo iniziale.

Ogni eroe conserva il massimo già accreditato per sorgente Garmin e data. Gli eroi non condividono contatori o saldi: gli stessi 5.000 passi di una giornata sono disponibili a ciascuno. Rileggere i dati o spendere passi non ripristina il saldo dello stesso eroe; una revisione Garmin positiva assegna solo il suo incremento. Una revisione in diminuzione non sottrae valuta già assegnata. Eliminare un eroe elimina il suo saldo e i suoi contatori; una nuova storia importa indipendentemente.

Gli archivi originali conservano la fingerprint della chiave API. Prima della v1.2.0 una chiave diversa era sempre una sorgente diversa; la base Garmin v1.2.0, descritta in fondo, riconcilia ora soltanto identità verificate e conserva i massimi già accreditati.

## Mercante e bottino

Il mercante genera 12 offerte per eroe. Cambiare schermata, comprare tutte le scorte o riavviare l’app non le rigenera. Il rinnovo costa `10 + 3 × livello` monete, elimina soltanto le offerte rimaste e conserva gli oggetti già acquistati.

Le sezioni sono ordinate Armi, Armature, Accessori, Pozioni e Cibo. Dal prossimo rinnovo le scorte contengono rispettivamente 3/3/2/3/1 offerte. Anelli e amuleti sono Accessori; le razioni sono Cibo. La migrazione v10 riclassifica i modelli anche per gli oggetti già esistenti, senza rigenerare scorte o modificare prezzi. Sei carovane ai livelli 1/4/15/45/150/500 migliorano rarità e numero di affissi. Le occasioni hanno il massimo numero di bonus positivi e una cadenza visibile: dal livello 150 c’è un’occasione leggendaria a ogni rinnovo. Gli accessori privilegiano monete/XP oppure bottino/potenza pozioni. Per pesi, prezzi, compatibilità e verifiche consultare [le regole del mercante](merchant-review.md).

Il generatore sceglie basi compatibili con classe e livello, rarità pesata, affissi compatibili e valori entro i range. Il mercante usa i pesi della carovana attuale, definiti in `merchant-catalog.cjs`, ed esclude gli Unici. I nuovi drop dei mostri usano 2500/4000/2800/600/100 per comune/non comune/raro/mitico/leggendario; le élite usano 0/1500/6000/2200/300, quindi garantiscono equipaggiamento almeno non comune. Per il bottino, rari, mitici e leggendari si sbloccano ai livelli 4/8/15: i pesi si rinormalizzano sulle rarità disponibili, quindi non sono probabilità assolute a ogni livello. I consumabili restano comuni.

La sacca contiene fino a 20 razioni prepagate, separate dall’inventario. Il rifornimento automatico parte disattivato e può essere configurato al Rifugio con una soglia del 50%, 70% o 90% della vita. Dopo una vittoria usa al massimo tre razioni già acquistate e mostra consumo, cura effettiva e scorte rimaste. Arena, sconfitte, ritirate e custodi conclusivi delle spedizioni non consumano la sacca. Il cibo si può usare anche manualmente fuori dallo scontro; le pozioni durante il turno rimangono manuali.

La probabilità di ottenere un oggetto dopo una vittoria è 65% nel sentiero sicuro, 85% negli scontri normali e due oggetti garantiti nelle élite e nei custodi. Il bonus bottino moltiplica le probabilità non garantite fino al 95%. Prima di partire si vedono costo, profondità del nemico e probabilità effettiva sulla build corrente. Lo scontro sicuro usa profondità `max(1,min(profondità−1,livello eroe))`, forza ×0,75 e non fa avanzare: permette di recuperare equipaggiamento ed esperienza quando l’avanzamento è troppo difficile. Le élite sono esplicite e hanno forza ×1,18; non compaiono automaticamente ogni cinque profondità. L’attacco base dei nuovi nemici cresce come `6 + 2,5 × profondità`, anziché `6 + 3 × profondità`. Gli incontri già iniziati mantengono i valori nemico salvati.
Quando viene estratto equipaggiamento raro o superiore e sono disponibili set, la probabilità iniziale di scegliere una base di set è 10%, o 24% per un’élite. Fra le basi idonee, gli oggetti vengono scelti casualmente. Non ci sono premi ripetuti per lo stesso combattimento: la chiusura dello scontro e l’assegnazione di XP, monete e oggetto condividono una transazione.

Le regole economiche iniziali sono in `game_rules`, i pesi e conteggi in `item_rarities`, i range in `attribute_definitions`/`affix_ranges`. Sono parametri da bilanciare giocando; questa versione non pretende un equilibrio definitivo della progressione.

## Persistenza e verifiche

Le nuove tabelle si aggiungono a `stepquest.sqlite` senza cambiare lo schema dell’archivio Garmin. `game_migrations` è indipendente da `PRAGMA user_version`. La versione 2 aggiorna anche la prima versione dello schema già presente, aggiungendo parametri, definizioni delle statistiche e colori dei bonus di set senza rigenerare gli oggetti. Oggetti, affissi, scorte, saldo, XP, HP, set e combattimenti non dipendono dal renderer. I comandi IPC operano sull’eroe selezionato nel processo principale, con controllo di proprietà, classe, livello, saldo e turno atteso.

I test coprono mille estrazioni attraverso le cinque rarità, sei classi, persistenza dopo riapertura, set condizionali, livelli, limiti, rollback, acquisti duplicati, riscatto fra eroi, cancellazione, fuga, sconfitta e ricompense uniche. Il test Electron completa il ciclo e controlla contrasto e dialoghi delle cinque rarità usando soltanto un database temporaneo e passi di prova. Non contatta Garmin né aggiunge oggetti di prova ai salvataggi reali.

## Confronto con l’equipaggiamento

Ogni oggetto equipaggiabile, nello zaino o nel mercato, include un confronto calcolato dal processo principale. Viene simulata la sostituzione dello slot sulla build corrente: statistiche base, percentuali, malus, limiti e soglie dei set vengono ricalcolati senza cambiare il salvataggio. Il dettaglio mostra gli attributi effettivi prima/dopo e le differenze. Per le probabilità, la differenza è espressa in punti percentuali.

Il consiglio usa prove deterministiche eseguite in un worker separato, con lo stesso turno di combattimento del gioco. Ogni configurazione parte a vita piena e livello fisso; affronta tre scontri consecutivi per ciascuno dei tre scenari di riferimento: normali, élite e custodi del Passo delle ceneri. Non si simulano salite di livello, ricompense casuali, pozioni durante il turno o scelte narrative. Se attivo, il piano delle provviste usa le scorte disponibili dopo le vittorie normali/élite, con la stessa funzione di consumo del gioco; i custodi non consumano razioni. Gli effetti giornalieri disponibili e i bonus dell’equipaggiamento vengono applicati; gli stessi semi casuali sono usati prima e dopo la sostituzione.

Il confronto dà priorità agli scontri superati. In seguito considera gli XP per 100 passi includendo il costo equivalente del recupero completo: ogni punto vita mancante costa una moneta, convertita in passi al cambio corrente; viene incluso anche il prezzo originario delle sole razioni consumate. Questo costo conta anche quando le monete delle vittorie potrebbero pagarlo. A risultati vicini, i turni necessari per vincere e le monete rimaste dopo recupero e razioni aiutano a scegliere. I turni vengono confrontati solo quando entrambe le configurazioni completano tutte le prove; perdere prima non diventa un vantaggio di velocità. Il bonus bottino rimane visibile nei delta senza influenzare le prove; la potenza pozioni influisce sulle cure delle provviste se il piano è attivo. Le frecce compatte accanto ai prezzi del mercato mostrano miglioramenti, peggioramenti e risultati equivalenti senza aprire i dettagli.

Si parte da 32 semi per scenario; risultati materialmente diversi ma incerti vengono approfonditi fino a 128. Differenze entro la soglia pratica del criterio o entro il margine di campionamento producono «Differenza minima», non una raccomandazione positiva. Il margine statistico è indicativo e non garantisce l’esito del prossimo scontro.

Le indicazioni principali sono «Equipaggiamento consigliato», «Mantieni quello attuale» e «Differenza minima». Prove che non terminano con una vittoria o che restano statisticamente incerte mostrano «Confronto non conclusivo». Il titolo non mostra più una percentuale globale di potenza. Le frecce verdi compaiono solo dopo una raccomandazione positiva: una per un vantaggio contenuto, due da una variazione del 5% nel criterio decisivo e tre dal 15%. Durante il calcolo compare un indicatore neutro. Oggetti già indossati, consumabili e pezzi non utilizzabili non ricevono frecce.

Gli anelli hanno due prove distinte, una per ciascuno slot. La scelta manuale dello slot rimane selezionata mentre arrivano i risultati. I consigli si riferiscono ai parametri di riferimento mostrati, non sono una promessa di superiorità per ogni nemico o strategia.

Il calcolo dà priorità agli oggetti visibili e selezionati; gli altri vengono elaborati a piccoli gruppi durante l’inattività. Cache limitate conservano i risultati. Cambi di livello, profondità, statistiche, effetti o proprietà dell’oggetto invalidano i confronti pertinenti; modifiche alle sole monete o ai passi non li invalidano. Risposte obsolete vengono scartate. Le simulazioni non scrivono nel salvataggio e non consumano risorse.

La vendita prudente conserva qualsiasi pezzo con almeno un vantaggio alternativo negli attributi effettivi; un anello viene considerato inferiore solo se non offre vantaggi in nessuno dei due slot. Questa selezione non dipende da un risultato di simulazione ancora in attesa.

## Cambio con slider

“Converti passi in monete” apre un cursore da un lotto al massimo convertibile, con passo pari al lotto configurato in `game_rules`. Il cursore aggiorna l’anteprima di monete ottenute e saldo restante senza scrivere nel database. “Minimo” e “Massimo” selezionano rapidamente gli estremi. La conferma converte l’intero importo in una transazione, con validazione di multipli, valori interi e saldo. Rimangono invariati il rapporto configurato e gli eventuali passi inferiori a un lotto.

## Combattimento con un comando

“Risolvi automaticamente” è selezionato inizialmente. “Combatti” avvia e risolve lo scontro con attacchi normali, addebitando il costo iniziale una sola volta. XP, monete e bottino sono assegnati soltanto se il nemico viene sconfitto; non vengono consumate pozioni automaticamente. Togliendo la selezione si mantiene il combattimento manuale. “Auto” nella barra delle azioni completa anche uno scontro manuale già avviato, senza nuovo costo.

La risoluzione usa lo stesso motore dei turni manuali e una transazione unica. L’avvio automatico ha un identificativo di richiesta idempotente, per evitare doppi addebiti e ricompense al retry. Un comando risolve al massimo 250 turni: se lo scontro non è finito, resta aperto con lo stato effettivo, senza inventare una vittoria. Può essere continuato o abbandonato normalmente.

I tre mostri hanno sprite originali trasparenti in pixel art. Asset e prompt: [renderer/assets/monsters/README.md](../renderer/assets/monsters/README.md).


## Gioielli e migrazione v3

L’equipaggiamento ha sei posizioni: arma, corpo, piedi, anello I, anello II e amuleto. Gli anelli possono occupare indifferentemente i due slot; un’istanza può essere indossata una sola volta. Gli amuleti hanno una posizione dedicata. Ogni set dispone anche di un modello di anello; le soglie rimangono 2/3/4 pezzi diversi. Due copie dello stesso modello applicano entrambe le proprie statistiche, ma contano come un solo pezzo per il bonus del set.

Il processo principale simula ogni posizione compatibile e restituisce un confronto per ciascuna. Per un anello suggerisce prima uno slot libero; se entrambi sono occupati, sceglie il maggiore guadagno stimato. Nel dettaglio è possibile alternare il confronto Anello I/II e scegliere esplicitamente quale sostituire. Vendere un oggetto ancora indossato è vietato per tutti gli slot. Equipaggiamento, appartenenza, requisiti e modifica durante uno scontro sono sempre validati dal motore.

La migrazione `game_migrations=3` sostituisce il vecchio vincolo degli slot in una transazione. L’accessorio già indossato viene spostato in Anello I oppure Amuleto secondo lo sprite del modello. Le istanze, i roll, i saldi, gli scontri e i premi rimangono identici. Vengono aggiornati i tipi del catalogo e le compatibilità degli affissi, e aggiunti 18 modelli di anello di set; nessun oggetto viene assegnato ai personaggi esistenti.

## Barra delle azioni compatta

La barra inferiore è alta 64 pixel e larga quanto i comandi presenti, senza divisori o spazi tra i gruppi. I pulsanti mostrano solo icone pixel art native su griglia 32×32, con bordi fantasy e pulsanti da 44 pixel. Vita ed esperienza restano nel riquadro superiore. Le descrizioni compaiono all’hover e al focus da tastiera; Escape le chiude. Ogni comando conserva il nome accessibile con `aria-label`. 

La notifica corrente è in una riga separata; il libro apre taccuino e legenda delle rarità. Il popup «Attributi e set» si apre dall’icona accanto al titolo Equipaggiamento. I test Electron controllano tutti e sei gli slot, selezione e sostituzione dei due anelli, amuleto simultaneo, tooltip delle azioni e geometria della barra, oltre ai controlli già presenti.


## Flussi senza cambi di scena

Le icone della barra sono definite in `renderer/action-icons.js`: 32×32 pixel logici, palette con ombre, mezzitoni e riflessi, entro l’altezza di 64 pixel della barra.

Riposo e conversione sono accessibili dalla barra in tutte le ambientazioni. La barra inferiore non contiene un pulsante Zaino: inventario, confronto e gestione dei pezzi posseduti si trovano nella griglia di Casa. Durante il combattimento le pozioni restano accessibili dall’azione dedicata; il cambio di equipaggiamento resta bloccato. Riposo e cambio monete restano espliciti e non sono disponibili durante uno scontro.

Nel dettaglio del mercante «Compra e indossa» effettua entrambe le azioni in una transazione SQLite. I controlli di classe, livello, slot e saldo avvengono nel motore: se l’equipaggiamento fallisce non si addebitano monete e l’articolo rimane al mercante. Gli anelli hanno un comando per ciascuno slot. Il solo acquisto rimane disponibile. Se mancano monete, «Converti passi» apre lo slider e, dopo la conferma, riporta allo stesso articolo con il saldo aggiornato.

Fuori dallo scontro si parte o si combatte ancora dal pannello della sfida; la barra mantiene gli strumenti comuni, senza duplicare l’avvio. In battaglia vengono mostrate le cinque azioni del combattimento. Il riposo può essere eseguito sul posto, senza passare dalla scena di Casa; a vita piena il comando è disabilitato e il tooltip ne spiega il motivo. Nessun recupero o scontro è avviato automaticamente.

Durante un’operazione i comandi vengono bloccati senza ricostruire la scena in attesa della risposta. Dopo la risposta vengono aggiornati stato e interfaccia. I popup supportano ritorno allo zaino anche con Escape e ripristino del focus quando il controllo d’origine è ancora disponibile. Categoria del mercato, difficoltà e pagine sono conservate nella sessione dell’eroe.

## Spedizioni: prima versione del loop a scelte

La modalità predefinita dei sentieri è Scontro singolo. Le spedizioni di quattro tappe sono nella scheda accanto; un viaggio già in corso si riapre nella propria scheda. Non richiede mappe, movimento o animazioni.

| Itinerario | Ingresso | Forza nemici | Sacca e bonus |
| --- | ---: | ---: | ---: |
| Bosco dei sussurri | 50 passi | ×0,8 | ×1 |
| Rovine della veglia | 75 passi | ×1 | ×1,45 |
| Passo delle ceneri | 100 passi | ×1,2 | ×1,9 |

L’ingresso copre tutte le tappe: i combattimenti della spedizione non addebitano altri passi. Il viaggio usa la profondità alla partenza; il custode è un livello sopra. Il costo non viene rimborsato se si rientra presto. Il giocatore vede costo, rischi e conseguenze prima di scegliere.

1. **Bivio:** combattere una pattuglia per i premi dello scontro e monete nella sacca, oppure cercare un deposito con probabilità esplicita di successo/trappola.
2. **Campo o fonte:** recuperare il 35% della vita massima, oppure ottenere +18% attacco e +2 difesa per il resto del viaggio. Una scelta esclude l’altra.
3. **Evento variabile:** viandante ferito, forziere con trappola, carovana o altare. Le alternative scambiano vita, recupero, monete e bonus temporanei. L’evento viene scelto alla partenza e salvato, quindi riaprire il gioco non lo cambia.
4. **Custode:** vincere lo scontro finale per completare il viaggio, oppure rinunciare al premio finale e rientrare con la sacca.

Il campo è consumato dalla scelta, quindi non si può recuperare ripetutamente nello stesso luogo. Il riposo completo è vietato dal motore finché esiste una spedizione attiva, anche passando dalla scena di Casa. Cibo e pozioni conservano i loro effetti e costi. Equipaggiamento e acquisti restano disponibili fra gli scontri. Salire di livello conserva il recupero previsto dal motore esistente.

Le monete della **sacca** sono distinte dal portafoglio. Il rientro volontario le incassa tutte; la sconfitta ne conserva metà, arrotondata per difetto. Oggetti, XP e premi normali degli scontri già vinti non vengono sottratti. Completando si incassano sacca, monete bonus e un oggetto almeno non comune, adatto a classe e livello. Rarità più alte rispettano le soglie di livello 4/8/15. La ricompensa extra non garantisce un miglioramento dell’equipaggiamento attuale.

Il completamento recupera tutta la vita. Il rientro volontario o la fuga conservano la vita rimasta: non permettono di aggirare il costo del riposo. Tutte le conclusioni eliminano i bonus temporanei. La sconfitta lascia 1 punto vita. La cura completa è un premio per la conclusione del viaggio, evitando il comando «Riposa» dopo ogni nemico. I boss e le pattuglie possono essere famelici (carica ogni 2 turni), corazzati (più difesa e vita, carica ogni 4) o velenosi. L’intento del prossimo turno segue il ritmo effettivo del nemico.

### Persistenza e verifiche

`game_migrations=4` aggiunge `expeditions`, con piano, tappa, revisione attesa, sacca, bonus, log e scontro collegato. C’è una sola spedizione attiva per personaggio. La partenza ha un UUID idempotente; le scelte richiedono ID e revisione correnti. Il motore valida l’opzione dal piano persistito, senza accettare premi o danni dal renderer. Avanzamento e conclusione sono nella stessa transazione del turno o della scelta; i premi hanno un riferimento univoco. Il viaggio e gli scontri si riprendono dopo la chiusura dell’app.

I test coprono migrazione da v3, riapertura, scelta ripetuta, ritiro e premio ripetuto, sconfitta/fuga, rollback, isolamento tra eroi, cancellazione, combattimento manuale e automatico. Il test Electron verifica bivio, campo, evento, custode, premio e ripresa da Casa, oltre a ingombri e contrasto. `scripts/expedition-balance.cjs` simula eroi appena creati delle sei classi sui tre itinerari, con corredo iniziale e strategia dichiarata, producendo `artifacts/expedition-balance.json`.

### Cosa valutare giocando

Questa versione introduce scelte a breve termine e una risorsa da gestire lungo il viaggio. Le leve da osservare sono frequenza dei rientri anticipati, uso effettivo del cibo, differenze fra itinerari e scelta fra campo e benedizione. Una percentuale di vittoria misurata su eroi nuovi non descrive il bilanciamento delle build avanzate. Eventi legati alle classi, obiettivi a più spedizioni e collezioni narrative possono ampliare il sistema in seguito, dopo aver verificato che le scelte attuali vengano usate davvero.

## Importazione passi nel gioco

La barra espone un unico comando «Importa i nuovi passi di oggi da Garmin». Un clic sincronizza e accredita i passi senza scelta delle date o riscatto separato. La giornata viene determinata nel processo principale usando la data locale a ogni richiesta; al cambio di giorno parte un nuovo conteggio. Lo storico dei giorni precedenti non viene accreditato dal comando.

Il motore conserva per eroe, account e giorno il massimo totale Garmin già accreditato: al primo import del personaggio aggiunge il totale di oggi; ai successivi solo la differenza positiva. Spendere passi o riaprire il gioco non azzera il suo contatore. Cambiare eroe usa il contatore dell’altro personaggio. Una correzione Garmin al ribasso non rende riscattabili passi già assegnati. La notifica mostra il totale giornaliero e l’incremento aggiunto, oppure l’assenza di nuovi passi.

Se Garmin è offline si usano solo i dati di oggi già salvati, con un avviso esplicito. Se l’eroe cambia durante il download, lo storico viene conservato senza assegnare valuta: basta ripetere l’importazione con l’eroe desiderato. Saldo e registro degli accrediti vengono aggiornati nella stessa transazione. I passi di debug sono registrati a parte nel portafoglio e non modificano lo storico o il contatore Garmin.

## Zaino e vendita dei pezzi inferiori

«Vendi oggetti inferiori» ha un solo punto d’accesso nello zaino. Mostra anteprima di nomi, prezzi e ricavo totale prima della conferma. Il motore include solo oggetti utilizzabili ora, non indossati, con potenza inferiore di almeno 0,5% in ogni slot compatibile e senza alcun attributo migliorato. Se un anello migliora l’altro slot, viene conservato. Rimangono protetti cibo, pozioni, pezzi di set, oggetti di livello futuro e oggetti che offrono vantaggi alternativi, anche economici.

L’anteprima ha un token legato a candidati ed equipaggiamento: se cambiano, la vendita viene rifiutata e richiede una nuova anteprima. Vendita e ricavo sono transazionali; il retry della stessa richiesta non accredita due volte le monete. La vendita singola resta disponibile nei dettagli.

## Recupero e provviste

Il riposo completo costa una moneta per punto vita mancante; il pulsante mostra costo ed effetto prima del clic. Il cibo costa circa 0,55 monete per punto vita curato, arrotondato: una razione base cura 25 HP e costa 14 monete. È quindi più conveniente per recuperare vita, ma occupa lo zaino e si consuma; le pozioni restano utilizzabili anche durante il combattimento. Gli oggetti già comprati mantengono il proprio prezzo salvato.

Se non si può pagare il riposo completo e la vita è sotto il 35% del massimo, lo stesso pulsante offre il recupero d’emergenza gratuito fino al 35%. Non assegna monete né cura oltre quella soglia. A vita piena il comando è disabilitato; durante scontri o spedizioni il riposo resta vietato. In viaggio servono campo, cibo e pozioni, oppure si può rientrare con la sacca e curarsi al rifugio.

## Verifica del bilanciamento

`node --experimental-sqlite scripts/combat-balance.cjs` produce [combat-balance.json](../artifacts/combat-balance.json), con campioni per classe/livello/modalità e distribuzione dei drop. La simulazione delle spedizioni resta in `scripts/expedition-balance.cjs`. I report dichiarano equipaggiamento, strategia e numero di campioni; descrivono le condizioni simulate e non una probabilità di vittoria garantita per tutte le build.

## Tariffe passi e migrazione v6

Il costo di uno scontro è 25 passi; l’ingresso alle spedizioni Bosco/Rovine/Passo è 50/75/100 passi, senza spese aggiuntive nelle tappe. Il lotto minimo di conversione è 50 passi per 20 monete, quindi anche budget piccoli permettono di acquistare cure e provviste. Con 1.000 passi si possono scegliere 40 scontri, 20 ingressi al Bosco, oppure 400 monete; queste sono alternative sullo stesso budget.

La migrazione v6 aggiorna `encounter_steps`, `exchange_steps` e `exchange_coins` per i database già presenti. Le tariffe delle spedizioni sono nel catalogo condiviso tra vista e motore. Saldi e registri delle operazioni passate restano invariati: nessun rimborso o secondo costo per le attività già iniziate. Le nuove tariffe si applicano alle prossime partenze e conversioni. Nessun cambiamento a difficoltà o probabilità di bottino.

## Rinnovo mercato e migrazione v7

Il rinnovo delle dodici offerte costa `10 + 3 × livello` monete: 13 al livello 1, 25 al livello 5 e 55 al livello 15. Prima costava `30 + 10 × livello`. La migrazione v7 aggiorna soltanto i due parametri del rinnovo: mantiene le scorte presenti, gli oggetti comprati, i saldi e gli addebiti passati. Il prezzo viene mostrato prima della conferma e l’addebito resta transazionale.

## Condizione giornaliera Garmin

Il comando Importa aggiorna anche intensità di oggi, sonno confermato della notte attribuita da Garmin a oggi e stress del giorno precedente. Il taccuino mostra dati, ultimo aggiornamento, regole ed effetti effettivi. Il sonno assente o non confermato e lo stress con meno di sei ore misurate sono neutri. Gli errori delle metriche non impediscono l’accredito dei passi.

Vigore: ogni 15 minuti ponderati (moderati + 2×vigorosi) assegna +5% XP, fino al 15%. Punteggio sonno ≥80: +10% alle cure alimentari e pozioni curative; sotto 50: −3%. Stress medio precedente ≥60: −2% attacco fisico. Sono soglie di gioco, non valutazioni cliniche. Non si sottraggono passi, monete o vita massima. Cibo e riposo effettivo eliminano entrambi i malus per quell’eroe fino a fine giornata.

Cache SQLite separata `daily_wellness`, per scope della connessione e giorno, con timestamp e protezione da snapshot precedenti; `wellness_migrations=1` gestisce le nuove tabelle senza modificare archivio passi o oggetti. Nessun effetto di giorni vecchi, dati oltre 24 ore o connessioni diverse. Nessuna ricompensa all’importazione: i modificatori vengono ricalcolati e non sommati. Ogni nuovo scontro salva una fotografia in `buffs.dailyEffects`, usata per danno, cure e XP anche dopo riavvio, reimport o mezzanotte. Gli scontri esistenti senza fotografia rimangono neutri.

## Set unici endgame e scalatura alla profondità

I due set nuovi per ogni classe sono Unici verdi, esclusivi della classe indicata nella descrizione: 12 collezioni e 60 pezzi nuovi portano il totale a 30 set (5 per classe). Ogni collezione ha arma, corpo, stivali, anello e amuleto. Il primo richiede livello 30/profondità 60, il secondo livello 45/profondità 100. Non si trovano nel mercato né nell’allenamento o nei nemici normali.

Ogni vittoria contro un’élite o un custode, quando livello dell’eroe e profondità effettiva dello scontro sono idonei, ha 0,1% di probabilità complessiva di generare un pezzo unico della propria classe. Se entrambi i set sono sbloccati, quella stessa probabilità viene divisa fra le due collezioni e poi fra i cinque pezzi. Il bonus bottino non aumenta questa probabilità. Il premio finale garantito della spedizione non garantisce un Unico: la possibilità rara viene dal custode. I pezzi unici hanno 4–6 affissi positivi, senza malus.

Le soglie si sommano: 2 pezzi danno +35%/+45% attacco; 3 pezzi +60%/+75% vita e +50%/+60% difesa; 4 pezzi il grande bonus specifico di classe; 5 pezzi aggiungono +60%/+75% attacco, +15%/+20% riduzione danni e +25% XP. Una collezione completa arriva dunque a +95%/+120% attacco oltre ai suoi affissi. Guardiano: parata; Arcanista: danno arcano; Ranger: critico; Predone: colpo rapido; Druido: rigenerazione; Berserker: furto vitale. I normali limiti delle statistiche rimangono validi. Due copie dello stesso anello non attivano due soglie.

I nuovi equipaggiamenti da mostri, mercato e premio di spedizione usano il moltiplicatore `1 + min(2, max(0, profondità − livello oggetto) / 100)`: da ×1 fino a ×3. Scala statistiche base e intervalli degli affissi, mantenendo il requisito di livello originale. Per i mostri si usa la profondità reale dello scontro, per il mercato quella attuale dell’eroe, per il premio quella iniziale del viaggio. Corredo iniziale e consumabili sono esclusi. Profondità e moltiplicatore vengono salvati e mostrati nel dettaglio: nessuna rivalutazione automatica dopo avanzamento o riavvio.

La migrazione v8 aggiunge catalogo e rarità, oltre a `generation_depth` e `depth_multiplier`. Le istanze precedenti restano identiche con moltiplicatore ×1; saldi, equipaggiamento e battaglie si conservano. La vendita in blocco continua a proteggere tutti i pezzi di set.

## Crescita recuperabile e protezione dalla sfortuna (v9)

La profondità continua a identificare percorso, ricompense e accesso agli Unici; per vita, attacco e difesa del nemico si usa `min(profondità,livello eroe) + max(0,profondità−livello eroe) × 0,65`. La forza cresce sempre, ma il divario accumulato non si trasferisce integralmente ai danni nemici. Il calcolo dipende da livello e profondità, mai dall’equipaggiamento: trovare un buon pezzo migliora davvero le possibilità, senza rinforzare l’avversario. XP e monete restano legati alla profondità nominale.

Una vittoria normale o élite fa avanzare una sola profondità. Nelle spedizioni la pattuglia non incrementa la profondità; completare il custode avanza di uno. Il sentiero sicuro resta allenamento senza avanzamento. Gli scontri già iniziati conservano parametri e regole di progressione salvati.

Le nuove élite hanno fattore 1,18 e cariche ×1,50 invece di ×1,65. Danno due oggetti; dal livello 4 entrambi sono almeno rari. Il primo affisso positivo dei nuovi drop equipaggiabili dei mostri viene scelto fra bonus utili al combattimento; i successivi mantengono varietà e possibili compromessi. Nessuna rivalutazione dei pezzi già ottenuti.

Dopo due vittorie consecutive senza oggetti, la terza garantisce un drop. Il contatore per eroe persiste in `loot_progress` (migrazione v9), è mostrato nella scelta della sfida e viene aggiornato nella stessa transazione di XP e bottino. Sconfitta e fuga non lo consumano. La probabilità endgame Unico rimane 0,1% per vittoria idonea: solo il primo dei due drop può essere Unico.

Confronti ripetibili: `scripts/elite-balance.cjs --player --output artifacts/elite-player-after.json` legge soltanto corredo e progressione, poi simula in un database temporaneo. `scripts/growth-balance.cjs` confronta sei classi ai livelli 1/4/8/15/21/30/45, profondità doppia del livello, con sei pezzi ordinari senza set Unici. I report descrivono attacchi automatici e nessun consumabile: non sono probabilità garantite per tutte le build.

## Laboratorio alchemico

Quarta ambientazione, con ricette, banco in pergamena e scorte personali. I reagenti hanno un inventario separato e non occupano gli slot dello zaino. Non vengono venduti dal mercante e non entrano nella vendita massiva.

Ogni vittoria effettua un solo tiro aggiuntivo per i reagenti, indipendente dall'equipaggiamento e dalla protezione contro i drop vuoti. Probabilità complessive per categoria (poi scelta uniforme del singolo reagente):

| Scontro vinto | Chiave | Secondario |
| --- | ---: | ---: |
| Normale / pattuglia | 2% | 7% |
| Élite | 5% | 11% |
| Custode di spedizione | 8% | 15% |
| Sentiero sicuro | 0% | 0% |

Cinque formule utilizzabili da tutte le classi:

| Ricetta | Chiave | Bonus principale | Secondo bonus | Possibile malus | Potenziatore | Stabilizzante |
| --- | --- | --- | --- | --- | --- | --- |
| Furia della brace | Cuore di brace | Attacco +24–36% | Critico +5–9 punti | Difesa −7–13% | Zolfo solare | Rugiada lunare |
| Sigillo astrale | Cristallo astrale | Danno arcano +14–23 | Danno critico +14–24 punti | Vita −6–11% | Polvere di cometa | Sale purificato |
| Pelle del titano | Nucleo di quercia | Vita +28–42% | Riduzione danni +5–9 punti | Attacco −5–9% | Resina antica | Sale purificato |
| Patto del predatore | Zanna primordiale | Critico +10–16 punti | Furto vitale +3–5 punti | Difesa −6–12% | Sangue di drago | Rugiada lunare |
| Passo spettrale | Essenza del velo | Colpo rapido +8–14 punti | Schivata +5–9 punti | Vita −5–10% | Polvere di cometa | Resina antica |

I tre esiti hanno un fattore 0,92 / 1 / 1,08 sul bonus principale, con valori estratti separatamente. Gli importi piatti scalano con `(1 + min(100, livelloOggetto)/20) × min(3, moltiplicatoreProfonditàOggetto)`. I valori si fissano alla preparazione. Ogni proposta contiene due bonus e, con probabilità 70%, un terzo effetto negativo. Lo stabilizzante riduce il rischio al 25% e la grandezza del malus del 55% (con arrotondamento intero minimo 1). Il potenziatore aumenta del 35% il solo bonus principale. Servono una chiave e, facoltativamente, un'unità di ciascun secondario compatibile.

Preparare costa 100 passi (125 per Patto del predatore), più 10 ogni dieci livelli dell'oggetto, fino a 100 passi aggiuntivi. L'interfaccia mostra costo e ingredienti prima di confermare. Costi, consumo e generazione delle tre proposte si salvano nella stessa transazione. Una sola preparazione in sospeso per eroe, senza scadenza o rilanci gratuiti, recuperabile dopo menu o riavvio.

Scegliere uno dei tre esiti lega l'incantamento a quella precisa istanza dell'oggetto. Non sostituisce gli affissi originari. Il vincolo vieta un secondo incantamento, anche togliendo e rimettendo il pezzo. L'effetto è applicato solo mentre il pezzo è indossato, entra nel confronto degli oggetti e rispetta i normali limiti degli attributi. Un malus alla vita massima adegua gli HP senza uccidere il personaggio. L'incantamento ha un riquadro turchese nei dettagli e un bordo turchese negli slot e nello zaino.

Preparazione e applicazione sono vietate durante combattimenti e spedizioni. Gli oggetti in sospeso non sono vendibili; quelli incantati sono esclusi dalla vendita massiva ma possono essere venduti esplicitamente come gli altri oggetti non indossati. Cibo, pozioni, oggetti di altre classi o non ancora utilizzabili sono esclusi. Reagenti, proposte e incantamenti usano migrazione indipendente `alchemy_migrations` v1; i salvataggi esistenti mantengono ID, affissi e statistiche.

### Vendita in blocco per rarità

Il comando dello zaino apre tre modalità: «Vendi inferiori» conserva il filtro prudente esistente; «Vendi per rarità» seleziona tramite checkbox tutti i pezzi delle qualità scelte (Comune, Non comune, Raro, Mitico, Leggendario, Unico), compresi set, miglioramenti e livelli futuri. Oggetti equipaggiati, incantati e riservati a una preparazione alchemica sono sempre esclusi. Cibo e pozioni sono esclusi inizialmente e diventano vendibili solo selezionando «Includi cibo e pozioni». I reagenti restano nell’inventario alchemico separato.

Ogni filtro mostra nomi, numero dei pezzi e ricavo prima della conferma. Il motore calcola prezzi e candidati, vincola il token a filtro/eroe/equipaggiamento e rifiuta anteprime scadute. Addebito/accredito e cancellazione sono atomici; ripetere la stessa richiesta non duplica il ricavo. Durante uno scontro la vendita è disabilitata. Il cambio di filtro disabilita immediatamente la vecchia conferma finché non arriva la nuova anteprima. La selezione vuota non permette di vendere; più checkbox si confermano in una sola operazione atomica.

La select del laboratorio propone ora soltanto equipaggiamenti indossati, utilizzabili e non ancora incantati. Le preparazioni già pagate restano recuperabili anche se successivamente si toglie il pezzo.

### Filtro bottino automatico

La terza modalità, «Filtro bottino», apre un popup distinto dalla vendita dello zaino. Il filtro è disattivato inizialmente per ogni eroe. Si sceglie esplicitamente quali rarità conservare: una soglia «Conserva da questa rarità in su» seleziona tutte le qualità dalla soglia a Unico, mentre le checkbox permettono combinazioni libere. Il riepilogo distingue rarità conservate e vendute, prima del pulsante «Salva filtro». Serve almeno una rarità da tenere per attivarlo; chiudere il popup annulla le modifiche. Sono incluse le rarità dei nuovi cibi e pozioni, come indicato nel popup.

Le impostazioni sono per eroe e persistono con migrazione indipendente `loot_filter_migrations` v1. Si possono cambiare solo fuori dal combattimento. Ogni nuovo scontro salva una copia delle impostazioni; gli scontri precedenti alla migrazione conservano tutto. Il filtro agisce soltanto sugli ID appena generati: comprende i mostri degli scontri singoli, le pattuglie e i custodi delle spedizioni, e il premio finale della spedizione. Non scorre lo zaino esistente e non tocca oggetti equipaggiati, incantati, preparazioni in sospeso o reagenti. Il premio finale segue il filtro corrente dell’eroe e genera un evento di vendita distinto dal custode, con riferimento univoco alla spedizione.

Il prezzo è quello della normale vendita (25% del valore, minimo una moneta). Le monete si accreditano insieme a esperienza e ricompense nella transazione della vittoria, con evento `loot_auto_sale` univoco per scontro. Il resoconto salva numero, nomi, rarità e ricavo degli oggetti venduti; l’interfaccia mostra numero e ricavo; nelle spedizioni il riepilogo somma pattuglie, custode e premio finale. Il messaggio di vittoria somma le monete di combattimento e vendita, senza cambiare il campo dei premi base. La garanzia bottino conta i drop generati prima della vendita automatica. Ricaricare o ripetere una richiesta non duplica ricompense; sconfitta e ritirata non attivano il filtro.

Il rinnovo delle merci del mercato avviene con un solo clic su «Rinnova · costo»: nessun popup di conferma. Durante il rinnovo il pulsante è disabilitato per impedire doppi addebiti da clic ravvicinati; saldo e divieto durante uno scontro restano verificati dal motore.

## Investimenti in passi

Il laboratorio contiene due modalità nella stessa ambientazione: Incantamenti e Rifinitura. La rifinitura propone i sei pezzi attualmente indossati, inclusi quelli già incantati, con anteprima dei valori prima/dopo e costo in passi prima della conferma. Sono esclusi consumabili e pezzi senza statistiche o affissi positivi. È disponibile al rifugio fuori da combattimenti e spedizioni; un pezzo in preparazione alchemica deve prima completare quella scelta.

Ogni pezzo ha cinque gradi. Il moltiplicatore è `1 + 0,06 × grado`: +6/12/18/24/30% sulle statistiche di base e sugli affissi positivi originali. Gli importi sono arrotondati a due decimali e ricalcolati sempre dall’istanza originale, evitando moltiplicazioni ripetute. Malus, incantamento, bonus di set, livello richiesto e prezzo di vendita restano invariati. I valori partecipano ai normali confronti e ai limiti delle statistiche dell’eroe. La rifinitura non rilancia o sostituisce l’incantamento vincolato.

| Grado acquistato | Bonus cumulativo | Costo base in passi |
| --- | ---: | ---: |
| 1 | +6% | 300 |
| 2 | +12% | 600 |
| 3 | +18% | 1.000 |
| 4 | +24% | 1.500 |
| 5 | +30% | 2.200 |

Il costo base è moltiplicato per `1 + min(2, floor(livelloOggetto / 10) × 0,2)`: un pezzo di livello 30 richiede 480/960/1.600/2.400/3.520 passi, 8.960 in totale. Il grado rimane sulla singola istanza anche togliendola. Il nome mostra `+grado` e la scheda un riquadro azzurro. I pezzi rifiniti sono esclusi dalle vendite massive e protetti dal filtro automatico; la vendita singola resta possibile e non rimborsa i passi. Migrazione indipendente `refinement_migrations` v1, tabella `item_refinements`, eventi `refinement:itemId:grado` con riferimento idempotente per richiesta. Addebito e grado si salvano nella stessa transazione; gli oggetti esistenti non vengono riscritti.

## Spedizione di ricerca mirata

Nella scelta degli itinerari, «Ricerca mirata» apre la configurazione di un obiettivo: uno slot (arma, corpo, stivali, anello, amuleto) oppure un set ordinario della propria classe già sbloccato. Non permette di selezionare set Unici. Il costo è `400 + min(600, floor(livelloEroe / 10) × 100)` passi, più 200 per la ricerca di un set. Al livello 30 sono 700/900 passi; i tetti sono 1.000/1.200. Costo e obiettivo si confermano alla partenza e restano visibili nel viaggio salvato. Non si addebitano passi aggiuntivi nelle tappe.

Il viaggio usa quattro tappe e la forza delle Rovine: costa di più per il controllo sul premio. La sacca usa moltiplicatore zero, senza monete aggiuntive per la ricerca; gli scontri conservano i loro premi normali e i rari drop Unici del custode. Rientro e sconfitta rinunciano al premio finale e non rimborsano l’ingresso, come negli altri itinerari.

Completare salva due proposte di equipaggiamento, coerenti con classe e obiettivo, e recupera la vita. Le basi sono distinte quando il pool lo permette. Prima del livello 4 le proposte sono Non comuni; poi il minimo è Raro. I pesi relativi sono Raro 75, Mitico 22 (dal livello 8), Leggendario 3 (dal 15), rinormalizzati sui livelli disponibili. Non si estraggono Unici nel premio di ricerca. Affissi e statistiche restano casuali: viene garantita la categoria, non un miglioramento della build. Il livello del premio è quello dell’eroe al completamento e la scala usa la profondità iniziale.

Il giocatore esamina le due proposte con il confronto equipaggiamento e ne sceglie una sola; l’altra viene scartata. Le proposte restano identiche dopo menu e riavvio e non entrano nello zaino prima della scelta. Serve riscattarle prima di iniziare un’altra spedizione. Il filtro bottino rimane attivo: prima della scelta viene indicato se venderà l’oggetto. L’eventuale vendita entra nel riepilogo della spedizione e nel registro con lo stesso riferimento univoco del premio finale. Scegliere due volte lo stesso premio non duplica oggetti o monete; cambiare scelta dopo il riscatto è vietato.

Migrazione indipendente `research_migrations` v1 e tabella `expedition_research`, con obiettivo, due istanze generate e indice della scelta. Partenza, conclusione e assegnazione del premio sono ciascuna transazionali. I vecchi itinerari e i viaggi già iniziati mantengono le proprie regole e ricompense.

## Selezione personaggi e passi indipendenti

Le card di «Continua» mostrano livello e profondità correnti, letti da `hero_progress` insieme ai dati del personaggio. I nuovi eroi partono da livello 1 e profondità 1. In «Fuori dalle mura», Scontro singolo è a sinistra e Spedizioni a destra; Scontro singolo è la modalità predefinita a ogni apertura del personaggio. Una spedizione già in corso mantiene la propria modalità per riprendere il viaggio.

Selezionare un personaggio accredita automaticamente solo i passi di oggi già presenti nella cache Garmin della connessione attiva. Non avvia richieste di rete: il comando Importa continua ad aggiornare il totale Garmin, disponibile poi a ciascun eroe. L’accredito automatico mostra una notifica quando aggiunge passi; senza dati di oggi o connessione attiva non crea accrediti. Un import su un eroe non consuma i passi disponibili agli altri. Durante un download il controllo sull’eroe selezionato rimane attivo per evitare assegnazioni alla storia sbagliata.

La migrazione indipendente `hero_steps_migrations` v1 aggiunge `hero_step_claims`, con chiave eroe/sorgente/data e cancellazione a cascata. La tabella globale precedente `step_claims` resta come archivio. Per i vecchi salvataggi si ricostruiscono i contatori dai precedenti accrediti `steps_claim` del registro, raggruppati per destinatario e giorno locale e limitati al massimo della sorgente. Il vecchio registro non associa sempre sorgente e giorno a ogni operazione: per giornate senza una transazione databile si mantiene prudenzialmente il vecchio massimo ai destinatari precedenti, evitando di accreditare nuovamente passi già spesi. I saldi esistenti non vengono riscritti. I nuovi personaggi hanno contatori autonomi e la nuova attribuzione è sempre esatta per eroe/sorgente/data.

## Miniera automatica, Fabbro e Arena PvE

Tre nuove ambientazioni sono accessibili dalla barra inferiore, ognuna con uno sfondo pixel art originale locale. I prompt integrali e la provenienza ImageGen sono in `renderer/assets/scene-prompts.json`. Non è presente PvP.

La Miniera dispone di una squadra per eroe. Le durate sono 30/120/360/720 minuti; l’estrazione ordinaria è gratuita e non impegna l’eroe. La ripetizione automatica accumula viaggi completi fino a 24 ore di produzione, poi sospende l’accumulo. Il carico rimane al sicuro; al ritiro si può ripartire o fermare la squadra. Il tempo parziale di un ciclo automatico viene conservato al ritiro, salvo il raggiungimento del limite del deposito. Le spedizioni singole assegnano una sola durata anche dopo un’assenza lunga. Non serve tenere aperta l’app. L’orologio è quello locale, senza garanzie contro la manipolazione dei salvataggi o dell’ora del computer.

I cinque piani si sbloccano ai livelli Miniera 1/3/5/8/10. Un blocco di 30 minuti completato assegna un XP Miniera; il livello successivo richiede `8 + 4 × livello` XP. Al livello 10 la professione è completa. Il Ferro delle brume parte da quattro unità per blocco; livello e attrezzi ne aumentano la resa. Dal secondo piano si trova Argento lunare e si estraggono Gemme dell’aurora; dal quarto Adamantite; dal quinto anche Opali del vuoto, riservati a lavorazioni future. Le estrazioni sono salvate alla partenza su blocchi temporali: spezzare le missioni o riaprire l’app non ripete i tiri. Gli attrezzi hanno cinque gradi, da `100 × (grado + 1)²` monete, con +10% alla resa base per grado. La preparazione facoltativa costa 10 passi per blocco e aumenta del 25% il Ferro del solo primo viaggio, senza addebitare le ripetizioni automatiche. Ogni eroe riceve otto unità di Ferro una sola volta; materiali e progressi sono indipendenti e cancellati insieme all’eroe.

Il Fabbro crea armi, corpi, stivali, anelli e amuleti compatibili con la classe. Il livello scelto non supera quello dell’eroe. Creare costa `2 × (45 + 12 × livelloOggetto)` monete e `4 + 2 × floor(livelloOggetto / 5)` unità di Ferro; l’Argento sostituisce il Ferro in rapporto 1:2, l’Adamantite 1:4, arrotondando per eccesso. I materiali avanzati riducono la quantità richiesta senza modificare le probabilità. Una Gemma dell’aurora facoltativa esclude Comune e rinormalizza le altre probabilità; è rifiutata se non produce alcun beneficio. Il risultato è sempre un oggetto e si esamina prima di qualsiasi vendita: il filtro bottino non si applica alle creazioni.

Il Fabbro cresce fino al livello 20. Una creazione assegna `max(0,10−2×max(0,livelloFabbro−livelloOggetto))` XP; il livello successivo richiede `40 + 15 × livelloFabbro`. Le distribuzioni Comune/Non comune/Raro/Mitico/Leggendario sono 70/30/0/0/0 ai livelli 1–4, 45/40/15/0/0 ai livelli 5–9, 25/45/27/3/0 ai livelli 10–14, 10/35/46/8/1 ai livelli 15–19, 0/25/60/13/2 al 20. Raro/Mitico/Leggendario richiedono inoltre livello eroe 4/8/15; i pesi disponibili si rinormalizzano. Nessun set o Unico viene creato da zero. I nuovi pezzi di fucina non ricevono bonus di profondità, mantenendo il valore dei ritrovamenti delle avventure.

La Riforgiatura porta l’equipaggiamento al livello dell’eroe e ricalcola gli attributi. Il costo base è il 35% del valore commerciale corrente, arrotondato per eccesso e con minimo 25 monete. Quando il livello sale, si aggiunge il 35% dell’incremento di valore di un pezzo equivalente per rarità e set, sempre arrotondato per eccesso. Lo stesso incremento aggiorna il valore commerciale del pezzo; la rivendita non recupera il costo dell’adeguamento. A parità di livello non si applica alcun sovrapprezzo. Anche l’equipaggiamento iniziale può crescere; gli oggetti di livello superiore all’eroe o riservati a un’altra classe non sono riforgiabili.

Si conservano ID, modello, slot, rarità, set, profondità originaria, moltiplicatore di profondità, numero di affissi, incantamento e rifinitura. Il bonus storico di profondità resta valido anche se il nuovo livello supera la profondità del ritrovamento. Gli attributi vengono sostituiti definitivamente e possono peggiorare; non si assegna XP professione e non si cura l’eroe. Il preventivo vincola livello dell’eroe, stato del pezzo e versione: una modifica prima della conferma richiede un nuovo preventivo, senza addebiti. Le richieste già completate restano idempotenti e le versioni precedenti rimangono nel registro delle operazioni. Preparazioni alchemiche pendenti impediscono la riforgiatura.

La selezione usa una griglia con icone, rarità, livello e indicazione dei pezzi equipaggiati, filtri per categoria e pagine da 12 oggetti. Il popup su passaggio del mouse o focus e il pulsante Esamina mostrano gli stessi dettagli e confronti dell’inventario. Prima della conferma si vedono livello iniziale e finale, costo base, adeguamento e totale. I Comuni creati o riforgiati hanno piccoli intervalli di base; anelli e amuleti comuni ricevono vita base, senza affissi aggiuntivi. Gli oggetti esistenti non vengono rivalutati automaticamente. La Rifinitura garantita già esistente è accessibile anche nel Fabbro; il collegamento precedente dal laboratorio resta disponibile.

L’Arena comprende allenamento libero illimitato e sei prove premiate al giorno per eroe: tre gratuite da 10% degli XP richiesti dal livello e tre aggiuntive da 5%. Il budget viene fissato al primo ingresso giornaliero, senza crescere dopo un level-up e senza moltiplicatori di equipaggiamento o Garmin. Ogni ingresso aggiuntivo costa `5 + livelloEroe` monete oppure 15 passi; un contratto già acquistato si può riprovare gratis dopo sconfitta o interruzione. Il giorno del contratto determina il premio anche attraversando la mezzanotte. Ogni premio si ottiene una volta sola. I turni accettano Attacca, Difendi, Auto e Interrompi e usano il motore condiviso con le avventure. Al massimo 250 turni per prova; uno stallo termina in pareggio senza premio. La vita dell’Arena è separata e parte al massimo; non si usano consumabili. Le prove non cambiano HP reali, profondità, oro, bottino, reagenti o garanzia drop. L’XP premiato può far salire di livello ma non cura la vita reale. Un combattimento Arena attivo si riprende dopo menu/riavvio e impedisce avventure e modifiche dell’equipaggiamento fino al termine.

Schema indipendente `settlement_migrations` (v1 iniziale, v2 nella stabilizzazione): profili, materiali, estrazioni, registro delle operazioni, versioni di riforgiatura, budget/contratti giornalieri e sessioni Arena. Costi, materiali, risultati e premi vengono aggiornati nella transazione del comando. Request ID e controlli di proprietà impediscono replay fra eroi o riutilizzi per operazioni differenti. I vecchi salvataggi conservano oggetti, saldi e progressione.

## Stabilizzazione v1.1.0

`settlement_migrations` v2 aggiunge il resto frazionario della produzione, i resti salvati per blocco e la configurazione del viaggio successivo. La resa di Ferro per mezz’ora è `4 + 0,22 × (livelloMiniera−1) + 0,4 × gradoAttrezzi`; si sommano unità intere di precisione 1/10.000 e si conserva il resto dopo ogni ritiro. Al livello Miniera 1, dieci blocchi con attrezzi 0/1/2/3/4/5 producono esattamente 40/44/48/52/56/60 Ferro. La preparazione moltiplica per 1,25 soltanto i blocchi della prima durata scelta; i cicli automatici successivi usano la resa ordinaria. I vecchi lavori conservano il piano già fissato, senza rilanci o sottrazioni retroattive.

«Configura prossimo viaggio» salva piano, durata e ripetizione per la ripartenza al ritiro. La missione corrente e la preparazione già pagata non cambiano. Con una nuova configurazione si conteggiano prima tutti i blocchi di mezz’ora già completati sul vecchio piano; il tempo residuo di un lavoro automatico passa al nuovo viaggio. Un deposito pieno di 24 ore rimane sospeso e la ripartenza avviene dal momento del ritiro. Nessuna preparazione viene acquistata automaticamente.

Il preventivo di creazione è calcolato dal backend, con monete, tutti i materiali inclusa la gemma, XP professione e probabilità effettive. Un token lega il preventivo a eroe, ricetta, saldi, materiali e livelli. La conferma verifica nuovamente il token prima di spendere; i retry della stessa operazione restano idempotenti. In Riforgiatura il pannello laterale mostra la rarità e le proprietà conservate, senza la tabella delle probabilità di creazione. L’Opale del vuoto è indicato come riservato a lavorazioni future.

L’interfaccia aggiorna la giornata dell’Arena a mezzanotte e al ritorno del focus/visibilità. I popup aperti non vengono sostituiti e una lettura in ritardo non può sovrascrivere il risultato di un comando più recente. Le sessioni attive si riprendono anche dopo il ritorno al menu.

Prima di avviare migrazioni su un archivio esistente, il processo principale crea una copia SQLite coerente tramite `VACUUM INTO`, verifica l’integrità della copia e conserva il file nella sottocartella `backups` del profilo. Un backup fallito impedisce l’aggiornamento senza modificare il salvataggio. Un errore di avvio permette di scegliere un backup oppure aprire la cartella dei dati. Il ripristino valida il file scelto e conserva database precedente, WAL e SHM in una cartella `recovery-*` prima di sostituire il salvataggio. I backup contengono anche la chiave Garmin, se presente. La normale applicazione acquisisce il lock di istanza unica prima di aprire gli archivi; i test usano profili temporanei indipendenti.

Verifiche ripetibili: `npm test`, `npm run test:electron`, `npm run test:release`, build della piattaforma e `node scripts/verify-runtime.cjs`. Quest’ultimo controlla sia SQLite nell’eseguibile distribuito sia Miniera/Fabbro/Arena e sfondi nel pacchetto reale, con dati temporanei. In CI Linux viene eseguito sotto Xvfb. Il report economico corrente è [release-economy-v1.1.0.json](release-economy-v1.1.0.json); il precedente `economy-review.json` resta un modello storico per il workbook e non valida le regole attuali. Scenari e seed sono espliciti: i risultati non stimano divertimento o comportamento di tutti i giocatori.

## Base Garmin e Gilda degli esploratori (v1.2.0)

La Gilda è una nuova ambientazione con sfondo pixel art originale, accessibile dalla barra. Il catalogo contiene tre storie di due capitoli ciascuna: Carovana delle lanterne, Patto della montagna e Messaggi del fiume. I capitoli successivi si sbloccano concludendo il precedente. Ogni capitolo concluso conserva una delle due scelte e il suo epilogo nel diario; il secondo assegna un titolo cosmetico selezionabile nella Gilda, visibile anche negli Attributi. Non vengono assegnati passi, monete, materiali, equipaggiamento, XP o modificatori alle statistiche. I sei capitoli sono completabili una sola volta per eroe e preparano l’aggiunta di future storie.

Si accetta un solo incarico alla volta, con un massimo di tre accettazioni per settimana locale, da lunedì. Abbandonare richiede conferma, azzera soltanto il progresso di quell’incarico e non restituisce l’accettazione settimanale. Un incarico in corso non scade a fine settimana e continua anche dopo riavvio. Il limite riguarda le nuove accettazioni, non il giorno in cui si conclude una storia.

Ogni incarico offre due alternative equivalenti: una singola attività Garmin di un tipo compatibile e della durata richiesta (20–30 minuti), oppure 2.000–4.000 passi nuovi distribuiti anche su più giorni. Le soglie sono regole di gioco, non obiettivi sanitari. Le attività devono iniziare dopo l’accettazione e risultare già terminate. Non si sommano sessioni brevi. Lo stesso ID attività può concludere un solo incarico per eroe e account; gli eroi mantengono storie indipendenti.

I passi della giornata di accettazione contano solo rispetto al totale iniziale già noto nell’archivio Garmin. Se manca un totale iniziale, la UI avvisa che i passi conteranno da domani; le nuove attività registrate restano utilizzabili subito. Le revisioni salvate e i contatori massimi preservano il progresso attraverso correzioni al ribasso. Spendere passi nel mondo non riduce l’obiettivo della Gilda. Scaricare lo storico per gli incarichi non accredita valuta dei giorni precedenti: il portafoglio continua a importare soltanto oggi.

La sincronizzazione ordinaria aggiorna gli incarichi attivi recuperando sei giorni precedenti di passi e fino a sette giorni inclusivi di attività, con paginazione da 50 e un massimo di 20 pagine. Un elenco troncato o malformato viene rifiutato interamente. Lo snapshot completo sostituisce le attività della finestra: le revisioni o cancellazioni Garmin non rimangono eleggibili per incarichi ancora da concludere. Le storie già concluse non vengono revocate. Un errore delle attività non blocca i passi; la Gilda mostra disponibilità e data dell’ultimo aggiornamento. Il recupero tardivo copre questa finestra di sette giorni, senza importare tutto lo storico all’attivazione.

I riepiloghi conservano ID attività, data locale originale, inizio/fine UTC, famiglia di attività, durata in secondi, distanza e dislivello quando presenti. Nomi delle attività, tracce GPS, coordinate e serie cardiache non sono memorizzati. Inserimenti marcati manuali e sottoattività multisport con parentId sono esclusi. La normalizzazione distingue camminata/escursionismo, corsa, ciclismo e nuoto; tipi sconosciuti restano esclusi dagli obiettivi tipizzati.

L’identità deriva esclusivamente da userProfilePk nei riepiloghi giornalieri autenticati documentati da Garmin, mai dal nome utente. Nel database si conserva il suo hash separato dall’hash della chiave. Una chiave rinnovata dello stesso account viene associata allo scope già verificato; account diversi non vengono uniti. Gli scope legacy eventualmente riconciliati mantengono i dati originali in archivio e trasferiscono massimi già accreditati e snapshot correnti in modo transazionale, senza riscrivere i saldi o riemettere accrediti. Le chiavi già collegate e temporaneamente prive di riepiloghi continuano a usare il proprio archivio. Il salvataggio di una nuova chiave richiede l’identità verificata; senza dati si chiede di sincronizzare prima il dispositivo con Garmin Connect.

Le migrazioni indipendenti `garmin_foundation_migrations=1` e `guild_migrations=1` sono incluse nel controllo e nel backup automatico prima dell’aggiornamento. Gli ID di missione e i vincoli SQL impediscono doppie conclusioni e assegnazioni fra eroi; titolo, epilogo e consumo dell’attività sono salvati nella stessa transazione. La lingua copre tutti i testi in italiano, inglese, francese, spagnolo, tedesco e giapponese.

Riferimento API verificato: [Swagger ufficiale Garmin Personal API](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/). La lettura resta tramite Personal API e non richiede backend, app mobile o Connect IQ. I test usano riepiloghi sintetici basati sullo schema pubblico; non accedono ad account personali.

## Atlante del viandante (v1.2.0)

La Gilda contiene due schede: Bacheca e Atlante. La Provincia del Rifugio collega dieci luoghi su una mappa pixel art: il Rifugio, sei luoghi legati ai capitoli della Gilda, la Quercia dei nomi, il Pozzo delle stelle e il Faro delle Lanterne. L’Atlante legge le stesse missioni della Bacheca: le storie già concluse e le relative scelte compaiono senza ripeterle o assegnare nuove ricompense. Da un luogo narrativo si apre il suo incarico; le sezioni principali restano accessibili dalla barra.

Gli stati sono Inesplorato, Individuato, Accessibile, Risolto e Trasformato. Le visite vengono salvate per eroe. Il secondo luogo di ogni storia richiede il primo capitolo; la Quercia e il Faro richiedono almeno un capitolo concluso, il Pozzo almeno due. Aprire la mappa, consultare i luoghi e visitare il Rifugio non costa valuta. I segnalini sono pulsanti accessibili da tastiera con nome, stato e selezione annunciati.

Quercia e Pozzo offrono due scelte permanenti ciascuno, confermate prima del salvataggio. Non assegnano valuta, XP, materiali, oggetti o bonus. La Quercia conserva una lanterna o nastri; il Pozzo un mosaico ricomposto o la storia del cartografo. Anche le scelte della Gilda modificano rappresentazioni e descrizioni: ponte o traghetto, santuario protetto o lanterne dei minatori, accampamento o rifugio rifornito. Ogni scelta è indipendente per eroe, persistente e non ripetibile per ottenere vantaggi.

Il Faro è una spedizione regionale di quattro tappe, accessibile dall’Atlante, con ingresso unico di 75 passi. Costi, moltiplicatore di difficoltà e scala delle ricompense sono quelli delle Rovine della veglia. Alla partenza vengono salvati insieme piano, scelte della provincia, visita e addebito; i cambiamenti successivi della mappa influenzano il viaggio seguente. Sentiero iniziale e riparo riflettono le scelte già compiute. Nei nuovi viaggi l’attraversamento del fiume offre opportunità giocabili diverse e la terza tappa custodisce l’ultima fiamma, descritta sotto. I piani già salvati mantengono le proprie tappe.

Lo scontro finale affronta il Custode del Faro, con sprite e fondale originali. Nella prima fase il suo intento annuncia un colpo potente ogni terzo turno; i nuovi incontri proseguono poi nella fase dell’alba. I combattimenti della spedizione non addebitano ulteriori passi. Rientro, sconfitta, sacca, equipaggiamento e filtro bottino seguono le regole già presenti; un viaggio attivo si riprende anche dalla mappa. La vittoria riaccende il Faro e registra il traguardo nella stessa transazione di bottino e conclusione. Rientri e sconfitte non lo assegnano. Le rivisite danno le normali ricompense della spedizione, senza duplicare il traguardo.

Sei capitoli della provincia conclusi e Custode sconfitto sbloccano il titolo cosmetico «Cronista del Rifugio», selezionabile dalla Gilda o dall’Atlante. I due incontri sono facoltativi per questo traguardo. Non ci sono nuove richieste Garmin, contatori di movimento o dati geografici. `atlas_migrations=1` conserva visite, scelte, fotografie dei viaggi e traguardi ed è incluso nel backup preventivo. Le traduzioni coprono le sei lingue del gioco.

### Il Faro: finale della provincia (v1.3.0)

La chiamata del cartografo compare al Rifugio dopo il primo capitolo Gilda e si legge prima della partenza dall’Atlante. Il requisito rimane un capitolo, l’ingresso 75 passi e il viaggio quattro tappe. La partenza fissa una fotografia v2 della provincia. Nessun nuovo dato Garmin o contatore di movimento è necessario.

- Attraversamento: il ponte ricostruito offre +4 difesa per il viaggio; i traghettatori aiutati offrono una cura del 20% della vita massima. In entrambi i casi si può invece affrontare una pattuglia per i premi normali e monete in sacca. Senza una scelta del fiume resta il bivio fra pattuglia e ricerca rischiosa. Il riparo della seconda tappa mantiene cura del 35% oppure +18% attacco e +2 difesa.
- Ultima fiamma: alla terza tappa si sceglie una cura del 35% della vita massima oppure una protezione che riduce del 70% i danni della prima alba spezzata che colpisce. Schivare non consuma la protezione. Le opzioni si escludono e si salvano con la normale revisione della spedizione.
- Custode: soltanto i nuovi piani assegnano la meccanica `lantern-v1`. La vita del nuovo Custode è 1,6 volte quella del precedente incontro regionale, per dare spazio alle due fasi. Attacco, difesa e ricompense conservano la scala precedente. La prima fase ha il colpo potente ogni tre turni (×1,5). Il colpo che raggiunge metà vita, anche critico, multiplo o riflesso, rompe il sigillo e ferma la vita alla soglia; la trasformazione non aggiunge un attacco nemico.
- Alba prigioniera: il ciclo è raccolta della luce senza attacco, alba spezzata (×2,3 danni), apertura (×0,65 danni nemici e +50% danni degli attacchi dell’eroe). L’intento mostra la prossima azione effettiva. La difesa normale riduce il danno al 40%; la fiamma può ridurre ulteriormente il danno dell’alba. Pozioni e difesa fanno avanzare il ciclo. Fase, ciclo e carica della fiamma sono salvati nei buff dello scontro.

Prima dello scontro viene offerta la scelta esplicita fra turni manuali e risoluzione automatica quando l’automatico è selezionato. L’automatico mantiene la strategia di attacchi normali, senza consumare pozioni. Il confronto degli oggetti continua a usare gli scontri ordinari e non promette un esito contro il Custode.

La vittoria salva in `expeditions.rewards.finale` il percorso della fotografia iniziale, la scelta della fiamma e l’epilogo. Traguardo, bottino, conclusione e ricordo condividono la transazione del turno vincente. La scena mostra il Faro che illumina la mappa; il motivo sonoro originale si ascolta soltanto premendo «Ascolta il Faro». Le animazioni rispettano la preferenza di movimento ridotto e nessun avanzamento dipende dai loro tempi.

La riaccensione si può rivedere dal resoconto, dal Faro nell’Atlante, dal ricordo del Faro nelle Cronache e dalla voce del cartografo al Rifugio. La prima memoria del nuovo finale rimane conservata anche dopo rivisite e successive scelte del mondo. Rivedere la scena non effettua operazioni economiche. Il vecchio traguardo e la sua data restano intatti; un eroe che aveva già vinto può aggiungere l’epilogo con una nuova spedizione.

Compatibilità: nessuna nuova tabella o migrazione; si riusano i JSON già salvati di piano, fotografia, bonus, scontro e ricompense. I viaggi avviati prima dell’aggiornamento continuano con le opzioni e il Custode salvati, senza attivare retroattivamente la seconda fase. Le sei lingue coprono chiamata, nuovi bivi, intenti, log, epilogo e comandi. Verifiche: suite `npm test` e percorso grafico `npx --no-install electron . --smoke-test --atlas`, con controlli di contrasto e geometria nelle sei lingue.

## Cronache del Rifugio (v1.2.0)

Il libro «Apri le Cronache», accessibile dalla Bacheca della Gilda, raccoglie 21 imprese in quattro famiglie: Cammini, Attività, Atlante e Maestrie. Ogni ricordo ha un emblema originale, obiettivo, progresso, racconto, data di conquista e indicazione di lettura. La Quercia conserva la variante lanterna/nastro scelta nell’Atlante. L’assegnazione è automatica, unica e transazionale; «Conserva nel libro» segna soltanto la pagina come letta. I ricordi nuovi sono segnalati nel libro e, dopo un comando che li sblocca, con una notifica. Non vengono assegnati passi, XP, monete, materiali o modificatori alle statistiche.

Il registro si apre automaticamente alla prima selezione dell’eroe dopo l’aggiornamento; la sua data è visibile nel libro. I passi già accreditati oggi costituiscono una baseline, quelli dei giorni precedenti non alimentano i nuovi contatori. Dal registro in avanti si conserva il massimo giornaliero accreditato all’eroe, deduplicando scope e alias delle chiavi. Spendere il saldo non diminuisce il progresso. Correzioni al ribasso, import ripetuti e rinnovi della chiave non moltiplicano i passi delle Cronache. I contatori sono indipendenti per eroe.

Cammini: 2.000 passi; stivali in tre gradi a 10.000/50.000/100.000; sette giornate con almeno 2.000 nuovi passi, senza serie obbligatoria; Giro delle lanterne; 500.000 passi. Non ci sono scadenze o azzeramenti per inattività.

Attività: una e cinque camminate/escursioni da almeno 20 minuti; una corsa da 20 minuti; un’attività di ciclismo da 20 minuti; un nuoto da 15 minuti; tre famiglie diverse fra quelle idonee. Le attività devono iniziare dopo l’apertura del registro, essere concluse e presenti nell’archivio normalizzato. Le sottoattività multisport e gli inserimenti manuali rimangono esclusi dalla normalizzazione Garmin. Un ID di attività conta una volta sola per eroe, anche riletto o associato a una nuova chiave. Le ricevute annotate sono permanenti e non vengono revocate quando l’attività esce dalla finestra dell’archivio. Le famiglie sono facoltative e non vincolano la storia principale.

L’importazione manuale dei passi aggiorna anche le attività senza incarichi Gilda attivi. Si riusa la richiesta già esistente alla finestra di sette giorni; lo storico dei passi viene recuperato soltanto quando serve a un incarico attivo. Un errore delle attività lascia funzionanti i passi e viene mostrato nella pagina del ricordo. Aprire e leggere il libro non avvia richieste di rete. Si conservano soltanto ID, famiglia, giorno e data di annotazione delle attività idonee; nessun nome attività, traccia GPS o serie sanitaria viene aggiunto alle Cronache.

Atlante: dieci luoghi visitati, sei capitoli conclusi, incontro della Quercia, vittoria al Faro, completamento dei sei capitoli più i due incontri e il Faro. I capitoli conclusi valgono anche come prova di visita dei loro sei luoghi. Le altre visite derivano dai registri dell’Atlante. Maestrie: prima creazione dal Fabbro, Miniera al livello 3 che sblocca il secondo piano, tre prove Arena gratuite vinte nello stesso giorno. Le prove e le operazioni già dimostrabili vengono riconosciute senza ripeterle né ripagarle; la data indica il ritrovamento nel nuovo registro.

Il Giro delle lanterne si avvia gratuitamente dal libro e non occupa lo slot degli incarichi Gilda. La partenza salva il totale attuale come baseline e i retry non lo azzerano. Cinque tappe richiedono 5.000 passi nuovi ciascuna: Rifugio, Sentiero, Quercia, Due rive e Faro. I passi non vengono spesi. L’ultima tappa attende anche almeno un capitolo Gilda concluso; il cammino già percorso rimane valido. Le pagine della Quercia e del fiume fissano la variante presente al passaggio. Il giro non sblocca luoghi, non inventa visite e non sostituisce la spedizione del Faro. Una piccola lanterna indica sull’Atlante la prossima sosta.

Tre sigilli personali possono essere esposti nel libro e nel profilo Attributi; ogni ricordo può occupare un solo slot. Si possono spostare e rimuovere senza costi, fuori dagli scontri. Il Giro assegna anche «Portatore di lanterne»; 500.000 passi assegnano «Custode degli orizzonti». Entrambi sono titoli cosmetici selezionabili dalla Gilda o dalla pagina del ricordo. La mappa dei dieci luoghi viene esposta anche nel pannello della Gilda.

Lo schema indipendente `chronicle_migrations=1` contiene registro, massimi giornalieri, ricevute delle attività, conquiste, sigilli e soste. È incluso nel backup preventivo. I nuovi contatori non alterano record legacy, portafogli o progressione. `lib/chronicle-catalog.cjs` è il catalogo autorevole delle imprese e dei racconti. Test ripetibili: `npm test`, `npx --no-install electron . --smoke-test --chronicles`, suite Electron completa e verifica dell’eseguibile compilato.
