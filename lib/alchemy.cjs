'use strict';
const {createHash}=require('node:crypto');
const {REAGENTS,RECIPES,DROP_RATES,recipeCost,rollOptions,rollReagent}=require('./alchemy-catalog.cjs');
const {isUuid}=require('./validation.cjs');
function createAlchemy({db,rng,ownItem,requireUsable,atHome,money,GameError}){
 db.exec(`CREATE TABLE IF NOT EXISTS alchemy_migrations(version INTEGER PRIMARY KEY) STRICT;`);
 const version=db.prepare('SELECT max(version) AS version FROM alchemy_migrations').get().version||0;
 if(version>1)throw new Error('Versione alchimia non supportata.');
 if(!version){db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE reagent_inventory(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,reagent_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(character_id,reagent_id)) STRICT;
 CREATE TABLE alchemy_attempts(id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,item_id TEXT NOT NULL REFERENCES item_instances(id) ON DELETE CASCADE,recipe_id TEXT NOT NULL,fingerprint TEXT NOT NULL,cost INTEGER NOT NULL,ingredients TEXT NOT NULL CHECK(json_valid(ingredients)),options TEXT NOT NULL CHECK(json_valid(options)),choice_index INTEGER CHECK(choice_index BETWEEN 0 AND 2),created_at TEXT NOT NULL) STRICT;
 CREATE UNIQUE INDEX one_pending_alchemy ON alchemy_attempts(character_id) WHERE choice_index IS NULL;
 CREATE TABLE item_enchantments(item_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,recipe_id TEXT NOT NULL,rolls TEXT NOT NULL CHECK(json_valid(rolls)),created_at TEXT NOT NULL) STRICT;
 INSERT INTO alchemy_migrations VALUES(1);COMMIT;`);}
 const attemptView=row=>row?{id:row.id,itemId:row.item_id,recipeId:row.recipe_id,cost:row.cost,ingredients:JSON.parse(row.ingredients),options:JSON.parse(row.options),choice:row.choice_index}:null;
 const pending=id=>db.prepare('SELECT * FROM alchemy_attempts WHERE character_id=? AND choice_index IS NULL').get(id);
 function enchantment(itemId){const e=db.prepare('SELECT * FROM item_enchantments WHERE item_id=?').get(itemId);return e?{recipeId:e.recipe_id,rolls:JSON.parse(e.rolls),bound:true}:null;}
 function view(id){return {reagents:REAGENTS.map(r=>({...r,quantity:db.prepare('SELECT quantity FROM reagent_inventory WHERE character_id=? AND reagent_id=?').get(id,r.id)?.quantity||0})),recipes:RECIPES,dropRates:DROP_RATES,pending:attemptView(pending(id))};}
 function prepare(id,input){
  atHome(id);if(!isUuid(input?.requestId)||typeof input.itemId!=='string'||typeof input.recipeId!=='string'||typeof input.boost!=='boolean'||typeof input.stabilizer!=='boolean')throw new GameError('Richiesta alchemica non valida.');
  const fingerprint=createHash('sha256').update(JSON.stringify([input.itemId,input.recipeId,input.boost,input.stabilizer])).digest('hex');
  const prior=db.prepare('SELECT * FROM alchemy_attempts WHERE id=?').get(input.requestId);if(prior){if(prior.character_id!==id||prior.fingerprint!==fingerprint)throw new GameError('Richiesta alchemica non valida.');return;}
  if(pending(id))throw new GameError('Scegli prima l’esito della preparazione in sospeso.');
  const item=ownItem(id,input.itemId),recipe=RECIPES.find(r=>r.id===input.recipeId);requireUsable(id,item);
  if(!recipe||item.effect||!['weapon','body','feet','ring','amulet'].includes(item.slot))throw new GameError('Scegli un equipaggiamento utilizzabile e una ricetta.');
  if(enchantment(item.id))throw new GameError('Oggetto già vincolato: non può essere incantato di nuovo.');
  const ingredients=[{id:recipe.key,quantity:1},...(input.boost?[{id:recipe.boost,quantity:1}]:[]),...(input.stabilizer?[{id:recipe.stabilizer,quantity:1}]:[])];
  for(const ingredient of ingredients){const count=db.prepare('SELECT quantity FROM reagent_inventory WHERE character_id=? AND reagent_id=?').get(id,ingredient.id)?.quantity||0;if(count<ingredient.quantity)throw new GameError('Reagenti insufficienti per questa preparazione.');}
  const cost=recipeCost(recipe,item);money(id,'alchemy',-cost,0,'alchemy:'+input.requestId);
  for(const ingredient of ingredients)db.prepare('UPDATE reagent_inventory SET quantity=quantity-? WHERE character_id=? AND reagent_id=?').run(ingredient.quantity,id,ingredient.id);
  const options=rollOptions(recipe,item,{boost:input.boost,stabilizer:input.stabilizer,rng});
  db.prepare('INSERT INTO alchemy_attempts VALUES(?,?,?,?,?,?,?,?,NULL,?)').run(input.requestId,id,item.id,recipe.id,fingerprint,cost,JSON.stringify(ingredients),JSON.stringify(options),new Date().toISOString());
 }
 function apply(id,input){
  atHome(id);if(!isUuid(input?.attemptId)||!Number.isInteger(input.choice)||input.choice<0||input.choice>2)throw new GameError('Scelta alchemica non valida.');
  const attempt=db.prepare('SELECT * FROM alchemy_attempts WHERE id=? AND character_id=?').get(input.attemptId,id);if(!attempt)throw new GameError('Preparazione alchemica non trovata.');
  if(attempt.choice_index!==null){if(attempt.choice_index!==input.choice)throw new GameError('Incantamento già scelto e definitivo.');return;}
  const item=ownItem(id,attempt.item_id);requireUsable(id,item);if(enchantment(item.id))throw new GameError('Oggetto già vincolato: non può essere incantato di nuovo.');
  const option=JSON.parse(attempt.options)[input.choice];db.prepare('INSERT INTO item_enchantments VALUES(?,?,?,?,?)').run(item.id,id,attempt.recipe_id,JSON.stringify(option.rolls),new Date().toISOString());
  db.prepare('UPDATE alchemy_attempts SET choice_index=? WHERE id=?').run(input.choice,attempt.id);
 }
 function award(id,enemy){
  const r=rollReagent(enemy,rng);if(!r)return [];
  db.prepare('INSERT INTO reagent_inventory VALUES(?,?,1) ON CONFLICT(character_id,reagent_id) DO UPDATE SET quantity=quantity+1').run(id,r.id);return [{id:r.id,name:r.name,quantity:1}];
 }
 return {view,prepare,apply,award,enchantment,pending};
}
module.exports={createAlchemy};
