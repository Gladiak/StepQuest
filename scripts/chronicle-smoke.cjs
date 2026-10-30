'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({
 name:'chronicles',audit:require('./chronicle-audit.cjs'),
 hero:{name:'Elara',classId:'guardian',sex:'female'},captureDelay:120
});
