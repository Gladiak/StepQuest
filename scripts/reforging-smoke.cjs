'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({name:'reforging',audit:require('./reforging-ui-audit.cjs'),hero:{name:'Thorin',classId:'guardian',sex:'male'},captureDelay:120});
