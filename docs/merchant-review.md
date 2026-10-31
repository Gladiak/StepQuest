# Mercante: carovane, occasioni e provviste

Il mercante accompagna la progressione con sei carovane, equipaggiamento mirato e una sacca di provviste utilizzabile dopo le vittorie. Gli Unici rimangono premi dell’avventura: trovare un leggendario in bottega non garantisce di migliorare un corredo Unico potenziato. Le frecce nella lista permettono di individuare i candidati da esaminare sulla propria build.

## Assortimento e progressione

Ogni assortimento ha **12 offerte**, ordinate **Armi → Armature → Accessori → Pozioni → Cibo**, con quantità **3/3/2/3/1**. Le armature comprendono due pezzi per il corpo e uno per i piedi. Le basi sono compatibili con classe e livello; un equipaggiamento raro o superiore può appartenere a un set ordinario, con probabilità iniziale del 10%. Gli Unici sono esclusi.

| Livello minimo | Carovana | Pesi delle offerte ordinarie | Proprietà minime* | Occasione garantita |
| ---: | --- | --- | ---: | --- |
| 1 | Banco del viandante | Comune 45%, non comune 55% | 1 | Non comune a ogni rinnovo |
| 4 | Carovana delle braci | Comune 10%, non comune 45%, raro 45% | 2 | Rara ogni 2 rinnovi |
| 15 | Bazar delle stelle | Non comune 15%, raro 50%, mitico 30%, leggendario 5% | 3 | Leggendaria ogni 3 rinnovi |
| 45 | Emporio dei campioni | Raro 25%, mitico 55%, leggendario 20% | 4 | Leggendaria ogni 2 rinnovi |
| 150 | Conclave delle meraviglie | Mitico 60%, leggendario 40% | 5 | Leggendaria a ogni rinnovo |
| 500 | Crocevia dell’eternità | Mitico 35%, leggendario 65% | 5 | Leggendaria a ogni rinnovo |

\* Sempre entro il massimo della rarità: un comune non ha affissi, un non comune ne ha al massimo 2, un raro 3, un mitico 4 e un leggendario 6. I pesi valgono per l’equipaggiamento ordinario; l’occasione ha la propria rarità garantita. I consumabili restano comuni.

L’occasione, contrassegnata da una stella, ruota fra armi, armature e accessori. Riceve il massimo numero di proprietà della propria rarità, tutte positive: un’occasione leggendaria ha sei bonus. Il numero di rinnovi fino alla prossima occasione è visibile e persistente; riaprire il mercato non lo azzera. Un assortimento iniziale può già avere l’occasione se la revisione salvata coincide con la cadenza.

Le armi con affissi iniziano con attacco fisso sotto il livello 15 e attacco percentuale successivamente; armature e stivali iniziano con vita fissa o percentuale alle stesse soglie. I due accessori hanno specializzazioni distinte: **Fortuna del viandante** privilegia monete ed esperienza; **Scorta del cacciatore** bottino e potenza pozioni. Il secondo bonus compare quando il numero di affissi lo consente. Le proprietà preferite sono positive; gli ulteriori affissi ordinari possono avere malus secondo il generatore comune.

Il rinnovo costa ancora `10 + 3 × livello` monete. I prezzi dell’equipaggiamento applicano alla formula ordinaria un moltiplicatore di 1,10 prima del livello 15 e 1,35 successivamente; le occasioni applicano rispettivamente 1,05 e 1,15. Il sovrapprezzo è già incluso nel prezzo mostrato e la rivendita rimane inferiore all’acquisto. Comprare, cambiare schermata, salire di livello o riavviare non rigenera le scorte. Il mercato avvisa quando l’assortimento appartiene a una rotta precedente; il rinnovo lo adegua al livello attuale.

Le tre pozioni garantiscono cura, protezione e antidoto del miglior grado sbloccato. Il cibo usa il grado con la cura maggiore disponibile. Cibo e pozioni curative mostrano anche la cura effettiva e la percentuale della vita massima, considerando potenza pozioni ed effetti giornalieri e limitando l’anteprima alla vita massima.

## Frecce nella lista

Il confronto parte in background, senza richiedere l’hover. Accanto al prezzo compaiono frecce compatte verdi **↑–↑↑↑** per un miglioramento, rosse **↓–↓↓↓** per un peggioramento e **≈** per un risultato equivalente. Durante il calcolo compare **…**; **?** indica un risultato incerto o indisponibile e **—** un oggetto non utilizzabile. Titolo e descrizione accessibile spiegano il simbolo. Il dettaglio mantiene statistiche e prove complete. Per gli anelli viene preferito uno slot vuoto, poi un miglioramento, un risultato equivalente o la sostituzione meno sfavorevole; i pulsanti dei due slot rimangono disponibili.

## Sacca di provviste

La sacca è personale, inizialmente vuota e con rifornimento automatico **disattivato**. Si apre dal mercato o dalla preparazione di Sentieri e spedizioni. Al Rifugio si sceglie una quantità, si vede un preventivo e si conferma il pagamento totale. La UI propone pacchi da 1, 3, 5 o 10 razioni; il motore accetta quantità intere da 1 a 10, entro una capienza totale di **20**. La sacca è separata dall’inventario e non permette rivendita.

Il giocatore può attivare il rifornimento dopo le vittorie scegliendo una soglia di vita del **50%, 70% o 90%**. Alla vittoria vengono consumate al massimo **tre razioni**, fermandosi quando la soglia è raggiunta o superata. Si usano prima le razioni acquistate prima, conservando livello, quantità di cura e prezzo originari: salire di livello non trasforma vecchie razioni in nuove. Potenza pozioni ed effetti giornalieri si applicano alla cura effettiva; il primo pasto allevia gli effetti giornalieri negativi secondo le regole del cibo.

Il resoconto mostra quantità consumata, vita realmente recuperata e scorte rimaste. L’automatico non compra altre razioni. Non si consumano provviste dopo sconfitte, ritirate, in Arena, a vita piena dopo una salita di livello o al custode conclusivo di una spedizione, che ripristina già tutta la vita. Le pozioni durante il turno rimangono manuali. Una razione può essere consumata manualmente fuori dallo scontro, anche fra incontri di una spedizione; acquisti e modifica del piano richiedono il ritorno al Rifugio.

Ogni nuovo scontro salva il piano selezionato. Quelli già iniziati prima dell’aggiornamento non ricevono un consumo automatico retroattivo. Acquisto e consumo usano ricevute UUID e transazioni: ripetere una richiesta identica non spende nuovamente monete o razioni; preventivi scaduti, sacca piena, saldo insufficiente e tentativi su altri eroi vengono rifiutati.

## Confronti, compatibilità e verifiche

Le prove di equipaggiamento usano la stessa funzione di consumo del gioco. Se il piano è attivo, ogni catena simulata parte dalle scorte disponibili, le usa dopo le vittorie normali/élite e include il costo originario delle sole razioni consumate nel recupero e nelle monete nette. I custodi non consumano provviste. Stock, piano e potenza pozioni fanno parte degli input/cache; le prove non modificano le scorte reali. Il dettaglio riporta il consumo medio e spiega l’inclusione del costo.

La migrazione `game_migrations` v10 separa Accessori e Cibo aggiornando soltanto i modelli. La nuova `merchant_migrations` v1 aggiunge metadati delle offerte, piani, lotti e ricevute, ed è registrata nella protezione dei backup. Prezzi, istanze, scorte acquistate, portafoglio e scontri pagati vengono conservati. Gli assortimenti precedenti ricevono le nuove garanzie al successivo rinnovo, senza regali o modifiche agli oggetti già posseduti.

`node --experimental-sqlite scripts/merchant-balance-audit.cjs docs/merchant-balance.json` verifica il generatore effettivo su sei classi ai livelli 1/4/15/45/150/500/900: **1.260 assortimenti e 10.080 pezzi di equipaggiamento**, con controlli su categorie, requisiti, cadenza, affissi e rivendita. Il [report riproducibile](merchant-balance.json) è sintetico e non stima la probabilità di migliorare una build. `npm test` copre anche acquisti idempotenti, rollback, isolamento fra eroi, combattimenti e simulazioni. `npm run test:electron -- --merchant` verifica mercato, sacca, conferma, resoconto e frecce nelle sei lingue e nelle finestre 1280×800 e 1440×900. `npm run test:release` controlla gli scenari economici comuni.

### Analisi storica del problema al livello 900

Il [report iniziale](merchant-design-audit.json), riproducibile con `scripts/merchant-design-audit.cjs`, usa i vecchi pesi generici 71%/23%/5%/0,9%/0,1% e non il nuovo generatore delle carovane. Spiegava perché l’equipaggiamento del mercante fosse trascurabile e mostrava che il miglior cibo conservava utilità su esempi di corredi Unici completi: circa il 18,9% della vita a profondità 900 e il 15,9% a profondità 1100, includendo potenza pozioni. Sono medie su build sintetiche, senza rune, bonus Garmin o ferite. Da questa analisi derivano qualità progressiva, accessori mirati e provviste esplicite per l’automatico, ora implementati.
