'use strict';
const $ = id => document.getElementById(id);
const api = window.stepquest;
const number = new Intl.NumberFormat('it-IT');
const state = { data: null, status: null, busy: false };
const dateFormat = (date, options = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('it-IT', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const shiftDate = (day, offset) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
function showNotice(message, error = false) {
  $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message;
}
function setBusy(value) {
  state.busy = value; document.body.classList.toggle('busy', value);
  for (const element of document.querySelectorAll('.toolbar button, .toolbar input, #refresh-button, #export-button, #save-key, #settings-button')) element.disabled = value;
  $('export-button').disabled = value || !state.data?.cache?.storedDays; $('chart').setAttribute('aria-busy', String(value));
}
function unwrap(result) {
  if (!result.ok) { const error = new Error(result.error.message); error.code = result.error.code; throw error; }
  return result.value;
}
function updateStatus(status) {
  state.status = status;
  $('today-label').textContent = dateFormat(status.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('sidebar-dot').classList.toggle('connected', status.tokenValid);
  $('sidebar-status').textContent = status.tokenValid ? 'Collegato al tuo account' : status.configured ? 'Chiave configurata' : 'Da collegare';
  $('key-status').textContent = [status.configured ? 'Chiave configurata.' : 'Nessuna chiave configurata.', status.tokenValid ? `Token valido fino al ${new Date(status.expiresAt).toLocaleString('it-IT')}.` : '', status.storage === 'sqlite' ? 'Chiave salvata nel database SQLite locale.' : '', status.storageNotice, status.sqlite ? 'Passi salvati in SQLite sul computer, disponibili offline.' : '', `Date nel fuso ${status.timeZone}.`].filter(Boolean).join(' ');
}
function selectedPeriod(days) {
  for (const button of document.querySelectorAll('[data-period]')) {
    const selected = Number(button.dataset.period) === days;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  }
}
function validateDates() {
  const from = $('from-date').value, to = $('to-date').value;
  if (!from || !to || !$('from-date').checkValidity() || !$('to-date').checkValidity()) throw new Error('Seleziona due date valide.');
  const length = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
  if (length < 1 || length > 366) throw new Error('Scegli un intervallo da 1 a 366 giorni.');
  if (to > state.status.today) throw new Error('La data finale non può essere nel futuro.');
  return { from, to };
}
async function download() {
  if (state.busy) return;
  setBusy(true);
  try {
    updateStatus(unwrap(await api.status()));
    $('from-date').max = $('to-date').max = state.status.today;
    const { from, to } = validateDates();
    // La query locale non dipende dalla rete: rende subito navigabile lo storico.
    const cached = unwrap(await api.cache(from, to));
    state.data = cached; render(cached);
    $('sidebar-status').textContent = cached.cache.storedDays ? 'Archivio locale disponibile' : 'Verifica connessione…';
    showNotice(cached.cache.storedDays ? `Archivio locale: ${cached.cache.storedDays}/${cached.cache.requestedDays} giorni scaricati. Verifica aggiornamenti Garmin in corso…` : 'Sincronizzazione con Garmin in corso…');
    const result = unwrap(await api.download(from, to));
    state.data = result; updateStatus(result.status); render(result);
    const count = result.days.filter(row => row.steps !== null).length;
    if (result.source === 'cache') {
      $('sidebar-status').textContent = 'Archivio locale · non aggiornato';
      $('sidebar-dot').classList.remove('connected');
      showNotice(`Garmin non aggiornato: ${result.sync.error.message} Mostro l’archivio locale (${result.cache.storedDays}/${result.cache.requestedDays} giorni scaricati).`, true);
      document.body.dataset.state = 'offline';
    } else {
      showNotice(count ? state.status.storageNotice : 'Nessun dato nel periodo. Sincronizza il dispositivo con Garmin Connect e riprova.');
      document.body.dataset.state = 'loaded';
    }
  } catch (error) {
    showNotice(error.message + (state.data?.cache?.storedDays ? ' Restano visibili i dati locali del periodo indicato.' : ' Non ci sono dati scaricati per questo periodo.'), true);
    document.body.dataset.state = 'error';
    if (error.code === 'NO_KEY' && !state.data?.cache?.storedDays) $('settings-dialog').showModal();
    try { updateStatus(unwrap(await api.status())); } catch { /* L’errore principale resta visibile. */ }
  } finally { setBusy(false); }
}
function setMetric(id, value, unit) {
  const small = document.createElement('small'); small.textContent = unit;
  $(id).replaceChildren(document.createTextNode(value), small);
}
function render(result) {
  const available = result.days.filter(row => row.steps !== null);
  const total = available.reduce((sum, row) => sum + row.steps, 0);
  const withGoal = available.filter(row => row.goal > 0);
  const reached = withGoal.filter(row => row.steps >= row.goal);
  $('total-steps').textContent = available.length ? number.format(total) : '—';
  $('coverage').textContent = `${available.length} di ${result.days.length} giorni con dati`;
  setMetric('average-steps', available.length ? number.format(Math.round(total / available.length)) : '—', 'passi');
  setMetric('goals-count', withGoal.length ? number.format(reached.length) : '—', 'giorni');
  $('goals-note').textContent = withGoal.length ? `Su ${withGoal.length} giorni con obiettivo disponibile` : 'Obiettivo Garmin non disponibile';
  $('chart-period').textContent = `${dateFormat(result.from, { day: 'numeric', month: 'long' })} — ${dateFormat(result.to, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const stamp = value => new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  $('sync-time').textContent = result.fetchedAt ? `${result.source === 'cache' ? 'Archivio locale' : 'Salvato in SQLite'} · ${result.cache.storedDays}/${result.cache.requestedDays} giorni scaricati · ${result.cache.oldestFetchedAt === result.cache.newestFetchedAt ? stamp(result.fetchedAt) : `${stamp(result.cache.oldestFetchedAt)} — ${stamp(result.cache.newestFetchedAt)}`}` : 'Nessun giorno scaricato in questo periodo';
  drawChart(result.days); drawTable(result.days);
  const best = available.reduce((record, row) => !record || row.steps > record.steps ? row : record, null);
  $('best-steps').textContent = best ? `${number.format(best.steps)} passi.` : 'Il tuo percorso ti aspetta.';
  $('best-note').textContent = best ? `${dateFormat(best.date, { weekday: 'long', day: 'numeric', month: 'long' })}: il giorno più attivo tra quelli con dati nel periodo.` : 'Non ci sono ancora passi disponibili in questo intervallo.';
}
function svgElement(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function drawChart(days) {
  const width = 850, height = 224, left = 48, right = 16, top = 18, bottom = 34;
  const plotW = width - left - right, plotH = height - top - bottom;
  const maxValue = Math.max(1000, ...days.flatMap(row => [row.steps ?? 0, row.goal ?? 0]));
  const upper = Math.ceil(maxValue / 4000) * 4000;
  const y = value => top + plotH * (1 - value / upper);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'chart-title chart-description', preserveAspectRatio: 'none' });
  svg.append(svgElement('title', { id: 'chart-title' }, 'Passi e obiettivo giornaliero Garmin'), svgElement('desc', { id: 'chart-description' }, 'Barre dei passi giornalieri. Tratteggio: obiettivo Garmin. I valori precisi sono nel diario sottostante.'));
  for (let i = 0; i <= 4; i++) {
    const value = upper * i / 4;
    svg.append(svgElement('line', { x1: left, x2: width - right, y1: y(value), y2: y(value), stroke: '#edf0e7', 'stroke-width': 1 }));
    svg.append(svgElement('text', { x: left - 12, y: y(value) + 3, fill: '#9ba58e', 'text-anchor': 'end', 'font-size': 9, 'font-family': 'sans-serif' }, value === 0 ? '0' : `${number.format(value / 1000)}k`));
  }
  const slot = plotW / days.length, barWidth = Math.min(43, slot * .56);
  const labelsEvery = Math.max(1, Math.ceil(days.length / 12));
  days.forEach((row, index) => {
    const center = left + slot * (index + .5), group = svgElement('g', {});
    group.append(svgElement('title', {}, `${dateFormat(row.date)}: ${row.steps === null ? 'nessun dato' : `${number.format(row.steps)} passi`}${row.goal ? `, obiettivo ${number.format(row.goal)}` : ''}`));
    if (row.steps !== null) group.append(svgElement('rect', { x: center - barWidth / 2, y: y(row.steps), width: barWidth, height: Math.max(1, plotH * row.steps / upper), rx: Math.min(4, barWidth / 3), fill: row.date === state.status.today ? '#385b36' : '#c8df9d' }));
    else group.append(svgElement('text', { x: center, y: y(0) - 8, 'text-anchor': 'middle', fill: '#c4ccb9', 'font-size': 11 }, '·'));
    if (row.goal > 0) group.append(svgElement('line', { x1: center - slot * .43, x2: center + slot * .43, y1: y(row.goal), y2: y(row.goal), stroke: '#8fa675', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
    if (index % labelsEvery === 0 || index === days.length - 1 && days.length < 15) group.append(svgElement('text', { x: center, y: height - 11, 'text-anchor': 'middle', fill: row.date === state.status.today ? '#476039' : '#9ba38e', 'font-size': 9, 'font-family': 'sans-serif' }, days.length <= 7 ? dateFormat(row.date, { weekday: 'short', day: 'numeric' }) : dateFormat(row.date)));
    svg.append(group);
  });
  $('chart').replaceChildren(svg);
}
function drawTable(days) {
  const fragment = document.createDocumentFragment();
  for (const row of [...days].reverse()) {
    const tr = document.createElement('tr');
    const date = document.createElement('td'); date.textContent = dateFormat(row.date, { weekday: 'short', day: 'numeric', month: 'short' });
    if (row.date === state.status.today) { const tag = document.createElement('span'); tag.className = 'row-today'; tag.textContent = 'OGGI'; date.append(tag); }
    const steps = document.createElement('td'); steps.textContent = row.steps === null ? '—' : number.format(row.steps);
    const goal = document.createElement('td'); goal.textContent = row.goal === null ? '—' : number.format(row.goal);
    const progress = document.createElement('td');
    if (row.steps !== null && row.goal > 0) {
      const wrap = document.createElement('div'); wrap.className = 'progress-cell';
      const ratio = Math.round(row.steps / row.goal * 100);
      const meter = document.createElement('progress'); meter.className = 'step-progress'; meter.max = 100; meter.value = Math.min(100, ratio); meter.setAttribute('aria-label', 'Progresso obiettivo');
      const value = document.createElement('span'); value.textContent = ratio >= 100 ? `${number.format(ratio)}% ✓` : `${number.format(ratio)}%`;
      if (ratio >= 100) value.className = 'goal-check';
      wrap.append(meter, value); progress.append(wrap);
    } else progress.textContent = row.availability === 'not_downloaded' ? 'Non scaricato' : row.steps === null ? 'Nessun dato Garmin' : '—';
    tr.append(date, steps, goal, progress); fragment.append(tr);
  }
  $('history-body').replaceChildren(fragment);
}
function openSettings() { $('key-error').hidden = true; $('api-key').value = ''; $('settings-dialog').showModal(); }
$('settings-button').addEventListener('click', openSettings);
for (const id of ['close-settings', 'cancel-settings']) $(id).addEventListener('click', () => { if (!state.busy) $('settings-dialog').close(); });
$('settings-dialog').addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
$('settings-dialog').addEventListener('close', () => { $('api-key').value = ''; });
$('key-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  setBusy(true); $('key-error').hidden = true; $('save-key').textContent = 'Verifica in corso…';
  try {
    const result = unwrap(await api.saveKey($('api-key').value));
    state.data = result; updateStatus(result.status); render(result);
    $('api-key').value = ''; $('settings-dialog').close();
  } catch (error) { $('key-error').textContent = error.message; $('key-error').hidden = false; return; }
  finally { setBusy(false); $('save-key').textContent = 'Verifica e collega ↗'; }
  await download();
});
$('refresh-button').addEventListener('click', download);
$('apply-button').addEventListener('click', () => { selectedPeriod(null); download(); });
for (const button of document.querySelectorAll('[data-period]')) button.addEventListener('click', async () => {
  updateStatus(unwrap(await api.status()));
  const days = Number(button.dataset.period);
  $('to-date').value = state.status.today; $('from-date').value = shiftDate(state.status.today, 1 - days);
  selectedPeriod(days); download();
});
for (const id of ['from-date', 'to-date']) $(id).addEventListener('change', () => selectedPeriod(null));
$('export-button').addEventListener('click', async () => {
  setBusy(true);
  try { const result = unwrap(await api.exportCsv()); if (!result.canceled) showNotice('CSV esportato. Buon prossimo passo!'); }
  catch (error) { showNotice(error.message, true); }
  finally { setBusy(false); }
});
$('history-nav').addEventListener('click', () => { $('history-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('history-nav').classList.add('active'); $('overview-nav').classList.remove('active'); });
function showOverview(event) { event?.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); $('overview-nav').classList.add('active'); $('history-nav').classList.remove('active'); }
$('overview-nav').addEventListener('click', showOverview);
document.querySelector('.brand').addEventListener('click', showOverview);
(async () => {
  if (!api) { showNotice('Avvia StepQuest con npm start per usare il collegamento Garmin.', true); return; }
  updateStatus(unwrap(await api.status()));
  $('to-date').value = state.status.today; $('from-date').value = state.status.defaultFrom;
  $('to-date').max = $('from-date').max = state.status.today;
  if (state.status.configured || state.status.accountScopeAvailable) await download();
  else { showNotice('Collega il tuo account Garmin per iniziare.'); document.body.dataset.state = 'unconfigured'; openSettings(); }
})().catch(() => { showNotice('Impossibile inizializzare StepQuest. Riavvia l’app.', true); document.body.dataset.state = 'error'; });
