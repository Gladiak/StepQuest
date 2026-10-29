'use strict';
const assert = require('node:assert/strict');

// Misura il colore del testo contro lo sfondo realmente renderizzato, incluse texture e gradienti.
module.exports = async function auditContrast(window, label) {
  const runs = await window.webContents.executeJavaScript(`(()=>{
    const result=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let node;node=walker.nextNode();){
      const text=node.textContent.trim(),element=node.parentElement;
      if(!text||!element||element.closest('script,style,[hidden]'))continue;
      const style=getComputedStyle(element);
      if(style.visibility!=='visible'||style.display==='none')continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(const original of range.getClientRects()){
        let left=original.left,topEdge=original.top,right=original.right,bottom=original.bottom;
        for(let ancestor=element;ancestor;ancestor=ancestor.parentElement){
          const css=getComputedStyle(ancestor),box=ancestor.getBoundingClientRect();
          if(/auto|scroll|hidden|clip/.test(css.overflowX)){left=Math.max(left,box.left+ancestor.clientLeft);right=Math.min(right,box.left+ancestor.clientLeft+ancestor.clientWidth);}
          if(/auto|scroll|hidden|clip/.test(css.overflowY)){topEdge=Math.max(topEdge,box.top+ancestor.clientTop);bottom=Math.min(bottom,box.top+ancestor.clientTop+ancestor.clientHeight);}
        }
        const rect={x:left,y:topEdge,left,top:topEdge,right,bottom,width:right-left,height:bottom-topEdge};
        if(rect.width<1||rect.height<1||rect.left<0||rect.top<0||rect.right>innerWidth||rect.bottom>innerHeight)continue;
        const top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
        const sceneTitle=element.closest('.game-location');
        if(!top||!(top===element||element.contains(top)||top.contains(element)||sceneTitle&&top.classList.contains('game-shell')))continue;
        const samples=[];
        for(const u of [.15,.5,.85])for(const v of [.25,.5,.75]){
          const x=rect.x+rect.width*u,y=rect.y+rect.height*v,hit=document.elementFromPoint(x,y);
          if(hit&&(hit===element||element.contains(hit)||hit.contains(element)||sceneTitle&&hit.classList.contains('game-shell')))samples.push({x,y});
        }
        if(samples.length)result.push({text:text.slice(0,70),color:style.color,samples,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}});
      }
    }
    for(const input of document.querySelectorAll('input:not([type=range]):not([type=checkbox])')){
      const rect=input.getBoundingClientRect();if(!rect.width||!rect.height||input.closest('dialog:not([open])'))continue;
      const style=getComputedStyle(input),placeholder=getComputedStyle(input,'::placeholder');
      result.push({text:'input: '+(input.value?'valore':'placeholder'),color:input.value?style.color:placeholder.color,
        rect:{x:rect.x+parseFloat(style.paddingLeft)+4,y:rect.y+rect.height/2-4,width:Math.max(8,rect.width-60),height:8}});
    }
    return result;
  })()`);
  const key = await window.webContents.insertCSS('body *{-webkit-text-fill-color:transparent!important;text-shadow:none!important}input::placeholder{color:transparent!important}');
  let picture;
  try {
    await window.webContents.executeJavaScript("getComputedStyle(document.body.firstElementChild).webkitTextFillColor");
    // capturePage può restituire l’ultimo frame prima che il compositore ridisegni il testo.
    await new Promise(resolve=>setTimeout(resolve,200));
    picture = await window.webContents.capturePage();
  }
  finally { await window.webContents.removeInsertedCSS(key); }
  const [viewWidth, viewHeight] = window.getContentSize();
  picture = picture.resize({width:viewWidth,height:viewHeight});
  const { width, height } = picture.getSize(), pixels = picture.toBitmap();
  const linear = value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; };
  const luminance = rgb => .2126 * linear(rgb[0]) + .7152 * linear(rgb[1]) + .0722 * linear(rgb[2]);
  const failures = []; let lowest = Infinity;
  for (const run of runs) {
    const fg = run.color.match(/[\d.]+/g).map(Number);
    let minimum = Infinity;
    const samples=run.samples||[.15,.5,.85].flatMap(u=>[.25,.5,.75].map(v=>({x:run.rect.x+run.rect.width*u,y:run.rect.y+run.rect.height*v})));
    for (const point of samples) {
      const x = Math.min(width-1,Math.floor(point.x*width/viewWidth));
      const y = Math.min(height-1,Math.floor(point.y*height/viewHeight));
      const offset = (y*width+x)*4, bg = [pixels[offset+2],pixels[offset+1],pixels[offset]];
      const color = fg.slice(0,3).map((c,i)=>c*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));
      const a = luminance(color), b = luminance(bg), ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      minimum = Math.min(minimum,ratio);
    }
    lowest = Math.min(lowest,minimum);
    if (minimum < 4.5) failures.push({text:run.text,ratio:Number(minimum.toFixed(2)),color:run.color});
  }
  assert.ok(runs.length>0, `${label}: nessun testo controllato`);
  if(failures.length)require('node:fs').writeFileSync(require('node:path').join(__dirname,'../artifacts/contrast-background.png'),picture.toPNG());
  assert.deepEqual(failures, [], `${label}: contrasto inferiore a 4.5:1`);
  return { screen:label,textRuns:runs.length,minimumContrast:Number(lowest.toFixed(2)) };
};
