# Loop base e libreria degli oggetti

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

Il riscatto considera il massimo già accreditato per sorgente e data, condiviso fra gli eroi. Rileggere i dati o cancellare un personaggio non ricrea passi spendibili; una revisione Garmin positiva assegna solo l’incremento. Una revisione in diminuzione non sottrae retroattivamente valuta spesa. I passi vengono assegnati all’eroe selezionato quando si riscatta. Eliminare quell’eroe elimina il suo saldo e non rende nuovamente riscattabili i passi assegnati.

Le sorgenti Garmin rimangono separate per fingerprint della chiave API, come nel precedente archivio. Per un futuro cambio chiave senza cambio account servirà una migrazione dell’identità sorgente verificata: attualmente una chiave diversa è una sorgente diversa.

## Mercante e bottino

Il mercante genera 12 offerte per eroe. Cambiare schermata, comprare tutte le scorte o riavviare l’app non le rigenera. Il rinnovo costa `10 + 3 × livello` monete, elimina soltanto le offerte rimaste e conserva gli oggetti già acquistati.

Il generatore sceglie basi compatibili con classe e livello, rarità pesata, affissi compatibili e valori entro i range. Il mercato mantiene pesi 7100/2300/500/90/10. I nuovi drop dei mostri usano 2500/4000/2800/600/100 per comune/non comune/raro/mitico/leggendario; le élite usano 0/1500/6000/2200/300, quindi garantiscono equipaggiamento almeno non comune. Rari, mitici e leggendari si sbloccano ai livelli 4/8/15: i pesi si rinormalizzano sulle rarità disponibili, quindi non sono probabilità assolute a ogni livello. I consumabili restano comuni.

La probabilità di ottenere un oggetto dopo una vittoria è 65% nel sentiero sicuro, 85% negli scontri normali e due oggetti garantiti nelle élite e nei custodi. Il bonus bottino moltiplica le probabilità non garantite fino al 95%. Prima di partire si vedono costo, profondità del nemico e probabilità effettiva sulla build corrente. Lo scontro sicuro usa profondità `max(1,min(profondità−1,livello eroe))`, forza ×0,75 e non fa avanzare: permette di recuperare equipaggiamento ed esperienza quando l’avanzamento è troppo difficile. Le élite sono esplicite e hanno forza ×1,18; non compaiono automaticamente ogni cinque profondità. L’attacco base dei nuovi nemici cresce come `6 + 2,5 × profondità`, anziché `6 + 3 × profondità`. Gli incontri già iniziati mantengono i valori nemico salvati.
Quando viene estratto equipaggiamento raro o superiore e sono disponibili set, la probabilità iniziale di scegliere una base di set è 10%, o 24% per un’élite. Fra le basi idonee, gli oggetti vengono scelti casualmente. Non ci sono premi ripetuti per lo stesso combattimento: la chiusura dello scontro e l’assegnazione di XP, monete e oggetto condividono una transazione.

Le regole economiche iniziali sono in `game_rules`, i pesi e conteggi in `item_rarities`, i range in `attribute_definitions`/`affix_ranges`. Sono parametri da bilanciare giocando; questa versione non pretende un equilibrio definitivo della progressione.

## Persistenza e verifiche

Le nuove tabelle si aggiungono a `stepquest.sqlite` senza cambiare lo schema dell’archivio Garmin. `game_migrations` è indipendente da `PRAGMA user_version`. La versione 2 aggiorna anche la prima versione dello schema già presente, aggiungendo parametri, definizioni delle statistiche e colori dei bonus di set senza rigenerare gli oggetti. Oggetti, affissi, scorte, saldo, XP, HP, set e combattimenti non dipendono dal renderer. I comandi IPC operano sull’eroe selezionato nel processo principale, con controllo di proprietà, classe, livello, saldo e turno atteso.

I test coprono mille estrazioni attraverso le cinque rarità, sei classi, persistenza dopo riapertura, set condizionali, livelli, limiti, rollback, acquisti duplicati, riscatto fra eroi, cancellazione, fuga, sconfitta e ricompense uniche. Il test Electron completa il ciclo e controlla contrasto e dialoghi delle cinque rarità usando soltanto un database temporaneo e passi di prova. Non contatta Garmin né aggiunge oggetti di prova ai salvataggi reali.

## Confronto con l’equipaggiamento

Ogni oggetto equipaggiabile, nello zaino o nel mercato, include un confronto calcolato dal processo principale. Viene simulata la sostituzione dello slot sulla build corrente: statistiche base, percentuali, malus, limiti e soglie dei set vengono ricalcolati senza cambiare il salvataggio. Il dettaglio mostra gli attributi effettivi prima/dopo e le differenze. Per le probabilità, la differenza è espressa in punti percentuali.

La potenza è una stima di combattimento ottenuta dalla media geometrica di danno atteso e resistenza effettiva contro una minaccia alla profondità corrente. Include precisione, critico, colpo rapido, danno arcano, difesa, vita, schivata, parata, riduzione danni, rigenerazione, furto vitale e una quota del danno riflesso. Il recupero non può rendere infinito il punteggio. I bonus economici e di bottino vengono confrontati negli attributi, senza essere trasformati in potenza di combattimento.

Le frecce verdi sugli sprite indicano una stima positiva: una da +0,5%, due da +5%, tre da +15%. Non compaiono su consumabili, oggetti già indossati o oggetti che non rispettano classe/livello. Nel dettaglio rimangono visibili anche peggioramenti, scambi fra attributi e requisiti. Una rarità superiore non implica automaticamente un miglioramento. Il confronto si aggiorna dopo ogni cambio di equipaggiamento o avanzamento.

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

Riposo e conversione sono accessibili dalla barra in tutte le ambientazioni. A Casa lo zaino è la griglia nella scena; nelle altre ambientazioni si apre dalla barra come popup: aprire un oggetto e tornare allo zaino, indossarlo, toglierlo o venderlo mantiene scena e pagina. Durante il combattimento si possono consultare gli oggetti e utilizzare i consumabili consentiti; il cambio di equipaggiamento resta bloccato. Riposo e cambio monete restano espliciti e non sono disponibili durante uno scontro.

Nel dettaglio del mercante «Compra e indossa» effettua entrambe le azioni in una transazione SQLite. I controlli di classe, livello, slot e saldo avvengono nel motore: se l’equipaggiamento fallisce non si addebitano monete e l’articolo rimane al mercante. Gli anelli hanno un comando per ciascuno slot. Il solo acquisto rimane disponibile. Se mancano monete, «Converti passi» apre lo slider e, dopo la conferma, riporta allo stesso articolo con il saldo aggiornato.

Fuori dallo scontro si parte o si combatte ancora dal pannello della sfida; la barra mantiene gli strumenti comuni, senza duplicare l’avvio. In battaglia vengono mostrate le cinque azioni del combattimento. Il riposo può essere eseguito sul posto, senza passare dalla scena di Casa; a vita piena il comando è disabilitato e il tooltip ne spiega il motivo. Nessun recupero o scontro è avviato automaticamente.

Durante un’operazione i comandi vengono bloccati senza ricostruire la scena in attesa della risposta. Dopo la risposta vengono aggiornati stato e interfaccia. I popup supportano ritorno allo zaino anche con Escape e ripristino del focus quando il controllo d’origine è ancora disponibile. Categoria del mercato, difficoltà e pagine sono conservate nella sessione dell’eroe.

## Spedizioni: prima versione del loop a scelte

La modalità predefinita dei sentieri è ora una spedizione di quattro tappe. Lo scontro singolo rimane nella scheda accanto. Non richiede mappe, movimento o animazioni.

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

Il motore conserva per account e giorno il massimo totale Garmin già accreditato: al primo import aggiunge il totale di oggi ancora disponibile; ai successivi solo la differenza positiva. Spendere passi, riaprire il gioco o cambiare eroe non azzera questo contatore. Una correzione Garmin al ribasso non rende riscattabili passi già assegnati. La notifica mostra il totale giornaliero e l’incremento aggiunto, oppure l’assenza di nuovi passi.

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
