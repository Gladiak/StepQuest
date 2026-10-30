'use strict';
window.StepQuestWatch=(()=>{
 function memoryContent(memory,el){const body=el('div','watch-memory');body.append(el('p','watch-memory-route',memory.passage),el('p','',memory.flame),el('p','watch-memory-ending',memory.ending),el('blockquote','watch-home-voice',memory.home));return body;}
 function ceremony({memory,el,button,dialog,onHome}){
  const content=el('div','watch-ceremony'),scene=el('div','watch-tableau'),map=el('img');map.src='assets/atlas-refuge.png';map.alt='';scene.setAttribute('aria-hidden','true');scene.append(map,el('span','watch-light-ray'),el('span','watch-light-source'));
  for(const [index,[x,y]]of [[79,61],[56,78],[44,52],[25,45],[16,74],[14,24]].entries()){const light=el('span','watch-window-light');light.style.left=x+'%';light.style.top=y+'%';light.style.setProperty('--light-delay',(index*.28+.5)+'s');scene.append(light);}
  content.append(el('p','watch-kicker','EPILOGO DELLA PROVINCIA'),scene,memoryContent(memory,el));
  let audio=null;
  const listen=button('Ascolta il Faro',async()=>{
   if(audio||!window.AudioContext)return;
   try{audio=new AudioContext();await audio.resume();if(!content.isConnected){await audio.close();return;}listen.disabled=true;const context=audio,start=context.currentTime,master=context.createGain();master.gain.value=.09;master.connect(audio.destination);
    for(const [index,note]of [48,55,60,64,67,72,71,67,64,60,55,60].entries()){const oscillator=audio.createOscillator(),gain=audio.createGain(),at=start+index*.25;oscillator.type='sine';oscillator.frequency.value=440*Math.pow(2,(note-69)/12);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.6,at+.025);gain.gain.exponentialRampToValueAtTime(.001,at+1.25);oscillator.connect(gain);gain.connect(master);oscillator.start(at);oscillator.stop(at+1.3);if(index===11)oscillator.onended=()=>{if(context.state!=='closed')context.close().catch(()=>{});if(audio===context)audio=null;if(listen.isConnected)listen.disabled=false;};}
   }catch{if(audio)audio.close().catch(()=>{});audio=null;listen.disabled=false;}
  },'secondary','watch-listen');
  dialog(memory.title,'Il Faro è acceso. La provincia ricorderà questa notte.',content,[listen,...(onHome?[button('Torna al Rifugio',onHome,'','watch-return-home')]:[])]);
  const modal=document.getElementById('game-dialog');modal.classList.add('watch-finale-dialog');modal.dataset.watchFinale='true';modal.setAttribute('aria-labelledby','watch-finale-title');modal.querySelector('h2').id='watch-finale-title';modal.addEventListener('close',()=>{if(audio){audio.close().catch(()=>{});audio=null;}},{once:true});
 }
 function departure({el,button,dialog,cost,onStart}){
  const content=el('div','watch-call');content.append(el('p','','Il cartografo stende una mappa sul tavolo. «Il Faro non si è spento per il vento. Il Custode ha sigillato la sua luce, aspettando qualcuno capace di riportarla a casa.»'),el('blockquote','','«Hai già lasciato un segno su questa provincia. Ora porta le sue promesse fino alla cima.»'),el('p','watch-call-rules','Quattro tappe: attraversa il fiume, riposa fra le pietre, scegli come usare l’ultima fiamma e affronta il Custode in due fasi.'),el('p','',`Costo totale: ${cost} passi. Rientro, sacca e bottino seguono le regole delle spedizioni.`));
  dialog('La chiamata del Faro','Le campane suonano. Nessuna luce risponde.',content,[button('Parti verso il Faro',onStart,'','confirm-atlas-expedition')]);document.getElementById('game-dialog').classList.add('watch-call-dialog');
 }
 function battle(detail,b,el){
  detail.dataset.watchPhase=String(b.intent.phase);detail.dataset.watchIntent=b.intent.kind;
  const phase=el('div','watch-phase');phase.append(el('span','watch-phase-number',b.intent.phase===1?'I':'II'),el('strong','',b.intent.label));detail.prepend(phase);
  const meter=el('progress','watch-boss-health');meter.max=b.enemy.health;meter.value=b.enemyHp;meter.setAttribute('aria-label','Vita del Custode del Faro');detail.querySelector('.enemy-health').after(meter);
  if(b.status==='active'){const flame=el('p','watch-flame-state',b.buffs.watchFlame>0?'Ultima fiamma: una protezione contro l’alba.':'Osserva la lanterna. Ogni apertura è una possibilità.');detail.querySelector('.enemy-intent').after(flame);}
 }
 return {ceremony,departure,battle,memoryContent};
})();
