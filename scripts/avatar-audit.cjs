'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {nativeImage}=require('electron');
module.exports=function auditAvatars(){
  const results=[];
  for(const cls of ['guardian','arcanist','ranger','rogue','druid','berserker'])for(const sex of ['male','female']){
    const name=`${cls}-${sex}`;
    const img=nativeImage.createFromPath(path.join(__dirname,'../renderer/assets',name+'.png'));
    assert.equal(img.isEmpty(),false,`${name}: immagine mancante`);
    const {width,height}=img.getSize(),pixels=img.toBitmap();
    let left=width,right=-1,top=height,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(pixels[(y*width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    assert.ok(right>left,`${name}: immagine vuota`);
    assert.ok(left>1&&top>1&&right<width-2&&bottom<height-2,`${name}: figura tocca il bordo del file`);
    const offsetX=Math.abs((left+right+1)/2-width/2)/width;
    const offsetY=Math.abs((top+bottom+1)/2-height/2)/height;
    assert.ok(offsetX<.1&&offsetY<.1,`${name}: figura decentrata`);
    results.push({name,width,height,offsetX,offsetY});
  }
  return results;
};
