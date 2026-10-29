-- Query di sola lettura per ispezionare stepquest.sqlite.
SELECT id,name,min_properties,max_properties,roll_scale,color_light,color_dark FROM item_rarities ORDER BY rank;
SELECT stat,unit,operation,bonus_min,bonus_max,malus_min,malus_max FROM attribute_definitions ORDER BY stat,unit;
SELECT a.name,a.kind,r.attribute_id,r.sign,r.min_value,r.max_value,r.chance FROM affix_definitions a JOIN affix_ranges r ON r.affix_id=a.id ORDER BY a.kind,a.name,r.sign DESC;
SELECT slot,count(*) AS modelli FROM item_templates GROUP BY slot;
SELECT s.name,s.class_id,b.pieces,a.label,b.value,b.rarity_id FROM item_sets s JOIN set_bonuses b ON b.set_id=s.id JOIN attribute_definitions a ON a.id=b.attribute_id ORDER BY s.class_id,s.min_level,b.pieces;
-- Proprietà estratte e relative bande, senza leggere credenziali.
SELECT i.name,i.rarity_id,json_extract(p.value,'$.attribute_id') AS attributo,json_extract(p.value,'$.value') AS valore,json_extract(p.value,'$.min') AS minimo,json_extract(p.value,'$.max') AS massimo FROM item_instances i JOIN json_each(i.rolls) p WHERE i.location='inventory';
SELECT c.name,i.name,e.slot FROM equipped_items e JOIN characters c ON c.id=e.character_id JOIN item_instances i ON i.id=e.item_id;
SELECT kind,sum(steps_delta) AS passi,sum(coins_delta) AS monete FROM wallet_events GROUP BY kind;
SELECT id,value FROM game_rules ORDER BY id;
