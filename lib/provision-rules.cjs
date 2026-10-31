'use strict';
const rationHealing=(amount,stats,effects={})=>Math.max(0,Math.round(amount*(1+(stats.potion_power||0)/100)*(1+(effects.healingPercent||0)/100)));
// Shared by the saved satchel and the equipment-trial worker. Batches are local
// copies, consumed FIFO; only actually used rations have an opportunity cost.
function feedRations({hp,stats,batches,target,limit,effects={}}){
 let used=0,healing=0,spent=0;effects={...effects};hp=Math.min(hp,stats.health);
 if(hp>0)for(const batch of batches){
  while(batch.quantity>0&&used<limit&&hp<target){const value=Math.min(stats.health-hp,rationHealing(batch.amount,stats,effects));if(value<=0)break;hp+=value;healing+=value;used++;spent+=batch.unit_cost||batch.unitCost||0;batch.quantity--;effects={...effects,relieved:true,healingPercent:Math.max(0,effects.healingPercent||0),attackPercent:Math.max(0,effects.attackPercent||0)};}
  if(used>=limit||hp>=target)break;
 }
 return {hp,used,healing,spent,effects};
}
module.exports={rationHealing,feedRations};
