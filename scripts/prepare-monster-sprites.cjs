'use strict';
const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.whenReady().then(()=>{
 const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),folder=path.join(__dirname,'../renderer/assets/monsters');fs.mkdirSync(folder,{recursive:true});
 for(const item of manifest){
  const image=nativeImage.createFromPath(item.source);if(image.isEmpty())throw new Error(item.id+': immagine mancante');const {width,height}=image.getSize(),bytes=image.toBitmap();let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(bytes[(y*width+x)*4+3]>64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<=left)throw new Error(item.id+': immagine vuota');const ratio=84/Math.max(right-left+1,bottom-top+1),w=Math.max(1,Math.round((right-left+1)*ratio)),h=Math.max(1,Math.round((bottom-top+1)*ratio));
  const pixels=image.crop({x:left,y:top,width:right-left+1,height:bottom-top+1}).resize({width:w,height:h,quality:'best'}).toBitmap(),out=Buffer.alloc(96*96*4),dx=Math.floor((96-w)/2),dy=90-h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=(y*w+x)*4,dst=((y+dy)*96+x+dx)*4,a=pixels[src+3];if(a<100)continue;for(let c=0;c<3;c++)out[dst+c]=Math.min(255,Math.round(pixels[src+c]*255/a/17)*17);out[dst+3]=255;}
  fs.writeFileSync(path.join(folder,item.id+'.png'),nativeImage.createFromBitmap(out,{width:96,height:96}).toPNG());
 }
 fs.writeFileSync(path.join(folder,'prompts.json'),JSON.stringify(manifest.map(({id,prompt})=>({id,prompt})),null,2)+'\n');console.log(JSON.stringify({monsters:manifest.length,size:'96x96',transparent:true,feetBaseline:90}));app.quit();
}).catch(e=>{console.error(e.message);app.exit(1);});
