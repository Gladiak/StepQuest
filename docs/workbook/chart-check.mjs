import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const start = performance.now();
const noRender = process.argv.includes('--no-render');
const scale = process.argv.includes('--scale');
const diamondRows = Number(process.argv.find(x=>x.startsWith('--diamond='))?.split('=')[1] || 0);
const wb = Workbook.create();
if(process.argv.includes('--help-export')) {
 console.log(wb.help('SpreadsheetFile.exportXlsx',{include:'index,examples,notes',maxChars:5000}).ndjson);
 process.exit(0);
}
const s = wb.worksheets.add('Tiny chart');
s.showGridLines = false;
s.getRange('A1:L25').format.font = {name:'Arial',size:10,color:'#20372D'};
s.getRange('A1:L25').format.columnWidth = 12;
s.getRange('A1:L25').format.rowHeight = 22;
s.getRange('A1').values = [['Native chart check']];
s.getRange('A3:B6').values = [
  ['Giorno','Saldo'],
  [1,100],
  [2,250],
  [3,180],
];
s.getRange('A3:B3').format = {fill:'#20372D',font:{name:'Arial',size:10,color:'#FFFFFF',bold:true}};
const chart = s.charts.add('line',[s.getRange('A3:A6'),s.getRange('B3:B6')]);
chart.title = 'Saldo disponibile (crediti)';
chart.setPosition('E3','L21');
chart.hasLegend = false;
chart.titleTextStyle.typeface = 'Arial';
chart.titleTextStyle.fontSize = 13;
chart.series.items[0].line = {fill:'#658B47',style:'solid',width:2};
chart.xAxis = {axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:10}};
chart.yAxis = {numberFormatCode:'#,##0',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:10}};
if (scale) {
  for (let n=0;n<10;n++) {
    const m=wb.worksheets.add(`Model ${n}`);
    m.getRange('A1:T70').format.font={name:'Arial',size:10,color:'#20372D'};
    m.getRange('A1:T70').format.rowHeight=23;
    m.getRange('A1:T70').format.columnWidth=14;
    for (let i=1;i<=100;i++) {
      m.getRange(`A${i}`).values=[[i]];
      m.getRange(`B${i}`).formulas=[[i===1 ? "='Tiny chart'!$B$4" : `=B${i-1}+'Tiny chart'!$B$4`]];
    }
    m.getRange('B1:B100').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FBE3DB',font:{color:'#9C3927'}}});
    m.dataValidations.add({range:'D1',rule:{type:'whole',operator:'between',formula1:1,formula2:3}});
  }
  for (const value of [0,8000,1000,3800,100]) {
    s.getRange('B4').values=[[value]];wb.recalculate();
  }
}
if(diamondRows){
 const d=wb.worksheets.add('Diamond');
 d.getRange('A1').values=[[1]];
 for(let i=2;i<=diamondRows;i++) d.getRange(`A${i}`).formulas=[[`=A${i-1}+A${i-1}`]];
}
wb.recalculate();
const built = performance.now();
if(!noRender) {
 const png = await wb.render({sheetName:'Tiny chart',range:'A1:L25',scale:1.3,format:'png'});
 await fs.writeFile('/tmp/stepquest-chart-check.png',new Uint8Array(await png.arrayBuffer()));
}
const rendered = performance.now();
console.log(JSON.stringify({stage:'beforeExport',diamondRows,buildMs:Math.round(built-start)}));
const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(`/tmp/stepquest-chart-check${noRender?'-no-render':''}${scale?'-scale':''}.xlsx`);
const end = performance.now();
console.log(JSON.stringify({noRender,scale,buildMs:Math.round(built-start),renderMs:Math.round(rendered-built),exportMs:Math.round(end-rendered),series:chart.series.items.map(x=>({formula:x.formula,categoryFormula:x.categoryFormula}))},null,2));
if(!noRender){
 const partial = await wb.render({sheetName:'Tiny chart',range:'A1:L15',scale:1.3,format:'png'});
 await fs.writeFile('/tmp/stepquest-chart-partial.png',new Uint8Array(await partial.arrayBuffer()));
}
const p = wb.worksheets.add('Parametri');
p.getRange('A1:B3').values = [['Base',100],['Crescita',150],['Calo',70]];
s.getRange('B4:B6').formulas = [["='Parametri'!B1"],["=B4+'Parametri'!B2"],["=B5-'Parametri'!B3"]];
wb.recalculate();
if(!noRender){
 const formulas = await wb.render({sheetName:'Tiny chart',range:'A1:L25',scale:1.3,format:'png'});
 await fs.writeFile('/tmp/stepquest-chart-formulas.png',new Uint8Array(await formulas.arrayBuffer()));
}
console.log(JSON.stringify({formulaValues:s.getRange('B4:B6').values,partialPng:'/tmp/stepquest-chart-partial.png',formulaPng:'/tmp/stepquest-chart-formulas.png'}));
