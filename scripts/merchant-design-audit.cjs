'use strict';
// Historical baseline: uses generic item rarity weights, not the progressive caravan.
// All heroes and stock live in a disposable synthetic save.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const C=require('../lib/game-catalog.cjs'),{rollItem,generateItem,insertItem,effectFor}=require('../lib/game-items.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs'),{RECIPES,rollOptions}=require('../lib/alchemy-catalog.cjs');
const seeded=start=>{let value=start>>>0;return ()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);};
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sq-merchant-design-')),file=path.join(directory,'save.sqlite'),chars=createCharactersRepository(file),game=createGameRepository(file,{rng:seeded(17)}),db=new DatabaseSync(file);
const report={scope:'Merchant usefulness at level 900; synthetic data only, no player save accessed.',method:{seed:17,raritySamples:20000,classes:6,gearSeeds:3,checkpoints:[{level:900,depth:900},{level:900,depth:1100}],profiles:['ordinary rare','ordinary legendary +5 with flame/titan enchantments','complete unique +5 with flame/titan enchantments'],conditions:'No runewords, Garmin bonuses, potions consumed, or search for optimal affixes. Effective food/healing figures include potion-power stats; exclude wounds. These are example builds, not upgrade probability estimates.'},rarities:{},builds:[]};
try{
 const rng=seeded(17);for(let n=0;n<report.method.raritySamples;n++){const item=rollItem('guardian',900,{rng,category:'weapons',source:'merchant',depth:1100});report.rarities[item.rarity]=(report.rarities[item.rarity]||0)+1;}
 for(const classId of Object.keys(C.CLASSES))for(const level of [900])for(const depth of [level,level+200])for(const profile of ['rare','legendary','unique']){
  const builds=[];
  for(let seed=0;seed<3;seed++){
   const hero=chars.create({name:'Simulatore',classId,sex:'female'});game.state(hero.id);db.prepare('UPDATE hero_progress SET level=?,stage=? WHERE character_id=?').run(level,depth,hero.id);
   const rng=seeded(113+seed*7919),slots=['weapon','body','feet','ring1','ring2','amulet'],setId=classId+'-set-4',templates=[classId+'-weapon-0',classId+'-body-0-0','boots-0','ring-0','ring-1','amulet-0'].map(id=>C.TEMPLATES.find(t=>t.id===id));
   if(profile==='unique')for(const [index,slot]of [[0,'weapon'],[1,'body'],[2,'feet'],[3,'ring'],[5,'amulet']])templates[index]=C.TEMPLATES.find(t=>t.set_id===setId&&t.slot===slot);
   for(const [index,template]of templates.entries()){
    const item=generateItem(template,{level,depth,rarity:profile==='unique'&&index===4?'legendary':profile,rng,source:'monster'});insertItem(db,hero.id,item);
    if(profile!=='rare'){db.prepare('INSERT INTO item_refinements VALUES(?,?,5)').run(item.id,hero.id);if(index<2){const recipe=RECIPES.find(r=>r.id===(index===0?'flame':'titan')),option=rollOptions(recipe,item,{boost:true,stabilizer:true,rng})[0];db.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(item.id,hero.id,recipe.id,JSON.stringify(option.rolls),new Date().toISOString());}}
    game.equip(hero.id,{itemId:item.id,slot:slots[index]});
   }
   const stats=game.state(hero.id).hero.stats,best=kind=>Math.max(...C.TEMPLATES.filter(t=>t.effect?.kind===kind&&t.min_level<=level).map(t=>effectFor(t,level).amount)),food=best('food'),heal=best('heal'),effective=value=>Math.round(value*(1+stats.potion_power/100));
   builds.push({health:stats.health,attack:stats.attack,defense:stats.defense,bestFood:food,bestHealingPotion:heal,effectiveFoodPercent:effective(food)/stats.health*100,effectivePotionPercent:effective(heal)/stats.health*100});chars.remove(hero.id,hero.name);
  }
  const mean=field=>+(builds.reduce((sum,b)=>sum+b[field],0)/builds.length).toFixed(2);report.builds.push({class:classId,level,depth,profile,...Object.fromEntries(Object.keys(builds[0]).map(field=>[field,mean(field)]))});
 }
 const tiers=C.RARITIES.filter(r=>r.weight>0),legendaryChance=tiers.find(r=>r.id==='legendary').weight/tiers.reduce((sum,r)=>sum+r.weight,0),equipmentOffers=C.MERCHANT_CATEGORIES.filter(c=>!['food','potions'].includes(c.id)).reduce((sum,c)=>sum+c.stock,0),stockChance=1-(1-legendaryChance)**equipmentOffers;
 report.merchant={weights:C.RARITIES.filter(r=>r.weight>0).map(r=>({id:r.id,weight:r.weight})),refreshCostLevel900:C.RULES.merchant_refresh_base+900*C.RULES.merchant_refresh_per_level,legendaryChancePerEquipmentOffer:legendaryChance,equipmentOffersPerNewStock:equipmentOffers,chanceOfLegendaryInNewStockPercent:+(stockChance*100).toFixed(3),meanRefreshesPerLegendary:+(1/stockChance).toFixed(2),uniquesSold:false,merchantCoreAffixGuarantee:false,monsterCoreAffixGuarantee:true};
}finally{game.close();db.close();chars.close();fs.rmSync(directory,{recursive:true,force:true});}
const output=process.argv[2]||path.join(__dirname,'../artifacts/merchant-design-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({raritySamples:report.method.raritySamples,buildScenarios:report.builds.length,output}));
