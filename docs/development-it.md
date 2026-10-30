# Sviluppare StepQuest

StepQuest è un RPG desktop Electron che trasforma i passi Garmin in risorse di gioco. Il processo principale gestisce rete, SQLite e regole; il renderer costruisce l’interfaccia senza accesso diretto al database o a Node.js.

Queste note descrivono l’architettura corrente. Le [regole del gioco](game-loop.md), il [catalogo oggetti](loot-library.json) e il [changelog](../CHANGELOG.md) raccolgono rispettivamente comportamento, dati e cronologia delle versioni. Il workbook in `docs/workbook/` contiene simulazioni e proposte di bilanciamento, non una seconda implementazione delle regole.

## Avvio e verifiche

Servono Node.js 22.12 o successivo e npm.

```bash
npm ci
npm start
npm test
npm run test:electron
npm run test:release
npm run pack
```

`npm test` esegue test unitari e d’integrazione offline con SQLite temporanei. `test:electron` usa un profilo separato, controlla i flussi di gioco, il contrasto, gli ingombri e le sei lingue, e scrive screenshot e rapporti in `artifacts/`. `test:release` verifica scenari economici deterministici e inventari grandi. Il packaging esegue `scripts/verify-package.cjs`; `scripts/verify-runtime.cjs` verifica successivamente il runtime distribuito.

I controlli UI mirati si avviano con `npm run test:electron -- --atlas`, `--chronicles`, `--guild`, `--settlement`, `--comparisons` o `--reforging`. Usano lo stesso harness in `scripts/smoke-harness.cjs`, mantenendo gli scenari nei rispettivi file `*-audit.cjs`. Lo scenario di riforgiatura verifica griglia, filtri, paginazione, popup, preventivo e adeguamento di livello nelle sei lingue.

Per misurare preparazione dei dati, worker e cache su inventari sintetici da oltre 2.000 oggetti: `node --experimental-sqlite scripts/comparison-performance.cjs`. Il rapporto locale è in `artifacts/comparison-performance.json`; i tempi dipendono dalla macchina. Le prove del confronto non accedono ai salvataggi personali.

`npm run check:garmin` è un controllo facoltativo online: usa la chiave personale e invia richieste reali. I test ordinari non ne hanno bisogno.

## Struttura e responsabilità

| Area | Responsabilità |
| --- | --- |
| `electron/main.cjs` | Avvio, protocollo locale, sessione del personaggio e handler IPC |
| `electron/preload.cjs` | Bridge esplicito delle operazioni disponibili alla UI |
| `lib/garmin.cjs`, `lib/steps-service.cjs` | Client Garmin, sincronizzazione e fallback offline |
| `lib/steps-repository.cjs`, `lib/garmin-foundation.cjs` | Storico passi, identità account e attività |
| `lib/game-steps-service.cjs` | Importazione di oggi e accredito all’eroe selezionato |
| `lib/game-repository.cjs` | Transazioni, composizione dei moduli e snapshot del gioco |
| `lib/game-schema.cjs`, `lib/game-catalog.cjs` | Migrazioni, inizializzazione e catalogo di base |
| `lib/hero-progression.cjs` | Soglie XP e avanzamento di livello condivisi da arena e avventure |
| `lib/item-economy.cjs`, `lib/validation.cjs` | Valore dell’equipaggiamento, prezzi di vendita e validazione UUID condivisi |
| `lib/comparison-simulation.cjs`, `lib/comparison-worker.cjs`, `lib/comparison-service.cjs` | Prove di equipaggiamento, worker persistente e cache limitate |
| `lib/combat-turn.cjs`, `lib/combat-balance.cjs` | Turno comune, difficoltà e regole di combattimento |
| Altri moduli `lib/` | Spedizioni, alchimia, professioni, Gilda, Atlante e Cronache |
| `renderer/app.js` | Menu, personaggi e impostazioni |
| `renderer/game.js` | Stato della sessione UI, navigazione e schermate di gioco |
| `renderer/comparisons.js` | Priorità dei confronti, risultati asincroni e aggiornamenti parziali della UI |
| `renderer/inventory-sales.js` | Vendite in blocco, anteprime e impostazioni del filtro bottino |
| `renderer/item-details.js` | Dettagli, confronti, set, incantamenti e rifinitura degli oggetti |
| `renderer/reforging.js` | Griglia di selezione, popup condivisi e conferma del preventivo di riforgiatura |
| `renderer/atlas.js`, `renderer/chronicles.js` | Componenti delle rispettive schermate |
| `renderer/*locales.js`, `renderer/i18n.js` | Cataloghi e applicazione delle traduzioni |
| `scripts/`, `test/` | Audit, preparazione degli asset e verifiche automatiche |

La vecchia dashboard passi e i suoi endpoint IPC di intervallo/esportazione sono stati rimossi. Lo storico usato da Garmin e dal gioco rimane nei repository; `lib/csv.cjs` conserva il formatter CSV, verificato dai test.

## Confini da mantenere nelle nuove funzionalità

- Le modifiche a saldi, equipaggiamento, ricompense e progressi passano dalle transazioni del repository. Il renderer invia intenzioni, non risultati di gioco.
- Un modulo con nuove tabelle possiede le proprie migrazioni; le versioni future sconosciute devono essere rifiutate. Il repository chiude la connessione se la sua inizializzazione fallisce.
- Le formule condivise si modificano nel modulo che le possiede. XP e prezzi di vendita non devono essere ricalcolati separatamente nei consumatori.
- Le richieste ripetibili devono conservare idempotenza, controllo del proprietario e verifica della versione quando necessaria. I flussi esistenti hanno ricevute diverse: condividerne la validazione non sostituisce i rispettivi controlli.
- I dettagli degli oggetti sono gli stessi per tooltip, inventario, mercato e premi. I componenti leggono lo snapshot aggiornato tramite `getGame`.
- I nuovi script del renderer devono essere caricati da `index.html` e registrati nell’elenco delle risorse del protocollo in `electron/main.cjs`.
- Prima di aggiungere nuovi stili, aggiornare le regole del componente esistente. Consolidare i CSS mantenendo ordine della cascata, specificità e varianti per lingua; verificare con gli audit visivi.

## Credenziali e sincronizzazione Garmin

La chiave si inserisce nelle Impostazioni. In sviluppo è possibile usare `GARMIN_API_KEY` nell’ambiente o in `.env`, escluso da Git e dai pacchetti. Il processo principale legge prima `local_credentials` in SQLite; se manca una chiave salvata, importa quella di sviluppo. Il bearer token temporaneo rimane in memoria.

La chiave è salvata **in chiaro nel database locale** e viene inclusa nei suoi backup. Dove supportato, i permessi del file sono limitati all’utente (`600`). Il precedente file `garmin-key.enc` non viene decifrato e viene eliminato dopo il salvataggio della chiave in SQLite.

La sostituzione di una chiave richiede la verifica dell’identità Garmin. Chiavi diverse dello stesso account vengono riconciliate conservando i contatori già accreditati; identità diverse mantengono scope separati. La UI non riceve chiavi o bearer token nelle risposte.

L’importazione del gioco usa solo la giornata corrente. Ogni eroe riceve indipendentemente il massimo giornaliero; gli import successivi aggiungono soltanto l’incremento non ancora accreditato a quell’eroe. Spendere passi, ripetere l’importazione o ricevere una correzione in diminuzione non ripristina valuta. Se Garmin non risponde, il gioco usa soltanto la cache di oggi e segnala il fallback.

Lo storico dei giorni precedenti serve alle attività della Gilda e non viene trasformato in valuta dall’importazione corrente. Le metriche di benessere e le attività sono opzionali; dati indisponibili mantengono effetti neutri o progressi basati sui passi secondo le regole del relativo modulo.

## Salvataggi e compatibilità

Il file `stepquest.sqlite` risiede nella directory dati di Electron, su macOS normalmente `~/Library/Application Support/StepQuest/`. Non viene incluso nel repository o nella distribuzione.

L’app usa `node:sqlite` e WAL. Per un backup manuale chiudere l’app: mentre è aperta, parte dei dati può trovarsi nei file `-wal` e `-shm`. Il sistema di protezione integrato verifica i backup prima delle migrazioni e permette il recupero in caso di errore all’avvio.

Le migrazioni devono conservare gli oggetti già generati e gli stati pagati di scontri e spedizioni. I test con fixture delle versioni precedenti, in `test/release-migration.test.cjs` e `test/guild-migration.test.cjs`, verificano la compatibilità insieme ai test dei singoli moduli.

## Interfaccia e asset

La finestra è fissa a 1280×800, con contenitori scorrevoli per i contenuti lunghi. L’interfaccia supporta italiano, inglese, francese, spagnolo, tedesco e giapponese. Nomi e dati inseriti dall’utente devono rimanere verbatim nelle traduzioni.

I font locali sono Cinzel Decorative, Cinzel e IM Fell English; le licenze si trovano in `renderer/assets/fonts/`. La palette usa variabili `--surface-*` per adattare testo, rarità e confronti alle superfici. I tooltip funzionano con mouse e tastiera; i dialoghi mantengono titolo e azioni visibili.

I cataloghi correnti contengono 405 modelli, 30 set e 6 rarità. Le definizioni eseguibili sono in `lib/game-catalog.cjs`; evitare di duplicarne i conteggi nei componenti UI. Prompt e note degli asset sono nelle rispettive cartelle sotto `renderer/assets/`.

## Distribuzione

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Eseguire ogni comando sul sistema operativo corrispondente. Il workflow di release costruisce e verifica i pacchetti sui runner nativi. I pacchetti includono Electron, `electron/`, `lib/`, `renderer/` e i metadati, senza profili personali, `.env` o database.

Le build macOS sono firmate ad hoc e non notarizzate; la firma Windows non è configurata. Per i dettagli dei download e dell’installazione consultare il [README](../README.md).
