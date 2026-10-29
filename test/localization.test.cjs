'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function load(saved='it'){
 const store=new Map([['stepquest.language',saved]]),body={nodeType:1,closest:()=>false,getAttribute:()=>null},document={body,documentElement:{},createTreeWalker:()=>({nextNode:()=>null}),dispatchEvent:()=>{}};
 const context=vm.createContext({window:{},document,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},MutationObserver:class{observe(){}},Node:{ELEMENT_NODE:1,TEXT_NODE:3},NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},CustomEvent:class{}});
 for(const file of ['locales','i18n'])vm.runInContext(fs.readFileSync(`renderer/${file}.js`,'utf8'),context);
 return {i18n:context.window.StepQuestI18n,rows:context.window.StepQuestTranslations,document,store};
}
test('all six languages have complete catalog entries and preserve interpolated player data',()=>{
 const {i18n,rows,document,store}=load();assert.equal(Object.keys(i18n.languages).length,6);assert.ok(rows.length>300);
 const keys=new Set();for(const row of rows){assert.equal(row.length,6,row[0]);assert.equal(keys.has(row[0]),false,row[0]);keys.add(row[0]);const parameters=[...row[0].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();for(const value of row.slice(1))assert.deepEqual([...value.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),parameters,row[0]);}
 for(const language of Object.keys(i18n.languages)){i18n.setLanguage(language);assert.equal(document.documentElement.lang,language);assert.equal(store.get('stepquest.language'),language);assert.ok(i18n.translate('Stai per eliminare Vita, equipaggiamento e progressi. Il saldo passi di questo eroe verrà eliminato. Gli altri personaggi non sono coinvolti. Questa storia non potrà essere recuperata.').includes('Vita'));assert.ok(i18n.translate('Convertiti 1.000 passi in 400 monete.').includes('1.000'));assert.equal(i18n.translate('StepQuest'),'StepQuest');}
 assert.throws(()=>i18n.setLanguage('xx'));
});
test('saved language restores and unknown preference falls back to Italian',()=>{assert.equal(load('ja').i18n.language,'ja');assert.equal(load('xx').i18n.language,'it');});
test('game catalog labels, affixes, classes, rarities, routes and every set have translations',()=>{
 const {rows}=load(),keys=new Set(rows.map(row=>row[0])),catalog=require('../lib/game-catalog.cjs'),{ROUTES}=require('../lib/expedition-catalog.cjs');
 const values=[...Object.values(catalog.CLASSES),...Object.values(catalog.SLOTS),...Object.values(catalog.STAT_DEFINITIONS).map(x=>x.label),...catalog.RARITIES.map(x=>x.name),...catalog.AFFIXES.map(x=>x.text),...catalog.SETS.map(x=>x.name),...catalog.ENEMIES.map(x=>x.name),...ROUTES.flatMap(x=>[x.name,x.risk,x.description])];
 for(const value of values)assert.ok(keys.has(value),value);
});
test('composed UI text uses longest phrases and numeric interpolation without translating injected player names',()=>{
 const {i18n}=load('en');assert.equal(i18n.translate('22 oggetti · dettagli al passaggio del mouse'),'22 items · hover for details');assert.equal(i18n.translate('Attacco: 1 danni.'),'Attack: 1 damage.');assert.equal(i18n.translate('Vigoroso Anello del guado della Sete'),'Vigorous Ring of the Ford of Thirst');
 i18n.setLanguage('ja');assert.equal(i18n.translate('Menu'),'メニュー');
});
test('player-provided names remain verbatim in localized import messages, including Italian',()=>{
 const {i18n}=load();for(const locale of Object.keys(i18n.languages)){i18n.setLanguage(locale);const translated=i18n.translate('100 passi aggiunti a '+i18n.verbatim('Vita Guardiano'));assert.ok(translated.endsWith('Vita Guardiano'));assert.equal(/[\uE000\uE001]/u.test(translated),false);}
});
test('native menus keep editing roles and translated labels in all supported languages',()=>{
 const {menuTemplate}=require('../lib/ui-menu.cjs');for(const language of ['it','en','fr','es','de','ja']){const menu=menuTemplate(language,'darwin');assert.equal(menu.length,2);assert.deepEqual(menu[1].submenu.filter(item=>item.role).map(item=>item.role),['undo','redo','cut','copy','paste','selectAll']);assert.equal(menu[0].submenu.at(-1).role,'quit');}assert.throws(()=>menuTemplate('invalid'));
});
test('alchemy recipes and every reagent are translated in all languages',()=>{const keys=new Set(load().rows.map(row=>row[0])),{REAGENTS,RECIPES}=require('../lib/alchemy-catalog.cjs');for(const entry of [...REAGENTS,...RECIPES])assert.ok(keys.has(entry.name),entry.name);});
