'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({name:'comparisons',audit:require('./comparison-ui-audit.cjs'),hero:{name:'Elara',classId:'guardian',sex:'female'},captureDelay:120});
