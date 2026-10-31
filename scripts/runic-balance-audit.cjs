'use strict';
// Reproducible synthetic balance sample. Never opens the player's save.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const C=require('../lib/game-catalog.cjs'),{generateItem,insertItem}=require('../lib/game-items.cjs'),{combatTurn}=require('../lib/combat-turn.cjs'),{enemyStats}=require('../lib/combat-balance.cjs'),{createCharactersRepository}=require('../lib/characters.cjs'),{createGameRepository}=require('../lib/game-repository.cjs'),{RECIPES,rollOptions}=require('../lib/alchemy-catalog.cjs'),{WORDS}=require('../lib/runic-catalog.cjs'),{snapshot}=require('../lib/runic-combat.cjs'),{autoAction,echoEnemy}=require('../lib/combat-tactics.cjs');
const seeded=initial=>{let seed=initial>>>0;return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);};
const checkpoints=[{level:30,depth:60},{level:45,depth:100}],gearSeeds=4,samples=60,directory=fs.mkdtempSync(path.join(os.tmpdir(),'sq-runic-balance-'));
const report={scope:'Synthetic elite fights with the production combat engine, rune stat aggregation and automatic profiles.',method:{gearSeeds,samplesPerLoadout:samples,classes:6,checkpoints,maxRounds:250,fullHealthEachFight:true,consumables:false,dailyEffects:false,gear:'Six class-compatible random pieces, no affix search. Rare; legendary +5 with two boosted/stabilized enchantments; five-piece unique +5 set and legendary second ring with the same enchantments. Four paired seeds. Runic variants: Brace + Respiro della quercia in Aggressive, Rappresaglia + Veglia in Prudent. No build optimization.'},rows:[]};
try{
 for(const classId of Object.keys(C.CLASSES)){
  const file=path.join(directory,classId+'.sqlite'),chars=createCharactersRepository(file),game=createGameRepository(file,{rng:seeded(42)}),db=new DatabaseSync(file);
  try{
   for(const checkpoint of checkpoints)for(const gear of ['rare','legendary-enhanced','unique-enhanced']){
    const totals=new Map();
    for(let seed=0;seed<gearSeeds;seed++){
     const hero=chars.create({name:'Simulatore',classId,sex:'female'});game.state(hero.id);db.prepare('UPDATE hero_progress SET level=?,stage=? WHERE character_id=?').run(checkpoint.level,checkpoint.depth,hero.id);
     const rng=seeded(173+seed*7919),setId=classId+'-set-'+(checkpoint.level>=45?4:3),slots=['weapon','body','feet','ring1','ring2','amulet'],templates=[classId+'-weapon-0',classId+'-body-0-0','boots-0','ring-0','ring-1','amulet-0'].map(id=>C.TEMPLATES.find(t=>t.id===id)),items=[];
     if(gear==='unique-enhanced')for(const [index,slot]of [[0,'weapon'],[1,'body'],[2,'feet'],[3,'ring'],[5,'amulet']])templates[index]=C.TEMPLATES.find(t=>t.set_id===setId&&t.slot===slot);
     for(const [index,template]of templates.entries()){
      const item=generateItem(template,{...checkpoint,rarity:gear==='rare'?'rare':gear==='unique-enhanced'&&index!==4?'unique':'legendary',rng,source:'audit'});insertItem(db,hero.id,item);items.push(item);
      if(gear!=='rare'){db.prepare('INSERT INTO item_refinements VALUES(?,?,5)').run(item.id,hero.id);if(index<2){const recipe=RECIPES.find(r=>r.id===(index===0?'flame':'titan')),option=rollOptions(recipe,item,{boost:true,stabilizer:true,rng})[0];db.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(item.id,hero.id,recipe.id,JSON.stringify(option.rolls),new Date().toISOString());}}
      game.equip(hero.id,{itemId:item.id,slot:slots[index]});
     }
     for(const profile of ['aggressive','prudent'])for(const runic of [false,true]){
      db.prepare('DELETE FROM item_runewords WHERE character_id=?').run(hero.id);const words=runic?(profile==='aggressive'?['ember','oak']:['revenge','vigil']).map(id=>WORDS.find(w=>w.id===id)):[];
      for(const w of words)db.prepare('INSERT INTO item_runewords(item_id,character_id,word) VALUES(?,?,?)').run(items[w.slot==='weapon'?0:1].id,hero.id,JSON.stringify(w));const stats=game.state(hero.id).hero.stats;
      for(const rank of [0,1,2].filter(rank=>rank<2||checkpoint.level>=45)){
       const key=JSON.stringify([profile,runic,rank]),total=totals.get(key)||{profile,runic,rank,wins:0,rounds:0,oneTurn:0,remainingHp:0,activations:0,damage:0,absorbed:0,healing:0,battles:0};
       for(let sample=0;sample<samples;sample++){
        const enemy=echoEnemy({...C.ENEMIES[sample%3],...enemyStats(checkpoint.depth+1,1.18,checkpoint.level),heavyEvery:3,heavyMultiplier:1.5},rank),buffs={autoProfile:profile,runic:snapshot(words)},random=seeded(2003+sample*65537+seed*257);let hp=stats.health,enemyHp=enemy.health,status='active',round=0;
        while(status==='active'&&round<250){({hp,enemyHp,status}=combatTurn({stats,hp,enemy,enemyHp,round,buffs,action:autoAction({enemy,round,buffs,hp,stats}),rng:random}));round++;}
        total.wins+=status==='won';total.oneTurn+=status==='won'&&round===1;total.rounds+=round;total.remainingHp+=status==='lost'?0:hp/stats.health;total.battles++;
        for(const row of Object.values(buffs.runic.summary)){total.activations+=row.activations;total.damage+=row.damage;total.absorbed+=row.absorbed;total.healing+=row.healing;}
       }
       totals.set(key,total);
      }
     }
     chars.remove(hero.id,hero.name);
    }
    for(const r of totals.values()){const mean=value=>+(value/r.battles).toFixed(2);report.rows.push({class:classId,...checkpoint,gear,profile:r.profile,runic:r.runic,echoRank:r.rank,battles:r.battles,winPercent:mean(r.wins*100),oneTurnWinPercent:mean(r.oneTurn*100),meanRounds:mean(r.rounds),meanRemainingHpPercent:mean(r.remainingHp*100),meanRuneActivations:mean(r.activations),meanRuneDamage:mean(r.damage),meanRuneAbsorbed:mean(r.absorbed),meanRuneHealing:mean(r.healing)});}
   }
  }finally{game.close();db.close();chars.close();}
 }
}finally{fs.rmSync(directory,{recursive:true,force:true});}
report.battles=report.rows.reduce((n,r)=>n+r.battles,0);const output=process.argv[2]||path.join(__dirname,'../artifacts/runic-balance-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({battles:report.battles,rows:report.rows.length,output}));
