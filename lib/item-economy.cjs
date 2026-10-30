'use strict';

const salePrice = price => Math.max(1, Math.floor(price * .25));
const equipmentPrice = (level,rank,isSet=false) => Math.max(8,Math.round((45+level*12)*(1+rank*1.4)*(isSet?1.35:1)));

module.exports = { salePrice, equipmentPrice };
