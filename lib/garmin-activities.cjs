'use strict';
const {validDate}=require('./dates.cjs');
const TYPES={walk:new Set(['walking','hiking','speed_walking','casual_walking','indoor_walking','wheelchair_push_walk']),run:new Set(['running','trail_running','treadmill_running','track_running','indoor_running','virtual_run','ultra_run','wheelchair_push_run']),cycle:new Set(['cycling','road_biking','mountain_biking','indoor_cycling','virtual_ride','gravel_cycling','cyclocross','recumbent_cycling','hand_cycling','bmx','e_bike_fitness','e_bike_mountain']),swim:new Set(['swimming','lap_swimming','open_water_swimming','pool_swimming'])};
const kindFor=key=>Object.keys(TYPES).find(kind=>TYPES[kind].has(key))||'other';
function normalizeActivity(row,{from,to,now}){
 if(!row||typeof row!=='object')throw new Error('Riepilogo attività non valido.');
 // Ignore manual entries and multisport children before they enter the ledger.
 if(row.manualActivity===true||row.parentId!=null&&row.parentId!==0)return null;
 const id=Number.isSafeInteger(row.activityId)&&row.activityId>0?String(row.activityId):null;
 if(!id||typeof row.startTimeLocal!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(row.startTimeLocal)||typeof row.startTimeGMT!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(row.startTimeGMT))throw new Error('Identificativo o data attività non validi.');
 const date=validDate(row.startTimeLocal.slice(0,10)),utc=row.startTimeGMT.replace(' ','T')+'Z',startedAt=Date.parse(utc);
 const local=row.startTimeLocal.replace(' ','T'),localAt=Date.parse(local+'Z');
 if(!Number.isFinite(localAt)||new Date(localAt).toISOString().slice(0,19)!==local)throw new Error('Data locale attività non valida.');
 if(!Number.isFinite(startedAt)||new Date(startedAt).toISOString().slice(0,19)!==utc.slice(0,19))throw new Error('Data UTC attività non valida.');
 const durationSeconds=row.duration,elapsed=row.elapsedDuration??durationSeconds;
 if(!Number.isFinite(durationSeconds)||durationSeconds<0||durationSeconds>86400||!Number.isFinite(elapsed)||elapsed<durationSeconds||elapsed>7*86400)throw new Error('Durata attività non valida.');
 const endedAt=startedAt+elapsed*1000;
 if(date<from||date>to||endedAt>now+60000)return null;
 const measure=value=>value==null?null:typeof value==='number'&&Number.isFinite(value)&&value>=0?value:NaN;
 const distanceMeters=measure(row.distance),elevationMeters=measure(row.elevationGain);
 if(Number.isNaN(distanceMeters)||Number.isNaN(elevationMeters))throw new Error('Misure attività non valide.');
 return {id,date,startedAt,endedAt,kind:kindFor(row.activityType?.typeKey),durationSeconds,distanceMeters,elevationMeters};
}
module.exports={normalizeActivity,kindFor};
