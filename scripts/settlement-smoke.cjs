'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({
 name:'settlement',audit:require('./settlement-audit.cjs'),
 hero:{name:'Thorin',classId:'guardian',sex:'male'},captureDelay:100
});
