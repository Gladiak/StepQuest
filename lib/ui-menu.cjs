'use strict';
const labels={
 it:['Modifica','Annulla','Ripristina','Taglia','Copia','Incolla','Seleziona tutto','Informazioni su StepQuest','Nascondi StepQuest','Esci da StepQuest'],
 en:['Edit','Undo','Redo','Cut','Copy','Paste','Select All','About StepQuest','Hide StepQuest','Quit StepQuest'],
 fr:['Édition','Annuler','Rétablir','Couper','Copier','Coller','Tout sélectionner','À propos de StepQuest','Masquer StepQuest','Quitter StepQuest'],
 es:['Edición','Deshacer','Rehacer','Cortar','Copiar','Pegar','Seleccionar todo','Acerca de StepQuest','Ocultar StepQuest','Salir de StepQuest'],
 de:['Bearbeiten','Rückgängig','Wiederholen','Ausschneiden','Kopieren','Einfügen','Alles auswählen','Über StepQuest','StepQuest ausblenden','StepQuest beenden'],
 ja:['編集','取り消す','やり直す','切り取り','コピー','貼り付け','すべて選択','StepQuestについて','StepQuestを隠す','StepQuestを終了']
};
function menuTemplate(language='it',platform=process.platform){
 if(!Object.hasOwn(labels,language))throw new Error('Unsupported language');const l=labels[language];
 return [...(platform==='darwin'?[{label:'StepQuest',submenu:[{role:'about',label:l[7]},{type:'separator'},{role:'hide',label:l[8]},{role:'quit',label:l[9]}]}]:[]),{label:l[0],submenu:[{role:'undo',label:l[1]},{role:'redo',label:l[2]},{type:'separator'},{role:'cut',label:l[3]},{role:'copy',label:l[4]},{role:'paste',label:l[5]},{role:'selectAll',label:l[6]}]}];
}
module.exports={menuTemplate};
