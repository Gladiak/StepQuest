'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({name:'merchant',audit:require('./merchant-ui-audit.cjs'),hero:{name:'Elara',classId:'guardian',sex:'female'}});
