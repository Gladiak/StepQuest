'use strict';
const assert=require('node:assert/strict'),path=require('node:path');const {nativeImage}=require('electron');
module.exports=()=>{
 for(const id of ['slime','wolf','raider']){const image=nativeImage.createFromPath(path.join(__dirname,'../renderer/assets/monsters',id+'.png'));assert.equal(image.isEmpty(),false,id+': sprite mancante');assert.deepEqual(image.getSize(),{width:96,height:96});const pixels=image.toBitmap();let visible=0,bottom=0;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){const a=pixels[(y*96+x)*4+3];assert.ok(a===0||a===255);if(a){visible++;bottom=Math.max(bottom,y);assert.ok(x>=6&&x<90&&y>=6&&y<90,id+': figura tagliata');}}
  assert.ok(visible>300,id+': figura vuota');assert.ok(bottom>=88&&bottom<90,id+': piedi fuori baseline');
 }return 3;
};
