'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({name:'runic',audit:require('./runic-ui-audit.cjs'),hero:{name:'Elara',classId:'guardian',sex:'female'},captureDelay:120});
