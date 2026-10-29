# Sprite dei mostri

Tre PNG trasparenti in pixel art da 96×96 pixel:

- `slime.png`: melma verde dei sentieri.
- `wolf.png`: lupo grigio del branco.
- `raider.png`: predone delle rovine, con cappuccio e scudo.

Gli asset sono generati separatamente con lo strumento integrato **imagegen**; i prompt completi selezionati sono in [prompts.json](prompts.json). Sono stati normalizzati con `scripts/prepare-monster-sprites.cjs` senza sovrascrivere gli originali generati: margine minimo di 6 pixel e baseline dei piedi al pixel 90. I PNG mantengono trasparenza binaria e vengono mostrati senza interpolazione.

La schermata dei sentieri presenta una galleria dei tre nemici. Durante lo scontro viene mostrato il mostro effettivamente estratto, sul fondale di fronte all’eroe. Gli sprite sono statici. `scripts/monster-sprite-audit.cjs` verifica dimensioni, margini, trasparenza e posizione dei piedi.
