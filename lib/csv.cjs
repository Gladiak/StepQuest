'use strict';
function stepsCsv(result) {
  return '\uFEFFdata;passi;obiettivo_passi;distanza_metri\r\n' + result.days.map(row =>
    [row.date, row.steps, row.goal, row.distanceMeters].map(value => value ?? '').join(';')
  ).join('\r\n') + '\r\n';
}
module.exports = { stepsCsv };
