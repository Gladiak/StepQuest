'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({
 name:'atlas',audit:require('./atlas-audit.cjs'),
 hero:{name:'Elara',classId:'guardian',sex:'female'},captureDelay:120
});
