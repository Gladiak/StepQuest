'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({
 name:'guild',audit:require('./guild-audit.cjs'),
 hero:{name:'Thorin',classId:'guardian',sex:'male'},captureDelay:100
});
