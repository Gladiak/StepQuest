# Sprite base dell’equipaggiamento

16 PNG trasparenti da **32×32 pixel**, integrati negli slot di Casa e Mercato. Ogni sagoma occupa al massimo 26×26 pixel, con almeno 3 pixel di margine. Gli sprite usano alpha binario e vengono mostrati senza interpolazione (`image-rendering: pixelated`).

- Armi: spada del Guardiano, bastone dell’Arcanista, arco del Ranger, pugnali del Predone, bastone naturale del Druido, ascia del Berserker.
- Armature: corazza, vesti, giaco di cuoio; le sei classi hanno caratteristiche specifiche.
- Oggetti comuni: stivali, anello, amuleto, razione, pozioni rossa, blu e verde.

Il catalogo di gioco è in SQLite, inizializzato da `lib/game-catalog.cjs`: 345 modelli con prefissi, suffissi, caratteristiche e set di classe. `renderer/items.js` contiene soltanto metadati di presentazione. Le cinque rarità condividono gli sprite e si distinguono con nome, bordo e caratteristiche colorati secondo la legenda. I roll numerici e i relativi range appartengono alle istanze persistenti e non cambiano aprendo il tooltip.

Il tooltip funziona su hover e focus da tastiera, si chiude con Escape e rimane entro la finestra. Il click apre l’esame con acquisto, vendita, equipaggiamento o consumo effettivi, validati nel processo principale. Il nuovo corredo contiene soltanto arma comune e vestiti senza caratteristiche aggiuntive.

Generazione: strumento integrato **imagegen**, una generazione distinta per sprite, con sfondo trasparente. Il set completo dei prompt finali è in [prompts.json](prompts.json). I PNG di produzione sono stati ritagliati sull’alpha, ridimensionati e centrati con `scripts/prepare-item-sprites.cjs`, senza modificare i file originali generati. Il manifest di lavorazione con i percorsi degli originali resta in `artifacts/item-source-manifest.json` (escluso dal pacchetto).

Controlli: `scripts/item-sprite-audit.cjs` verifica dimensioni, margini e trasparenza. `npm run test:electron` verifica caricamento, ingombro negli slot, hover delle pozioni, confronto di rarità, focus, Escape e posizionamento del tooltip. Tavola di controllo: `artifacts/item-sprites.png`.
