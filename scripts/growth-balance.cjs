'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-growth-'));let root=path.join(__dirname,'..');
if(process.argv.includes('--baseline')){const asar=require('@electron/asar'),archive=path.join(root,'dist/mac-arm64/StepQuest.app/Contents/Resources/app.asar');root=path.join(dir,'baseline');fs.mkdirSync(path.join(root,'lib'),{recursive:true});for(const file of asar.listPackage(archive).filter(p=>/^\/lib\/[^/]+\.cjs$/.test(p)))fs.writeFileSync(path.join(root,file),asar.extractFile(archive,file.slice(1)));}
const C=require(path.join(root,'lib/game-catalog.cjs')),{generateItem,insertItem}=require(path.join(root,'lib/game-items.cjs')),{createStepsRepository}=require(path.join(root,'lib/steps-repository.cjs')),{createCharactersRepository}=require(path.join(root,'lib/characters.cjs')),{createGameRepository}=require(path.join(root,'lib/game-repository.cjs'));
const report={samplesPerScenario:60,gear:'sei pezzi comuni/non comuni a livello1, rari dal4; generati come drop, senza set unici',strategy:'attacco automatico, vita piena, nessun consumabile o bonus Garmin',rows:[]};
try{for(const cls of Object.keys(C.CLASSES)){
 const file=path.join(dir,cls+'.sqlite'),steps=createStepsRepository(file),chars=createCharactersRepository(file),db=new DatabaseSync(file);let seed=1;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),game=createGameRepository(file,{rng});
 try{for(const level of [1,4,8,15,21,30,45]){
  const hero=chars.create({name:'Simulatore',classId:cls,sex:'male'});game.state(hero.id);const depth=level*2;db.prepare('UPDATE hero_progress SET level=?,stage=? WHERE character_id=?').run(level,depth,hero.id);seed=3073;
  for(const name of [cls+'-weapon-0',cls+'-body-0-0','boots-0','ring-0','ring-1','amulet-0']){const item=generateItem(C.TEMPLATES.find(t=>t.id===name),{level,depth,rarity:level>=4?'rare':'uncommon',rng,source:'monster'});insertItem(db,hero.id,item);game.equip(hero.id,item.id);}
  for(const difficulty of ['normal','elite']){let won=0,rounds=0,hp=0;for(let sample=0;sample<60;sample++){
   seed=1000+sample;db.prepare('UPDATE hero_progress SET level=?,stage=?,xp=0,hp=1000000 WHERE character_id=?').run(level,depth,hero.id);db.prepare('UPDATE characters SET steps=10000,coins=10000 WHERE id=?').run(hero.id);game.rest(hero.id);
   const s=game.startAutoBattle(hero.id,{difficulty,requestId:randomUUID()});won+=s.battle.status==='won';rounds+=s.battle.round;hp+=s.hero.hp/s.hero.stats.health*100;const worn=db.prepare('SELECT item_id FROM equipped_items WHERE character_id=?').all(hero.id).map(r=>r.item_id);for(const row of db.prepare("SELECT id FROM item_instances WHERE character_id=? AND source='monster'").all(hero.id))if(!worn.includes(row.id))db.prepare('DELETE FROM item_instances WHERE id=?').run(row.id);
  }report.rows.push({class:cls,level,depth,difficulty,winPercent:+(won/60*100).toFixed(1),meanRounds:+(rounds/60).toFixed(1),meanHpPercent:+(hp/60).toFixed(1)});}
  chars.remove(hero.id,hero.name);
 }}finally{game.close();db.close();chars.close();steps.close();}
}}finally{fs.rmSync(dir,{force:true,recursive:true});}
const index=process.argv.indexOf('--output'),output=index>=0?process.argv[index+1]:'artifacts/growth-balance.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,battles:report.rows.length*60}));
