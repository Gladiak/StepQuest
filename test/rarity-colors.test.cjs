'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createStepsRepository}=require('../lib/steps-repository.cjs');
const {createCharactersRepository}=require('../lib/characters.cjs');
const {createGameRepository}=require('../lib/game-repository.cjs');
const C=require('../lib/game-catalog.cjs');
const rgb=hex=>hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255);
const luminance=hex=>rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
function hue(hex){const [r,g,b]=rgb(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;return ((max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;}
test('mitico: arancione saturo distinto dall’oro raro e leggibile sulle due superfici',()=>{
 const mythic=C.RARITIES.find(r=>r.id==='mythic'),rare=C.RARITIES.find(r=>r.id==='rare');
 assert.ok(Math.abs(hue(mythic.dark)-hue(rare.dark))>=15);
 assert.ok(rgb(mythic.dark)[0]>.95&&rgb(mythic.dark)[2]<.15);
 assert.ok(contrast(mythic.dark,'#1e2822')>=4.5);
 assert.ok(contrast(mythic.light,'#c7a56a')>=4.5);
});
test('migrazione colori v4: aggiorna i mitici senza alterare oggetti, saldi o scontro salvato',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-colors-')),file=path.join(dir,'game.sqlite');
 const steps=createStepsRepository(file),characters=createCharactersRepository(file),sql=new DatabaseSync(file);let game=createGameRepository(file,{rng:()=>.5});
 t.after(()=>{game.close();sql.close();characters.close();steps.close();fs.rmSync(dir,{recursive:true,force:true});});
 const hero=characters.create({name:'Elara',classId:'arcanist',sex:'female'});
 sql.prepare('UPDATE characters SET steps=1000,coins=100 WHERE id=?').run(hero.id);
 game.startBattle(hero.id,'normal');
 const snapshot=()=>Object.fromEntries(['characters','hero_progress','item_instances','equipped_items','wallet_events','step_claims','battles','expeditions'].map(table=>[table,sql.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 const before=snapshot();game.close();
 sql.exec("UPDATE item_rarities SET color_light='#713009',color_dark='#ffb774' WHERE id='mythic';DELETE FROM game_migrations WHERE version>=5;");
 game=createGameRepository(file,{rng:()=>.5});
 const mythic=game.state(hero.id).rarities.find(r=>r.id==='mythic');assert.equal(mythic.dark,'#ff8a1f');assert.equal(mythic.light,'#6b2300');
 assert.deepEqual(snapshot(),before);assert.equal(sql.prepare('SELECT max(version) v FROM game_migrations').get().v,9);
 game.close();game=createGameRepository(file,{rng:()=>.5});assert.deepEqual(snapshot(),before);
});
