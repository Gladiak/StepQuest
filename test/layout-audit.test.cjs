'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),audit=require('../scripts/layout-audit.cjs');
function page({clamp='none',clipBottom=46}={}){
 const label={getBoundingClientRect:()=>({top:20,bottom:clipBottom,left:0,right:100})},text={textContent:'A long equipment name',parentElement:label};
 const button={className:'test-button',getBoundingClientRect:()=>({top:0,bottom:50,left:0,right:100,width:100,height:50}),closest:()=>null};
 const document={querySelectorAll:selector=>selector==='button'?[button]:[],querySelector:()=>null,createTreeWalker:()=>{let visited=false;return {nextNode:()=>visited?null:(visited=true,text)};},createRange:()=>({selectNodeContents(){},getClientRects:()=>[20,33,46].map(top=>({top,bottom:top+13,left:0,right:100}))})};
 const context=vm.createContext({document,NodeFilter:{SHOW_TEXT:4},getComputedStyle:element=>element===label?{webkitLineClamp:clamp,overflowY:'hidden',textOverflow:'clip'}:{borderLeftWidth:'0',borderRightWidth:'0',borderTopWidth:'0',borderBottomWidth:'0',paddingLeft:'0',paddingRight:'0',paddingTop:'0',paddingBottom:'0'}});
 return {webContents:{executeJavaScript:async code=>JSON.parse(JSON.stringify(vm.runInContext(code,context)))}};
}
test('layout audit excludes text lines intentionally hidden by a two-line clamp',async()=>{const result=await audit(page({clamp:'2'}),'clamped');assert.equal(result.controls,1);});
test('layout audit still rejects ordinary text overflowing its button',async()=>{await assert.rejects(audit(page(),'overflow'),/button-text-height/);});
test('layout audit still rejects visible clamped lines outside their button',async()=>{await assert.rejects(audit(page({clamp:'2',clipBottom:59}),'visible overflow'),/button-text-height/);});
