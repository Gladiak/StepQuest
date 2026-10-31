'use strict';
// Exercise the production caravan generator in disposable saves, never player data.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const C=require('../lib/game-catalog.cjs'),{TIERS,tierFor}=require('../lib/merchant-catalog.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs');
const seed=71931,refreshesPerHero=30;let value=seed;const rng=()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sq-caravan-balance-')),file=path.join(directory,'save.sqlite'),chars=createCharactersRepository(file),game=createGameRepository(file,{rng}),db=new DatabaseSync(file);
const report={scope:'Production caravan stock, six classes and seven progression checkpoints. Synthetic data only; no upgrade probability claim.',seed,refreshesPerHero,classes:Object.keys(C.CLASSES),checkpoints:[],checks:['12 offers in 3/3/2/3/1 categories','class and level eligibility','persistent advertised featured cadence','maximum positive featured affixes','bounded ordinary affixes and guaranteed core/signature properties','no unique stock or resale profit']};
try{
 for(const level of [1,4,15,45,150,500,900]){
  const tier=tierFor(level),row={level,tier:tier.id,stocks:0,gear:0,featured:0,rarities:{},prices:{min:Infinity,max:0,total:0},provisionUnitCost:0};
  for(const classId of Object.keys(C.CLASSES)){
   const hero=chars.create({name:'Carovana',classId,sex:'female'});game.state(hero.id);db.prepare('UPDATE characters SET coins=100000000 WHERE id=?').run(hero.id);db.prepare('UPDATE hero_progress SET level=?,stage=? WHERE character_id=?').run(level,level,hero.id);
   let previous=game.state(hero.id);
   for(let n=0;n<refreshesPerHero;n++){
    const current=game.refreshMerchant(hero.id),offers=current.merchant.offers;assert.equal(offers.length,12);assert.equal(offers.filter(i=>i.trade.featured).length,previous.merchant.featuredIn===1?1:0);
    for(const category of C.MERCHANT_CATEGORIES)assert.equal(offers.filter(i=>i.category===category.id).length,category.stock);
    for(const item of offers){
     assert.equal(item.level,level);assert.ok(!item.classId||item.classId===classId);assert.ok(item.sellPrice<item.price);assert.notEqual(item.rarity,'unique');if(item.effect)continue;
     const rarity=C.RARITIES.find(r=>r.id===item.rarity);assert.ok(item.rolls.length>=Math.min(rarity.max,Math.max(rarity.min,tier.affixes)));assert.ok(item.rolls.length<=rarity.max);
     if(item.trade.featured){assert.equal(item.rarity,tier.featured);assert.equal(item.rolls.length,rarity.max);assert.ok(item.rolls.every(r=>r.value>0));row.featured++;}
     else assert.ok(tier.weights[item.rarity]);
     if(item.rolls.length){const expected=item.category==='weapons'?(level<15?'attack_flat':'attack_percent'):item.category==='armor'?(level<15?'health_flat':'health_percent'):item.trade.purpose==='Fortuna del viandante'?'gold_bonus_percent':'loot_bonus_percent';assert.equal(item.rolls[0].attribute_id,expected);assert.ok(item.rolls[0].value>0);}
     row.gear++;row.rarities[item.rarity]=(row.rarities[item.rarity]||0)+1;row.prices.min=Math.min(row.prices.min,item.price);row.prices.max=Math.max(row.prices.max,item.price);row.prices.total+=item.price;
    }
    row.stocks++;previous=current;
   }
   row.provisionUnitCost=game.previewProvisions(hero.id,{quantity:1}).unitCost;chars.remove(hero.id,hero.name);
  }
  row.prices.mean=Math.round(row.prices.total/row.gear);delete row.prices.total;row.rarityPercent=Object.fromEntries(Object.entries(row.rarities).map(([key,count])=>[key,+(count/row.gear*100).toFixed(2)]));row.refreshCost=C.RULES.merchant_refresh_base+level*C.RULES.merchant_refresh_per_level;report.checkpoints.push(row);
 }
 assert.equal(TIERS.length,6);
}finally{game.close();db.close();chars.close();fs.rmSync(directory,{recursive:true,force:true});}
const output=process.argv[2]||path.join(__dirname,'../artifacts/merchant-balance.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({stocks:report.checkpoints.reduce((n,r)=>n+r.stocks,0),gear:report.checkpoints.reduce((n,r)=>n+r.gear,0),output}));
