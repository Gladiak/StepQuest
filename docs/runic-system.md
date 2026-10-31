# Incisioni runiche e sfide degli Echi

La Fucina ospita la scheda **Incisioni**. Ogni eroe può attivare una parola sull’arma e una sull’armatura; le altre rimangono sui rispettivi pezzi nello zaino. Tutte le sei classi usano lo stesso catalogo. Il sistema non richiede azioni rapide durante il combattimento automatico: la preparazione avviene al Rifugio e i risultati sono espliciti nel resoconto.

## Rune e progressione

Dal livello 15, **Ricevi le prime rune** assegna una volta per eroe Sol, Tor, Lum e Or, più 16 frammenti. Aprire un vecchio salvataggio non assegna premi della Gilda retroattivi. Rune e frammenti sono personali.

| Runa | Bonus indossandola in una parola | Frammenti per crearla | Livello |
| --- | --- | ---: | ---: |
| Sol | Attacco +2% | 4 | 15 |
| Tor | Difesa +2% | 4 | 15 |
| Lum | Vita +2% | 4 | 15 |
| Or | Precisione +1 punto percentuale | 4 | 15 |
| Vel | Critico +1 punto percentuale | 8 | 15 |
| Ka | Danno arcano +3 | 8 | 15 |
| Ash | Vita +12 | 8 | 15 |
| Ith | Rigenerazione +1 | 8 | 15 |
| Naer | Attacco +3 | 16 | 30 |
| Vael | Schivata +1 punto percentuale | 16 | 30 |
| Esh | Parata +1 punto percentuale | 16 | 30 |
| Thal | Riduzione danni +1 punto percentuale | 16 | 30 |

I bonus sono applicati una volta per runa indossata, rispettano i limiti degli attributi e non vengono moltiplicati da profondità o rifinitura. Restano separati dagli incantamenti e dai bonus di set.

Dal livello 15, una vittoria élite assegna un frammento e un custode di spedizione tre. La probabilità di trovare anche una runa è 3% nei normali, 10% nelle élite e 20% nei custodi; vengono estratte solo rune del livello disponibile. Il Sentiero sicuro non assegna risorse runiche. Gli Echi aggiungono rispettivamente due o quattro frammenti per vittoria.

## Le sedici parole

Una carica conta un’azione d’attacco con almeno un colpo a segno: il colpo rapido non conta come una seconda azione. Gli effetti non generano ricorsivamente altri attacchi runici.

| Arma | Sequenza | Livello | Effetto |
| --- | --- | ---: | --- |
| Brace | Sol · Tor | 15 | Ogni terzo attacco riuscito: +25% danni. |
| Frattura | Ka · Tor | 15 | Ogni terzo attacco riuscito ignora il 35% della difesa. |
| Rappresaglia | Tor · Or | 15 | L’attacco dopo una difesa infligge +35% danni. |
| Caccia alle ombre | Vel · Ka | 15 | +25% danni nelle aperture dopo le cariche. |
| Giudizio | Ash · Ka · Esh | 30 | +20% danni contro nemici sotto il 35% di vita. |
| Stella infranta | Naer · Lum · Ka | 30 | Il primo attacco riuscito ignora il 50% della difesa. |
| Patto cremisi | Vel · Ash · Ith | 30 | Un critico cura il 3% della vita massima; recupero tre turni. |
| Cuore indomito | Naer · Or · Thal | 30 | +18% danni sotto metà vita. |

| Armatura | Sequenza | Livello | Effetto |
| --- | --- | ---: | --- |
| Veglia | Tor · Sol | 15 | Difendere crea una barriera del 6% della vita per quel turno. |
| Ultimo Faro | Lum · Or | 15 | Una volta per scontro, sopravvivere sotto il 30% di vita prepara una barriera del 12% per il turno seguente. |
| Respiro della quercia | Ith · Lum | 15 | Ogni terzo attacco riuscito cura il 2,5% della vita massima. |
| Specchio del custode | Esh · Tor | 30 | Una parata riflette il 25% dell’attacco, una volta per turno. |
| Manto del crepuscolo | Vael · Vel · Tor | 30 | Riduce del 15% il danno dei colpi potenti; protezione totale temporanea massima 80%. |
| Sigillo puro | Thal · Lum · Ith | 30 | Difendere rimuove veleno e ferite; recupero tre turni. |
| Egida delle stelle | Esh · Naer · Lum | 30 | Dopo tre turni con danni subiti prepara una barriera del 6% per il turno seguente. |
| Promessa del ritorno | Ith · Or · Vael | 30 | Difendere cura il 3% della vita massima; recupero tre turni. |

Le barriere inutilizzate scadono dopo il turno protetto. Le cure contano solo vita effettivamente recuperata e non fanno risorgere l’eroe. Danni riflessi e bonus d’attacco rispettano il sigillo a metà vita del Custode del Faro.

## Incidere, estrarre e conservare

La scheda mostra esclusivamente l’arma e il corpo attualmente indossati. Si possono incidere o estrarre rune soltanto da questi due pezzi, compatibili con classe e livello, fuori da scontri, Arena e spedizioni. Un pezzo nello zaino va prima equipaggiato. Una preparazione alchemica in sospeso deve essere conclusa. Le ricette sono visibili prima dello sblocco; nessuna digitazione libera può distruggere rune per errore.

- Incisione: `100 + 6 × livello del pezzo` monete, più le rune indicate.
- Estrazione: `30 + livello del pezzo` monete; restituisce **tutte** le rune.
- Per cambiare parola si estrae prima quella presente. Identità, set, profondità originale, rifiniture e incantamenti rimangono sul pezzo, anche dopo una riforgiatura.
- Un preventivo viene verificato nuovamente alla conferma. Rune, monete e ricevuta sono aggiornate nella stessa transazione; un retry non paga due volte.
- I pezzi incisi sono esclusi dalla vendita in blocco. Per venderli singolarmente occorre prima recuperare le rune.

## Automazione leggibile

**Strategia ed Echi**, nei Sentieri e nell’Arena, salva le preferenze personali al Rifugio:

- **Auto Aggressivo**, predefinito anche per i vecchi salvataggi, continua ad attaccare.
- **Auto Prudente** difende dai colpi potenti annunciati. Se Sigillo puro è pronto e l’eroe è avvelenato o ferito sotto l’85% di vita, può difendere per purificarsi.
- Le pozioni richiedono sempre una scelta esplicita.

Rappresaglia, Veglia, Sigillo puro e Promessa del ritorno dichiarano che richiedono una difesa. Con Auto Aggressivo viene mostrato un avviso; rimangono utilizzabili con difesa manuale. Il resoconto distingue una condizione mai verificata da uno scontro terminato prima di tre attacchi riusciti.

Le parole e il profilo vengono fotografati all’inizio dello scontro e sopravvivono alla riapertura. Il resoconto mostra decisioni automatiche, attivazioni, danni aggiuntivi effettivi, assorbimento, cure, purificazioni e risorse ottenute. I danni aggiuntivi misurano gli effetti attivi dopo i limiti di vita e fase; i piccoli bonus delle singole rune compaiono negli attributi. I confronti degli oggetti usano lo stesso motore, le parole realmente indossate, il profilo e il grado degli Echi selezionato.

## Gli Echi

Sono facoltativi e hanno statistiche fisse derivate dall’incontro: non crescono in risposta all’equipaggiamento del giocatore. Le regole ordinarie restano disponibili; l’Arena conserva i propri avversari e la vita separata.

| Grado | Requisiti | Preparazione prevista | Ritmo |
| --- | --- | --- | --- |
| Echi I · Bastione | Livello 30, profondità 60 | Leggendari potenziati | Guardia, carica, apertura. |
| Echi II · Frattura | Livello 45, profondità 100 | Set unici completi e potenziati | Raccolta, alba, apertura, assalto. |

Il Bastione riduce i danni durante la guardia; la Frattura annuncia l’alba con un turno di raccolta. Un’alba della Frattura che infligge danni provoca ferite: cure ridotte del 30% per i due turni successivi. Le aperture favoriscono gli attacchi. Il Faro mantiene le proprie due fasi e i propri intenti, anche negli Echi.

Il grado della spedizione è salvato alla partenza. I viaggi precedenti privi di quel dato rimangono ordinari. Gli scontri già pagati mantengono nemico e stato precedenti, senza introdurre retroattivamente rune o nuove decisioni automatiche.

## Verifica e limiti delle stime

`node --experimental-sqlite scripts/runic-balance-audit.cjs` riproduce 86.400 battaglie sintetiche: sei classi, livelli/profondità 30/60 e 45/100, quattro corredi casuali per fascia, due profili, con e senza rune. Nessuna ricerca degli affissi migliori, pozione, condizione Garmin o bonus di viaggio. Con rune si usano Brace e Respiro della quercia per Aggressivo, Rappresaglia e Veglia per Prudente: il confronto comprende anche questa diversa preparazione.

A livello 45/profondità 100, nel campione con rune, i leggendari potenziati vincono circa il 72% degli Echi I con Aggressivo e il 92% con Prudente. I set unici completi vincono circa il 62% degli Echi II con Aggressivo e il 90% con Prudente. I leggendari del campione non vincono gli Echi II: il requisito di livello sblocca la scelta, ma non garantisce equipaggiamento sufficiente. Le build reali possono discostarsi; il riepilogo riproducibile è in [runic-balance.json](runic-balance.json).

Test funzionali: `npm test`. Interfaccia e sei lingue: `node_modules/.bin/electron . --smoke-test --runic`. Questi controlli usano solo salvataggi temporanei.
