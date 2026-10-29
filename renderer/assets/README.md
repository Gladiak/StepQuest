# Asset originali StepQuest

Creati con il tool integrato ImageGen, 28 ottobre 2026. I riferimenti dell’utente sono stati usati come direzione estetica, senza incorporarli nell’app.

- `heroes.png`: atlante originale con sei classi per due sessi, sei colonne e due righe. Prompt: «12 full-body distinct chibi pixel-art fantasy heroes, male first row and female second row; guardian, arcanist, ranger, rogue, druid, berserker; equal cells, crisp pixels, earthy palette, no text».
- `welcome.png`: ambiente originale. Prompt: «Fantasy RPG main menu, pixel-art forest at dusk, ancient stone arch, path toward a golden-lit castle, indigo mountains, lanterns, quiet center for logo, no characters or text».

L’atlante originale è conservato come riferimento. La UI usa ora dodici PNG separati (`classe-male.png` e `classe-female.png`), senza ritaglio o maschere, con `object-fit: contain`. Le figure sono state isolate con ImageGen per evitare frammenti degli avatar vicini. L’atlante e lo sfondo sono salvati nel progetto e inclusi nel pacchetto, senza dipendenze remote.

## Prompt completi

Atlante:

Create ONE production game sprite atlas PNG transparent. Exactly 6 equal columns and 2 equal rows, all cells equal, ideally 1536x1024 landscape. Row 1 male heroes; row 2 female heroes. Columns in exact order: guardian knight with silver armor red cape sword shield; arcanist purple robes pointed hat staff violet crystal; ranger green cloak bow quiver; rogue dark leather hood twin daggers; druid teal woodland robes antlers wooden staff; berserker copper hair fur armor huge axe. All 12 full body distinct charming heroic chibi true pixel art, hand placed crisp pixels, 32-bit fantasy RPG, 3/4 front facing, dark outlines, restrained earthy palette and luminous highlights. Each hero fully contained centered within its own cell with generous transparent gaps. Female heroes differentiated hair face armor silhouette but equally practical armor. Same scale feet baseline per row. No text no labels no gridlines no backdrop no shadows extending into other cells. Do not make a mockup. This is a usable sprite atlas.

Sfondo:

Original fantasy RPG main menu background, landscape 16:10 composition. Beautiful detailed actual pixel art environment, dusk forest framing an ancient stone arch and winding path to a distant small golden-lit castle, layered indigo mountains and mist, warm candle lanterns in foreground, mysterious but welcoming. Restrained muted forest olive, aged gold, midnight blue and moss colors, crisp hand placed pixel clusters, no blur. Center of image kept dark and quiet with open negative space to overlay a game logo and menu. Foreground foliage detailed at edges. No characters no text no UI no logos. Desktop fantasy indie adventure atmosphere.


## Verifica dei ritratti

Lo smoke test Electron verifica che tutti e dodici i PNG siano caricabili, abbiano margini trasparenti e figure centrate. Il renderer usa le immagini intere in creazione, selezione e avamposto. I prompt di estrazione sono riportati in `avatar-prompts.json`.

## Ambientazioni statiche

`scene-home.png`, `scene-market.png` e `scene-wilds.png` sono fondali originali generati con il tool integrato ImageGen: rifugio medievale, piazza del mercato e bosco fuori dalle mura. I prompt completi sono in `scene-prompts.json`. Gli scenari non comprendono mappe, NPC o animazioni e sono inclusi nel pacchetto per l’uso offline.

Gli sfondi `scene-mine.png`, `scene-smith.png` e `scene-arena.png` sono stati creati il 29 ottobre 2026 con ImageGen integrato per Miniera, Fabbro e Arena PvE. Sono asset originali salvati nel progetto; scene e prompt completi sono registrati in [scene-prompts.json](scene-prompts.json).
