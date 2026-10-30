'use strict';
const {validDate}=require('./dates.cjs');
const {GameError}=require('./game-repository.cjs');

function createGameStepsService({game,repository,stepsService,actor,today}){
 return Object.freeze({
  claimCached(){
   const id=actor(),day=validDate(today()),scope=repository.activeScope();
   if(!scope)return null;
   const result=repository.read(scope,day,day),dailyTotal=result.days[0].steps;
   if(dailyTotal===null)return null;
   const before=game.state(id).hero.steps,state=game.claimSteps(id,scope,{from:day,to:day,allowEmpty:true});
   return {credited:state.hero.steps-before,dailyTotal};
  },
  async sync(input){
   if(input!==undefined)throw new GameError('L’importazione del gioco usa solo i passi di oggi.','INVALID_DATE');
   const id=actor(),day=validDate(today()),range={from:day,to:day};
   const result=await stepsService.sync(range.from,range.to);
   if(actor()!==id)throw new GameError('Personaggio cambiato: i passi sono salvati. Ripeti l’importazione con l’eroe desiderato.');
   let dailySync='online';
   try{const metrics=await stepsService.syncWellness(day);game.saveDailyWellness(repository.activeScope(),metrics);if(metrics.sleepUnavailable)dailySync='partial';}catch{dailySync='unavailable';}
   if(actor()!==id)throw new GameError('Personaggio cambiato. Ripeti l’importazione con l’eroe desiderato.');
   let guildSync=null;const guildActive=game.guildNeedsSync?.(id);if(guildActive||game.chroniclesNeedsSync?.(id)){guildSync=await stepsService.syncGuild(day,{includeHistory:!!guildActive});if(actor()!==id)throw new GameError('Personaggio cambiato. Ripeti l’importazione con l’eroe desiderato.');}
   const before=game.state(id).hero.steps;
   if(validDate(today())!==day)throw new GameError('La giornata è cambiata. Ripeti la sincronizzazione.');
   const state=game.claimSteps(id,repository.activeScope(),{...range,allowEmpty:true});
   return {...state,stepsImport:{guildSync,dailySync,from:day,to:day,dailyTotal:result.days[0].steps,credited:state.hero.steps-before,offline:result.sync?.state==='offline',storedDays:result.cache.storedDays,totalDays:result.days.length}};
  }
 });
}
module.exports={createGameStepsService};
