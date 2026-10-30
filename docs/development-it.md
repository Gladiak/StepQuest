# StepQuest

Il `workbook di analisi del gioco` (output locale escluso da Git) descrive il futuro RPG fantasy in pixel art: classi, economia dei passi, progressione endless, modello dati e piano implementativo. Contiene parametri modificabili e simulazioni di budget e difficoltà. Il loop base è ora giocabile; le proposte avanzate del workbook restano da validare. Regole attuali: [docs/game-loop.md](game-loop.md).

App desktop Electron per scaricare i passi dal proprio account Garmin Connect tramite richieste HTTPS alle **Garmin Connect Personal API**. Il client usa HTTPS direttamente, senza richiedere un backend Express, Docker o MariaDB.

## Avvio

Richiede Node.js 22.12 o successivo e npm.

```bash
npm ci
npm start
```

In sviluppo si può configurare la propria chiave nel file locale `.env`, escluso da Git e dai pacchetti distribuiti. Il processo principale legge prima la chiave dalla tabella `local_credentials` di `stepquest.sqlite`. Se manca, importa `GARMIN_API_KEY` dall’ambiente (o dal file `.env` in sviluppo) nel database locale. Gli avvii successivi usano la chiave salvata in SQLite, senza accedere al Portachiavi. Nelle impostazioni puoi sostituirla: la nuova chiave viene verificata con Garmin prima di salvare la modifica.

Per una nuova installazione, crea `.env` a partire da `.env.example`, imposta `GARMIN_API_KEY` oppure inserisci la chiave direttamente nelle **Impostazioni** dell’app. La chiave viene salvata **in chiaro nel database SQLite locale**, con accesso al file limitato all’utente (`600`). Il vecchio file `garmin-key.enc` non viene più letto e viene eliminato dopo il salvataggio in SQLite. La migrazione non decifra il vecchio file: usa la chiave già disponibile in `.env`/ambiente oppure quella inserita nelle impostazioni. Il file `.env` di sviluppo rimane un file locale in chiaro con permessi `600`.

## Funzioni attuali

- Benvenuto fantasy senza sidebar, contenuto fisso 1280×800 e finestra non ridimensionabile.
- Nuovo personaggio: nome, sei classi e sesso, con dodici avatar originali in pixel art.
- Continua: tre slot SQLite, con sprite, nome, tempo di gioco, passi e monete.
- Cancellazione mediante teschio e conferma del nome esatto. I passi Garmin non vengono cancellati.
- Impostazioni con lingua dell’interfaccia (italiano, inglese, francese, spagnolo, tedesco e giapponese) e token Garmin Personal API. La lingua si applica e si salva subito su questo computer; il token si verifica e si salva separatamente nel database SQLite locale.
- Avamposto del personaggio selezionato. Il tempo viene salvato ogni 15 secondi e quando si esce dal personaggio.

Passi e monete dei nuovi personaggi iniziano da zero: ogni eroe riceve indipendentemente il massimo giornaliero Garmin, senza ripristinare i passi già spesi dallo stesso eroe. Il portafoglio è attivo e separato dallo storico Garmin. Le tabelle `characters` e `character_migrations` condividono il database con l’archivio passi. Il limite di tre personaggi è verificato transazionalmente. La creazione e selezione funzionano senza rete.

La precedente dashboard passi rimane archiviata nei sorgenti `renderer/dashboard.*`. Nel gioco resta un solo comando «Importa i nuovi passi di oggi da Garmin»: scarica il totale della giornata e aggiunge all’eroe selezionato soltanto l’incremento rispetto al totale già accreditato oggi. Per esempio, dopo un import di 3.000 passi, un totale Garmin di 3.800 aggiunge 800 passi, anche se quelli precedenti sono già stati spesi. Non si importano giorni precedenti. Il comando separato «Riscatta passi» è stato rimosso. Se Garmin non risponde vengono usati solo i dati di oggi già salvati, con un avviso esplicito; ripetere l’importazione senza nuovi passi non duplica valuta. Le API di esportazione rimangono disponibili nel processo principale.

## Archivio SQLite e base del progetto

Il database `stepquest.sqlite` è nella directory dati di StepQuest. Su questo Mac: `~/Library/Application Support/StepQuest/stepquest.sqlite`. Non è incluso in Git o nei pacchetti distribuiti. Usa il modulo `node:sqlite` già incluso in Electron (Node 24), senza dipendenze native aggiuntive. I test con Node 22.12 abilitano `--experimental-sqlite` tramite lo script npm.

Schema v1, migrato automaticamente con `PRAGMA user_version`:

| Tabella | Funzione |
| --- | --- |
| `source_scopes` | Namespace sorgente identificato dalla fingerprint SHA-256 della chiave, senza conservarne il testo |
| `local_credentials` | Chiave Garmin Personal API in chiaro, accessibile solo dal processo principale |
| `app_state` | Scope selezionato, per ritrovare l’archivio anche quando la chiave non è disponibile |
| `daily_steps` | Ultime misure per scope/data, disponibilità, timestamp e revisione |
| `step_revisions` | Storico delle variazioni dei valori, incluse correzioni in diminuzione |
| `sync_runs` | Intervalli richiesti, esito e timestamp dei tentativi; errori registrati soltanto come codice |

Ogni intervallo completato viene salvato in un’unica transazione. Risincronizzare gli stessi valori aggiorna la freschezza ma non duplica i giorni o le revisioni. I blocchi di una richiesta più lunga vengono salvati solo dopo che l’intero download è riuscito. Uno snapshot meno recente non sovrascrive valori più recenti. Le versioni di schema future non riconosciute vengono rifiutate senza cancellare i dati.

Dalla base Garmin v1.2.0, chiavi diverse dello stesso account vengono riconciliate solo dopo la verifica di userProfilePk attraverso i riepiloghi autenticati Garmin. I contatori già accreditati sono conservati; identità diverse restano separate. Se l’identità non è disponibile, una connessione esistente conserva lo scope legacy e i passi continuano a funzionare. Per salvare una nuova chiave dalle Impostazioni serve invece la verifica dell’identità. Gli archivi precedenti rimangono nel database e tornano accessibili usando la rispettiva chiave. Il database contiene misure e chiave Garmin in chiaro, con permessi locali `600`; il bearer token temporaneo resta solo in memoria. I backup del database contengono anche la chiave. Per una copia di backup coerente, chiudi l’app prima di copiare il database; mentre l’app è aperta SQLite può usare anche i file `-wal` e `-shm`.

Il gioco aggiunge migrazioni indipendenti in `game_migrations`: corredi iniziali, inventario, equipaggiamento, attributi, rarità, affissi, set, mercante, scontri, progressione, portafoglio e riscatto idempotente dei passi. I salvataggi Garmin e le credenziali SQLite vengono conservati. Gli acquisti, i consumabili e le ricompense di combattimento sono transazionali. Schema e regole: [docs/game-loop.md](game-loop.md). Catalogo completo: [docs/loot-library.json](loot-library.json).

## API e credenziali

Documentazione ufficiale: [Garmin Personal API Swagger](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/).

Base URL: `https://personal.connectapi.garmin.com`.

1. `POST /personalapitoken-service/personal-api/personal-api-key/token`, senza corpo, con `Authorization: ApiKey <chiave>`; risposta JWT in testo.
2. `GET /usersummary-service/stats/steps/daily/{startDate}/{endDate}` con `Authorization: Bearer <token>`.
3. Il client legge `exp` per riutilizzare il token in memoria e rinnovarlo prima della scadenza. Dopo un `401` richiede un nuovo token e ripete la lettura al massimo una volta. Non usa refresh token OAuth.
4. Ogni richiesta dati copre al massimo 28 giorni; gli intervalli maggiori vengono suddivisi in blocchi sequenziali. Una risposta `429` applica l’attesa `Retry-After`; il client non continua a interrogare Garmin durante l’attesa.

La chiave e il bearer token non vengono restituiti alla UI. Il campo di inserimento della nuova chiave è svuotato dopo il salvataggio o la chiusura del dialogo. Il renderer usa sandbox, isolamento del contesto, CSP restrittiva, protocollo locale dedicato e un bridge IPC con operazioni esplicite per Garmin, personaggi e gioco; il renderer non decide saldi, danni o bottini. Non carica risorse remote. Le risposte di errore non includono i corpi restituiti da Garmin o dettagli delle richieste autenticate.

## Verifica

```bash
npm test                 # Test isolati, senza rete né chiave reale
npm run check:garmin      # Download reale degli ultimi 7 giorni, usa .env
npm run test:electron     # Test UI Electron isolato, senza rete né chiave reale
```

Il test Electron usa un database temporaneo separato. Verifica benvenuto, finestra fissa, creazione, sesso e classe, limite di tre slot, conferma esatta del nome per cancellare, tempo di gioco, impostazioni e isolamento del renderer. Le schermate di controllo sono in `artifacts/welcome.png`, `artifacts/create-character.png` e `artifacts/select-character.png`. I test unitari coprono anche archivio passi, fallback offline, generazione e range degli oggetti, set, acquisti, riscatto, livelli e ricompense una sola volta. `check:garmin` verifica la connessione reale e consuma richieste API.

## Pacchetto desktop

```bash
npm run pack             # App per la piattaforma corrente in dist/
npm run dist             # ZIP macOS / installer Windows / AppImage Linux
```

Su macOS Apple Silicon, `npm run pack` produce `dist/mac-arm64/StepQuest.app`. La build locale non è firmata con un certificato Developer ID e non è notarizzata. Per distribuzione pubblica occorrono firma e notarizzazione. I pacchetti includono soltanto Electron, `electron/`, `lib/`, `renderer/` e i metadati; `.env` non viene incorporato. Sullo stesso computer usano la chiave già salvata nell’archivio dati di StepQuest; su un altro computer va inserita dalle impostazioni.

## Struttura

```text
electron/   Processo principale, credenziali, IPC e preload
lib/        Client HTTPS Garmin, repository SQLite, servizio offline, date e CSV
renderer/   Interfaccia in sei lingue, scene, inventario e diario
scripts/    Verifica API reale e smoke test Electron
test/       Test di autenticazione, errori, dati e intervalli
```

## Direzione artistica dell’interfaccia

Titoli in Cinzel Decorative, comandi e intestazioni in Cinzel, testi in IM Fell English. I font sono inclusi localmente con le licenze SIL OFL nella cartella `renderer/assets/fonts/`. Pannelli in pergamena, cornici metalliche ornamentali a nove sezioni, pulsanti color cuoio e sigilli vettoriali sono definiti in `renderer/styles.css` e `renderer/assets/ui/`. Il test Electron verifica anche il caricamento dei tre font e acquisisce le schermate di dialoghi e avamposto.

## Schermate di gioco

Selezionare un personaggio apre sempre **Casa**. La barra inferiore collega tre ambientazioni statiche:

- **Casa**: arma base e vestiti iniziali, inventario persistente, equipaggiamento, attributi e set, riposo e importazione dei nuovi passi della giornata da Garmin.
- **Mercato**: 12 offerte casuali persistenti per eroe, acquisto, vendita, cambio passi/monete e rinnovo delle scorte a pagamento.
- **Fuori dalle mura**: scontri a turni, difficoltà crescente, attacco, difesa, pozioni e ritirata. La vittoria assegna XP, monete e possibile bottino casuale, salvato nel database. Le élite garantiscono un oggetto.

Il loop è effettivo: monete e passi vengono spesi, oggetti e consumabili vengono trasferiti o consumati, HP ed esperienza vengono salvati a ogni turno. Le regole economiche correnti sono 25 passi per scontro e cambio di 50 passi in 20 monete; sono registrate in `game_rules`. L’interfaccia supporta sei lingue. Non ci sono mappa o animazioni. Il bilanciamento è iniziale e va affinato giocando.

La libreria contiene 345 modelli, 24 attributi, 144 affissi e 18 set di classe. I comuni hanno zero caratteristiche aggiuntive; non comuni 1–2, rari 1–3, mitici 2–4 e leggendari 3–6. Rarità e caratteristiche adottano la legenda grigio, azzurro, giallo scuro, arancione e viola. Ogni istanza conserva i propri roll e range: riaprire il gioco non li cambia.

I quattro fondali originali sono inclusi in `renderer/assets/scene-home.png`, `scene-market.png`, `scene-wilds.png` e `scene-alchemy.png`, generati con ImageGen. I prompt sono documentati in `renderer/assets/scene-prompts.json`. L’interfaccia è in `renderer/game.js` e `renderer/game.css`.

Il nome del personaggio compare soltanto nel riquadro superiore, non sotto lo sprite sul fondale. L’ombra a terra viene posizionata usando il limite inferiore dei pixel opachi di ciascun avatar, così rimane vicina ai piedi anche quando le immagini hanno margini trasparenti diversi.

## Sprite dell’equipaggiamento

Sedici sprite trasparenti in pixel art da 32×32 sono integrati negli slot di Casa e Mercato. Il catalogo contiene armi e armature delle sei classi, accessori, cibo e pozioni. Le cinque rarità condividono la stessa icona; il tooltip mostra caratteristiche e differenze rispetto allo slot equipaggiato. Funziona con hover e focus da tastiera, si chiude con Escape e rimane entro la finestra. Statistiche ed effetti sono applicati dal motore del gioco, con bilanciamento iniziale. Asset e prompt: [renderer/assets/items/README.md](../renderer/assets/items/README.md).

## Colori e leggibilità

Le superfici definiscono una palette tramite le variabili `--surface-*`: testi scuri sulla pergamena e chiari su pannelli scuri. Dettagli degli oggetti e tooltip condividono gli stessi componenti e adottano la palette del contenitore, incluse rarità, bonus e penalità. I titoli sopra le scene e i tooltip hanno sfondi opachi; i pulsanti disabilitati mantengono il testo leggibile.

Il test Electron misura il contrasto su sfondi renderizzati, comprese texture e gradienti, con soglia 4,5:1 per tutti i testi controllati. Copre le cinque rarità, tooltip, dialoghi scorrevoli, set, acquisto, battaglia, impostazioni, creazione e cancellazione. Il rapporto è in `artifacts/contrast-report.json`; le schermate sono in `artifacts/item-dialog-*.png`.

## Ingombri dei testi

Gli slot separano icona, etichetta e nome con righe e spaziature esplicite. I nomi lunghi usano l’ellissi negli elenchi e restano completi nel tooltip o nel dettaglio. I dialoghi mantengono titolo e comandi visibili e fanno scorrere il corpo; il margine destro protegge i valori dalle scrollbar sovrapposte di macOS. Le schede personaggio riservano due righe al nome.

Il test Electron controlla i rettangoli del testo dentro i pulsanti, la separazione delle righe negli slot e gli ingombri dei pannelli rispetto alla barra inferiore. Verifica anche nomi lunghi nelle schede, nell’equipaggiamento, al mercato e nei dialoghi. Il rapporto geometrico è in `artifacts/layout-report.json`; le schermate di controllo sono in `artifacts/layout-long-*.png`.

## Confronto, cambio e combattimento rapido

L’inventario indica gli aggiornamenti stimati con una, due o tre frecce verdi. Tooltip e dettaglio confrontano gli attributi effettivi prima/dopo, includendo percentuali, malus, limiti e bonus di set. La rarità rimane indipendente dalla stima di potenza.

Il cambio passi/monete usa uno slider con anteprima e selezione minimo/massimo, poi converte il lotto scelto in una singola operazione. Sui sentieri la modalità automatica consente di avviare e risolvere uno scontro con un comando; resta disponibile la modalità manuale e il pulsante Auto per terminarla. Non vengono consumate pozioni automaticamente.

Melma, lupo e predone hanno [sprite originali e prompt](../renderer/assets/monsters/README.md), mostrati nella galleria e sul fondale durante lo scontro. Le [regole del confronto e dell’automatico](game-loop.md) descrivono stima, soglie e limiti. I test coprono conversioni multiple, confronto reale dopo l’equipaggiamento, soglie dei set, esiti automatici e retry senza doppi costi o premi.


## Due anelli, amuleto e barra compatta

È possibile indossare due anelli e un amuleto contemporaneamente. Il dettaglio di un anello confronta separatamente i due slot e permette di scegliere quale sostituire. Gli accessori dei salvataggi precedenti vengono migrati alla posizione corretta senza rigenerare le istanze. La libreria include anche 18 anelli di set, per un totale corrente di 405 modelli.

Attributi e set si aprono dall’icona accanto al titolo Equipaggiamento. La barra inferiore è alta 64 pixel, si adatta alla larghezza delle icone e usa descrizioni all’hover/focus. Non contiene indicatori vita/esperienza né vuoti tra i gruppi. Il libro apre il taccuino e la legenda. Dettagli su migrazione, confronti e conteggio dei set in [docs/game-loop.md](game-loop.md).


## Flussi rapidi

La barra usa icone native 32×32 più dettagliate e ha un’altezza di 64 pixel. Zaino, riposo e cambio sono accessibili in ogni ambientazione; lo zaino si apre sopra la scena e permette di gestire l’equipaggiamento senza tornare a Casa. Il mercato offre «Compra e indossa» in una transazione, oppure conversione passi con ritorno allo stesso articolo. Dopo una vittoria compare «Combatti ancora». I comandi non disponibili hanno descrizioni contestuali; pagina dello zaino, categoria e difficoltà restano nella sessione.

## Spedizioni e scelte

I sentieri si aprono sullo scontro singolo; la scheda Spedizioni offre quattro tappe: bivio, campo o benedizione, evento narrativo variabile e custode finale. Tre itinerari hanno costi e rischi diversi. Si può proseguire per il premio finale oppure rientrare con la sacca; la cura completa premia il completamento del viaggio. Cibo, pozioni e bonus temporanei aiutano a completare il viaggio. Piano e stato sono salvati in SQLite e riprendono alla riapertura. Lo scontro singolo resta disponibile nella scheda accanto.

Regole, premi e limiti della prima versione in [docs/game-loop.md](game-loop.md). La simulazione offline di bilanciamento si esegue con `node --experimental-sqlite scripts/expedition-balance.cjs` e salva `artifacts/expedition-balance.json` (output locale escluso da Git).

## Comandi, recupero e bilanciamento

Ogni azione ha un punto principale: cambio monete nella barra, avvio scontro nel pannello della sfida, zaino nella griglia di Casa o nel popup sulle altre scene. Una battaglia aperta si riprende direttamente nei Sentieri. Lo zaino permette di vendere in blocco i pezzi chiaramente inferiori, con anteprima, conservando consumabili, pezzi di set e oggetti utili a una build alternativa.

Il sentiero sicuro è un allenamento senza avanzamento; scontri normali ed élite fanno progredire. Prima di spendere passi si vedono profondità e probabilità di bottino: 65%/85%/100% prima dei bonus. Le élite garantiscono equipaggiamento almeno non comune. Il riposo completo costa in base alla vita mancante; il cibo è più economico e resta utile in spedizione. A vita molto bassa e senza fondi è previsto un recupero d’emergenza gratuito al 35%. Rientrare subito da una spedizione non cura gratuitamente.

I mitici hanno arancione più saturo, distinto dall’oro dei rari; i salvataggi esistenti ricevono la palette con migrazione v5. Regole, distribuzioni e simulazioni: [game-loop.md](game-loop.md).

## Economia più accessibile

Gli scontri costano 25 passi; Bosco, Rovine e Passo delle ceneri costano rispettivamente 50, 75 e 100 passi per tutte le quattro tappe. Il cambio minimo è 50 passi per 20 monete: 100 passi producono 40 monete. Rispetto alle tariffe precedenti gli ingressi costano un terzo e il cambio rende quattro volte tanto. La migrazione v6 aggiorna le regole dei salvataggi esistenti senza modificare saldi, acquisti, premi o addebiti passati. Gli scontri e i viaggi già pagati riprendono senza un nuovo addebito.

Il rinnovo del mercato è più economico: `10 + 3 × livello` monete (13 al livello 1, prima 40). La migrazione v7 aggiorna anche i salvataggi esistenti senza rigenerare le scorte o modificare i saldi.

## Bonus giornalieri Garmin

«Importa i nuovi passi di oggi» aggiorna anche le metriche della giornata. Nel taccuino (icona libro) si vedono dati disponibili, ultimo aggiornamento, bonus e malus. Vigore dà fino al 15% di XP aggiuntivi; il sonno confermato modifica l'efficacia di cibo e pozioni curative (+10% o −3%); lo stress del giorno precedente può ridurre l'attacco fisico del 2%. Cibo e riposo rimuovono i malus per oggi. Gli effetti si fissano all'inizio dello scontro e non si accumulano reimportando. Dati assenti o insufficienti restano neutri. Regole complete in [game-loop.md](game-loop.md).

## Collezioni uniche endgame

Cinque set per classe (30 totali), con due nuove collezioni Uniche verdi a livello/profondità 30/60 e 45/100. Drop complessivo 0,1% da élite/custodi idonei, nessun acquisto al mercato. I bonus alle soglie 2/3/4/5 si sommano e danno un forte salto di potenza; ogni pezzo indica la classe. Nuovi equipaggiamenti scalati alla profondità con moltiplicatore fino a ×3, fissato al ritrovamento; quelli già posseduti mantengono i propri valori. Regole e probabilità in [game-loop.md](game-loop.md).

## Crescita e premi v9

La crescita dei nemici attenua il divario fra profondità e livello senza dipendere dagli oggetti indossati. Le élite restano impegnative ma con cariche meno esplosive; danno due oggetti, almeno rari dal livello 4. I nuovi drop hanno un primo affisso orientato al combattimento. Dopo due vittorie senza bottino, la terza lo garantisce. Élite e spedizioni non fanno più correre la profondità di due passi alla volta. Unici endgame ancora allo 0,1% complessivo per vittoria idonea, senza raddoppio grazie al secondo oggetto. Valori già ottenuti e scontri aperti restano conservati.

## Lingue e icona

La lingua comprende anche i menu nativi, si sceglie nelle Impostazioni e si conserva nel profilo locale dell’app (`stepquest.language` in localStorage), indipendentemente dall’eroe e dal token Garmin. Cambiarla non richiede rete e non modifica i salvataggi. Il giapponese usa font di sistema con glifi giapponesi. Le traduzioni coprono menu, suggerimenti accessibili, statistiche, catalogo, eventi e dialoghi; i nomi scelti dal giocatore restano invariati.

Il catalogo è in `renderer/locales.js`, con l’italiano come chiave e cinque traduzioni per riga. I parametri numerici mantengono i valori originali e il backend continua a usare gli stessi ID e salvataggi. Il test grafico `scripts/locale-audit.cjs` controlla ingombri e contrasto in tutte le lingue, oltre alla persistenza dopo il reload. I nomi lunghi degli oggetti nelle anteprime mantengono l’ellissi e si leggono interamente nei dettagli; i pannelli narrativi scorrono quando necessario.

L’icona fantasy in pixel art è `build/stepquest-icon.png` (1024×1024), generata con lo strumento imagegen integrato. Il prompt è conservato in `build/stepquest-icon.prompt.txt`; la copia runtime è `renderer/assets/app-icon.png`. Il pacchetto usa questa icona su macOS, Windows e Linux.

Il **Laboratorio alchemico** è disponibile nella barra delle ambientazioni (icona della fiasca). Offre cinque ricette, undici reagenti rari e tre proposte per preparazione. Confermarne una aggiunge 2–3 effetti permanenti al singolo pezzo, evidenziati in turchese, e impedisce ulteriori incantamenti. Le regole, i drop e i costi sono descritti in [docs/game-loop.md](game-loop.md#laboratorio-alchemico).

Il laboratorio dispone di uno sfondo in pixel art dedicato (`renderer/assets/scene-alchemy.png`, prompt in `scene-alchemy.prompt.txt`). Ingredienti e intervalli degli effetti sono affiancati; gli esiti mostrano gli effetti in colonne e le percentuali di drop sono raccolte in una tabella. I pannelli adattano l’altezza al contenuto. Il controllo grafico verifica l’assenza di scrolling nelle sei lingue anche con tre effetti per proposta. Per il controllo mirato: `npm run test:electron -- --alchemy-layout`.

Nel comando **Vendita in blocco** dello zaino è disponibile **Vendi per rarità**, con checkbox per selezionare più rarità insieme, anteprima e ricavo. Esclude sempre equipaggiati, incantati e preparazioni in sospeso; cibo e pozioni richiedono l’opzione esplicita. Il Laboratorio alchemico propone nella select solo gli oggetti attualmente equipaggiati e non incantati.

Nella stessa gestione inventario, **Filtro bottino** apre un popup per scegliere le rarità da conservare, con una soglia rapida e selezione personalizzata. È disattivato inizialmente e si salva per eroe. Le altre rarità dei nuovi drop (anche consumabili) vengono vendute automaticamente dopo la vittoria al normale prezzo di vendita, con ricavo nel resoconto. Il filtro vale anche per pattuglie, custodi e premio finale delle spedizioni. Zaino attuale e reagenti restano invariati. Il rinnovo del mercato è immediato con un solo clic sul pulsante che espone il costo.

## Release v1.1.0

Miniera automatica, Fabbro e Arena PvE sono descritti nelle [regole aggiornate](game-loop.md#stabilizzazione-v110). I preventivi sono autorevoli nel backend; i salvataggi vengono copiati prima delle migrazioni e possono essere ripristinati dal dialogo di recupero. `npm run test:release` aggiorna la simulazione corrente in `artifacts/release-audit.json`; il riferimento versionato è [release-economy-v1.1.0.json](release-economy-v1.1.0.json). La verifica del pacchetto reale usa `node scripts/verify-runtime.cjs` dopo la build. La pipeline esegue questa verifica su ciascuna piattaforma, oltre al collaudo grafico completo su macOS ARM64.

## Release v1.2.0: Gilda, Atlante e Cronache

Il workflow installa le dipendenze con `npm ci` e disattiva esplicitamente la cache npm di GitHub Actions (`package-manager-cache: false`), evitando il ripristino e il salvataggio sul servizio cache soggetto ai limiti di traffico dell’account. Questa impostazione riguarda solo la CI e non modifica i binari della release.

La Gilda, le regole di sincronizzazione e il rinnovo delle chiavi sono descritti in [game-loop.md](game-loop.md#base-garmin-e-gilda-degli-esploratori-v120). Il collaudo mirato si esegue con `npx --no-install electron . --smoke-test --guild`; il collaudo completo include anche questi scenari. `test/guild.test.cjs` verifica progressi, scelte, vincoli settimanali e titoli; `test/garmin-foundation.test.cjs` copre riconciliazione account, contatori e archivio; i casi HTTP rimangono in `test/garmin.test.cjs`.

L’[Atlante del viandante](game-loop.md#atlante-del-viandante-v120) usa `lib/atlas-catalog.cjs` per nodi, collegamenti e varianti; `lib/atlas.cjs` conserva soltanto visite, scelte degli incontri, fotografie delle partenze e traguardi. Il progresso dei capitoli proviene dalle missioni Gilda esistenti. `renderer/atlas.js` compone mappa e dettagli; `renderer/atlas-locales.js` contiene le traduzioni. Mappa, fondale e Custode con prompt completi sono documentati in `renderer/assets/atlas-prompts.json`.

`npx --no-install electron . --smoke-test --atlas` esegue il controllo mirato: luoghi bloccati, collegamento agli incarichi, scelte, varianti, ripresa del viaggio, vittoria, titolo e sei lingue. Il collaudo completo include anche l’Atlante. `test/atlas.test.cjs` copre costo unico, replay, fotografie immutabili, isolamento eroi, annullamento transazionale ed esiti della spedizione. `node --experimental-sqlite scripts/expedition-balance.cjs` include il Faro con un capitolo sintetico già concluso; `node scripts/verify-runtime.cjs` verifica la funzionalità e i tre nuovi asset anche nel pacchetto compilato.

Le Cronache usano `lib/chronicle-catalog.cjs` per le 21 imprese e le cinque soste e `lib/chronicles.cjs` per progressi e assegnazioni. Il renderer è `renderer/chronicles.js`; traduzioni e prompt sono in `renderer/chronicle-locales.js` e `renderer/assets/chronicles-prompts.json`. Il collaudo mirato è `npx --no-install electron . --smoke-test --chronicles` ed è incluso nella suite completa. Controlla le 24 celle illustrate, collezione, progressi, itinerario, sigilli, varianti, profilo e sei lingue con dati sintetici. `test/chronicles.test.cjs` verifica baseline, deduplicazione, transazioni, isolamento, riconoscimento retroattivo e permanenza delle pagine; `test/game-steps.test.cjs` verifica le attività senza incarichi e senza importare passi storici.

Il [changelog](../CHANGELOG.md) riassume le versioni pubblicate; le [note v1.2.0](release-notes-v1.2.0.md) descrivono compatibilità e pacchetti. La regressione economica corrente è [release-economy-v1.2.0.json](release-economy-v1.2.0.json). I controlli prepubblicazione sono raccolti in [release-checks-v1.2.0.json](release-checks-v1.2.0.json); i report della pipeline GitHub completano la verifica delle altre piattaforme. I medaglioni usano contorni SVG generati da `scripts/generate-chronicle-clips.py`, senza modificare il PNG originale: `test/chronicle-art.test.cjs` verifica tutte le 24 sagome ed esclude i pixel opachi dei badge vicini.
