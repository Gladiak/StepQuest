'use strict';
window.StepQuestI18n=(()=>{
 const languages=Object.freeze({it:'Italiano',en:'English',fr:'Français',es:'Español',de:'Deutsch',ja:'日本語'});
 const tags={it:'it-IT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE',ja:'ja-JP'};
 const key='stepquest.language',records=new WeakMap(),attributes=new WeakMap();
 let language='it';try{const saved=localStorage.getItem(key);if(Object.hasOwn(languages,saved))language=saved;}catch{/* Private storage may be unavailable; the session still works. */}
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const dictionaries=new Map();
 for(const [index,locale]of Object.keys(languages).entries()){
  if(!index)continue;
  const phrases=new Map(),patterns=[];
  for(const row of window.StepQuestTranslations){
   if(row.length!==6||row.some(value=>!value))throw new Error('Invalid translation row: '+row[0]);
   const [source]=row,target=row[index];
   if(source.includes('{')){
    const captures=[];const numeric='([+−-]?[\\p{N}]+(?:[.,\\u202f\\u00a0][\\p{N}]+)*)';const expression=source.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?(captures.push(part),source.startsWith('Stai per eliminare')?'(.+?)':numeric):escape(part)).join('');
    patterns.push({expression:new RegExp('^'+expression+'$','u'),fragment:source.startsWith('Stai per eliminare')?null:expression,source,captures,target});
   }else{phrases.set(source,target);if(!source.includes(' ')&&source.length>2)phrases.set(source[0].toLocaleLowerCase('it-IT')+source.slice(1),target[0].toLocaleLowerCase(tags[locale])+target.slice(1));}
  }
  const ordered=[...phrases.keys()].map(source=>({source,expression:escape(source)})).concat(patterns.filter(p=>p.fragment).map(p=>({source:p.source,expression:p.fragment}))).sort((a,b)=>b.source.length-a.source.length);
  const fragments=new RegExp('(?<![\\p{L}\\p{N}])(?:'+ordered.map(entry=>entry.expression).join('|')+')(?![\\p{L}\\p{N}])','gu');
  dictionaries.set(locale,{phrases,patterns,fragments});
 }
 function translate(source){
  if(source==null)return source;
  if(String(source).includes('\uE000'))return String(source).split(/(\uE000[^\uE001]*\uE001)/u).map(part=>part.startsWith('\uE000')?part.slice(1,-1):translate(part)).join('');
  if(language==='it')return source;
  const value=String(source),d=dictionaries.get(language);
  if(d.phrases.has(value))return d.phrases.get(value);
  for(const p of d.patterns){const match=value.match(p.expression);if(match)return p.target.replace(/\{\d+\}/g,token=>match[p.captures.indexOf(token)+1]);}
  return value.replace(d.fragments,part=>{if(d.phrases.has(part))return d.phrases.get(part);for(const p of d.patterns){const match=part.match(p.expression);if(match)return p.target.replace(/\{\d+\}/g,token=>match[p.captures.indexOf(token)+1]);}return part;});
 }
 function text(node,source){const input=String(source),output=translate(input);node.textContent=output;if(node.firstChild)records.set(node.firstChild,{source:input,output});}
 function updateText(node){if(!node.textContent.trim()||node.parentElement?.closest('[data-i18n-skip],script,style'))return;const before=records.get(node),source=before?.output===node.textContent?before.source:node.textContent,output=translate(source);if(output!==node.textContent)node.textContent=output;records.set(node,{source,output});}
 function updateAttributes(node){if(node.closest('[data-i18n-skip]'))return;let saved=attributes.get(node);if(!saved){saved={};attributes.set(node,saved);}for(const name of ['title','placeholder','aria-label','aria-valuetext','alt','data-creator-caption']){const value=node.getAttribute(name);if(!value)continue;const before=saved[name],source=before?.output===value?before.source:value,output=translate(source);if(output!==value)node.setAttribute(name,output);saved[name]={source,output};}}
 function apply(root=document.body){if(root.nodeType===Node.TEXT_NODE){updateText(root);return;}if(root.nodeType!==Node.ELEMENT_NODE)return;updateAttributes(root);const walk=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);for(let node;node=walk.nextNode();)if(node.nodeType===Node.TEXT_NODE)updateText(node);else updateAttributes(node);}
 function setLanguage(value){if(!Object.hasOwn(languages,value))throw new Error('Unsupported language');language=value;try{localStorage.setItem(key,value);}catch{}document.documentElement.lang=value;window.stepquest?.setLanguage?.(value);apply();document.dispatchEvent(new CustomEvent('stepquest:language',{detail:value}));}
 document.documentElement.lang=language;window.stepquest?.setLanguage?.(language);
 // The renderer also updates status text and accessibility hints directly after API calls.
 const observer=new MutationObserver(changes=>{for(const change of changes){if(change.type==='characterData')apply(change.target);else if(change.type==='attributes')updateAttributes(change.target);else for(const node of change.addedNodes)apply(node);}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','aria-valuetext','alt','data-creator-caption']});
 apply();
 return Object.freeze({languages,translate,text,apply,setLanguage,verbatim:value=>'\uE000'+String(value).replace(/[\uE000\uE001]/g,'')+'\uE001',get language(){return language;},get locale(){return tags[language];}});
})();
