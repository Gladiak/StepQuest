'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../lib/game-catalog.cjs');
const {generateItem}=require('../lib/game-items.cjs');
test('libreria: identificativi univoci, tutti i set completi e sprite riutilizzati fra rarità',()=>{
 assert.ok(C.TEMPLATES.length>300);assert.ok(C.AFFIXES.length>100);
 assert.equal(new Set(C.TEMPLATES.map(t=>t.id)).size,C.TEMPLATES.length);
 for(const set of C.SETS){const pieces=C.TEMPLATES.filter(t=>t.set_id===set.id);assert.deepEqual(pieces.map(t=>t.slot).sort(),['amulet','body','feet','ring','weapon']);assert.equal(pieces.every(t=>t.class_id===set.class_id),true);assert.deepEqual([...new Set(set.bonuses.map(b=>b.pieces))],set.unique?[2,3,4,5]:[2,3,4]);}
 for(const cls of Object.keys(C.CLASSES)){const base=C.TEMPLATES.find(t=>t.id===cls+'-weapon-0');const common=generateItem(base),rare=generateItem(base,{rarity:'rare',rng:()=>.5});assert.equal(common.sprite,rare.sprite);assert.equal(common.rolls.length,0);assert.ok(rare.rolls.length>0);}
});
