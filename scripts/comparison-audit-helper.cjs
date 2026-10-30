'use strict';
// Headless balance audits use the same simulator; production snapshots remain
// inexpensive and do not synchronously run simulations for the entire bag.
const simulator=require('../lib/comparison-simulation.cjs').createSimulator();
module.exports=function bestComparison(game,id,state,item){
 if(!item?.comparisons?.some(c=>c.eligible&&!c.equipped))return null;
 const batch=game.comparisonInput(id,{context:state.comparisonContext,itemIds:[item.id]});
 return batch.items[0].comparisons.filter(c=>c.eligible&&!c.equipped).map(c=>({slot:c.slot,assessment:simulator.evaluate(c.input)}))
  .filter(c=>c.assessment.recommendation==='better')
  .sort((a,b)=>(b.assessment.metrics?.after.winRate||0)-(a.assessment.metrics?.after.winRate||0)||(b.assessment.metrics?.after.xpPer100Steps||0)-(a.assessment.metrics?.after.xpPer100Steps||0))[0]||null;
};
