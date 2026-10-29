'use strict';
function validDate(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)
    || !Number.isFinite(Date.parse(`${day}T12:00:00Z`))
    || new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new Error('Data non valida. Usa il formato AAAA-MM-GG.');
  }
  return day;
}
function shiftDate(day, offset) {
  const date = new Date(`${validDate(day)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function dateRange(from, to, maxDays = 366) {
  validDate(from); validDate(to);
  const length = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
  if (length < 1 || length > maxDays) throw new Error(`Scegli un intervallo da 1 a ${maxDays} giorni.`);
  return Array.from({ length }, (_, i) => shiftDate(from, i));
}
function today(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
}
module.exports = { validDate, shiftDate, dateRange, today };
