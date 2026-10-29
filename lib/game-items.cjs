'use strict';
const {randomInt,randomUUID}=require('node:crypto');
const C=require('./game-catalog.cjs');
const {MINIMUM_LEVEL,MONSTER_WEIGHTS,ELITE_WEIGHTS}=require('./combat-balance.cjs');
const random=()=>randomInt(0,0x40000000)/0x40000000;
const integer=(rng,a,b)=>a+Math.floor(Math.min(.999999999,Math.max(0,rng()))*(b-a+1));
const pick=(rng,values)=>values[integer(rng,0,values.length-1)];
function weighted(rng,values,weight=x=>x.weight){let roll=Math.min(.999999999,Math.max(0,rng()))*values.reduce((n,x)=>n+weight(x),0);return values.find(x=>(roll-=weight(x))<0)||values.at(-1);}
function effectFor(template,level){if(!template.effect)return null;const e={...template.effect};if(['heal','food','antidote'].includes(e.kind))e.amount=Math.round(e.amount*(1+.06*Math.max(0,level-template.min_level)));return e;}
function generateItem(template,{level=1,depth=level,rarity='common',rng=random,source='merchant',catalog=C,propertyCount=null}={}){
 const data=catalog;
 const tier=data.RARITIES.find(x=>x.id===rarity);if(!tier)throw new Error('Rarità non valida.');
 level=Math.max(template.min_level,Math.min(100000,Math.floor(level)));
 if(template.starter){level=1;rarity='common';}
 const rank=template.starter?data.RARITIES[0]:tier;
 const set=data.SETS.find(s=>s.id===template.set_id);
 if(set?.unique&&rarity!=='unique'||rarity==='unique'&&!set?.unique)throw new Error('I set unici richiedono rarità Unico.');
 if(!Number.isSafeInteger(depth)||depth<1||depth>100000)throw new Error('Profondità non valida.');
 const generationDepth=template.starter?1:depth,depthMultiplier=template.starter||template.effect?1:1+Math.min(2,Math.max(0,depth-level)/100);
 if(template.set_id&&rank.rank<2)throw new Error('Un set richiede almeno rarità rara.');
 if(template.effect&&rank.rank!==0)throw new Error('I consumabili non hanno affissi di equipaggiamento.');
 if(propertyCount!==null&&(!Number.isInteger(propertyCount)||propertyCount<rank.min||propertyCount>rank.max))throw new Error('Numero di attributi non valido.');
 const count=propertyCount??integer(rng,rank.min,rank.max),rolls=[],chosen=new Set();let prefix=null,suffix=null;
 for(let i=0;i<count;i++){
  const eligible=data.AFFIXES.filter(a=>a.min_rank<=rank.rank&&a.slots.includes(template.slot)&&!chosen.has(a.rolls.find(r=>r.sign===1).attribute_id));
  const core=['monster','smith'].includes(source)&&i===0?eligible.filter(a=>{const stat=a.rolls.find(r=>r.sign===1).attribute_id;return (template.slot==='weapon'?['attack_flat','attack_percent','magic_damage_flat','critical_percent','speed_percent']:['health_flat','health_percent','defense_flat','defense_percent','damage_reduction_percent','attack_flat']).includes(stat);}):[];
  const affix=pick(rng,core.length?core:eligible),penalty=affix.rolls.find(r=>r.sign===-1);
  const negative=rank.id!=='unique'&&i>0&&penalty&&!chosen.has(penalty.attribute_id)&&rng()<penalty.chance;
  const range=affix.rolls.find(r=>r.sign===(negative?-1:1)),attribute=data.ATTRIBUTES.find(a=>a.id===range.attribute_id);chosen.add(attribute.id);
  const multiplier=rank.scale*(1+Math.log2(level)/3)*depthMultiplier,minimum=Math.max(1,Math.round(range.min*multiplier));
  const maximum=Math.max(minimum,Math.round(range.max*multiplier));
  rolls.push({attribute_id:attribute.id,value:integer(rng,minimum,maximum)*(negative?-1:1),min:negative?-maximum:minimum,max:negative?-minimum:maximum,rarity:rank.id,affix_id:affix.id});
  if(!negative){if(affix.kind==='prefix'&&!prefix)prefix=affix;if(affix.kind==='suffix'&&!suffix)suffix=affix;}
 }
 const baseStats=Object.fromEntries(Object.entries(template.base_stats).map(([stat,value])=>[stat,Math.max(1,Math.round(value*(1+.17*(level-1))*depthMultiplier))]));
 const name=[prefix?.text,template.name,suffix?.text].filter(Boolean).join(' ');
 const price=template.starter?1:template.effect?.kind==='food'?Math.max(8,Math.round(effectFor(template,level).amount*.55)):Math.max(8,Math.round((template.effect?18+template.effect.amount*.5+level*3:45+level*12)*(1+rank.rank*1.4)*(template.set_id?1.35:1)));
 return {id:randomUUID(),template_id:template.id,name,rarity:rank.id,level,slot:template.slot,sprite:template.sprite,category:template.category,class_id:template.class_id,set_id:template.set_id,baseStats,rolls,price,source,generationDepth,depthMultiplier,effect:effectFor(template,level),prefix_id:prefix?.id||null,suffix_id:suffix?.id||null};
}
function rollItem(classId,level,{rng=random,source='merchant',category=null,elite=false,allowUnique=true,depth=level,catalog=C}={}){
 const data=catalog;
 const uniqueSets=data.SETS.filter(s=>s.unique&&s.class_id===classId&&level>=s.min_level&&depth>=s.min_depth);
 if(allowUnique&&source==='monster'&&elite&&uniqueSets.length&&rng()<.001){const set=pick(rng,uniqueSets),template=pick(rng,data.TEMPLATES.filter(t=>t.set_id===set.id));return generateItem(template,{level,depth,rarity:'unique',rng,source,catalog:data});}
 const monster=source==='monster',weights=elite?ELITE_WEIGHTS:MONSTER_WEIGHTS;
 const tiers=data.RARITIES.filter(r=>(r.rank<2||level>=MINIMUM_LEVEL[r.rank])&&(!monster||weights[r.id]>0)&&(!monster||!elite||level<4||r.rank>=2));
 let tier=weighted(rng,tiers,r=>monster?weights[r.id]:r.weight*(elite&&r.rank>0?2:1));
 const candidates=data.TEMPLATES.filter(t=>!t.starter&&(!t.set_id||!data.SETS.find(s=>s.id===t.set_id)?.unique)&&(!t.class_id||t.class_id===classId)&&t.min_level<=level&&(!category||t.category===category));
 const sets=candidates.filter(t=>t.set_id);let ordinary=candidates.filter(t=>!t.set_id&&(tier.rank===0||!t.effect));if(!ordinary.length){tier=data.RARITIES[0];ordinary=candidates.filter(t=>!t.set_id);}
 const setChosen=sets.length&&tier.rank>=2&&rng()<(elite?.24:.10);
 const template=pick(rng,setChosen?sets:ordinary);
 if(template.effect)tier=data.RARITIES[0];
 return generateItem(template,{level,depth,rarity:tier.id,rng,source,catalog:data});
}
const insertItem=(db,hero,item,location='inventory')=>{
 db.prepare(`INSERT INTO item_instances(id,character_id,template_id,name,rarity_id,item_level,base_stats,rolls,prefix_id,suffix_id,price,source,location,created_at,generation_depth,depth_multiplier)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(item.id,hero,item.template_id,item.name,item.rarity,item.level,JSON.stringify(item.baseStats),JSON.stringify(item.rolls),item.prefix_id,item.suffix_id,item.price,item.source,location,new Date().toISOString(),item.generationDepth||1,item.depthMultiplier||1);return item.id;
};
module.exports={random,integer,pick,weighted,generateItem,rollItem,insertItem,effectFor};
