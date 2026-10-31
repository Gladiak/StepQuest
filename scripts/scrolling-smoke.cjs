'use strict';
const {featureSmoke}=require('./smoke-harness.cjs');
module.exports=featureSmoke({name:'scrolling',audit:require('./scrolling-ui-audit.cjs'),hero:{name:'Elara',classId:'guardian',sex:'female'}});
