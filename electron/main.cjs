'use strict';
const { app, BrowserWindow, ipcMain, protocol, session, dialog, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createGarminClient, GarminError } = require('../lib/garmin.cjs');
const { today, shiftDate, dateRange } = require('../lib/dates.cjs');
const { stepsCsv } = require('../lib/csv.cjs');
const { createStepsRepository } = require('../lib/steps-repository.cjs');
const { createStepsService } = require('../lib/steps-service.cjs');
const { createGameStepsService } = require('../lib/game-steps-service.cjs');
const { createCharactersRepository, CharacterError } = require('../lib/characters.cjs');
const { createCredentialsRepository } = require('../lib/credentials-repository.cjs');
const { createGameRepository, GameError } = require('../lib/game-repository.cjs');
const {prepareSave,restoreSave}=require('../lib/save-protection.cjs');
let characters, credentials, game, activeCharacter=null, sessionStarted=0;
function flushSession(stop=false){
  if(activeCharacter){const seconds=Math.floor((performance.now()-sessionStarted)/1000);if(seconds>0){characters.addTime(activeCharacter,seconds);sessionStarted+=seconds*1000;}}
  if(stop)activeCharacter=null;
}
const sessionTimer=setInterval(()=>flushSession(),15000);sessionTimer.unref();

const APP_URL = 'stepquest://app/index.html';
const smoke = process.argv.includes('--smoke-test');
protocol.registerSchemesAsPrivileged([{ scheme: 'stepquest', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('StepQuest');
let window, client, repository, stepsService, smokeDirectory, snapshot = null, busy = false, storage = 'session', storageNotice = '';
// Chromium chooses its profile before ready; isolate browser preferences as well as SQLite.
if(smoke){smokeDirectory=require('node:fs').mkdtempSync(path.join(os.tmpdir(),'stepquest-smoke-'));app.setPath('userData',smokeDirectory);app.setPath('sessionData',smokeDirectory);}
const ownsInstance=smoke||app.requestSingleInstanceLock();
if(!ownsInstance)app.exit(0);
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});

const buildClient = apiKey => createGarminClient({ apiKey, fetchImpl: (...args) => globalThis.fetch(...args) });
async function persistKey(key) {
  credentials.saveKey(key);
  storage = 'sqlite'; storageNotice = '';
  // Non decifrare il vecchio file: richiederebbe nuovamente il Portachiavi.
  for (const name of ['garmin-key.enc', 'garmin-key.enc.tmp']) {
    try { await fs.unlink(path.join(app.getPath('userData'), name)); }
    catch (error) {
      if (error.code !== 'ENOENT') storageNotice = 'Chiave salvata in SQLite. Impossibile rimuovere il vecchio file cifrato, che non viene più utilizzato.';
    }
  }
}
async function loadKey() {
  if (smoke) return '';
  const saved = credentials.readKey();
  if (saved) {
    delete process.env.GARMIN_API_KEY;
    await persistKey(saved);
    return saved;
  }
  if (!app.isPackaged) {
    try { process.loadEnvFile(path.join(__dirname, '..', '.env')); }
    catch (error) { if (error.code !== 'ENOENT') storageNotice = 'Impossibile leggere il file .env locale.'; }
  }
  const key = process.env.GARMIN_API_KEY?.trim() || '';
  if (key) {
    try { await persistKey(key); }
    catch { storage = 'session'; storageNotice = 'Chiave caricata per questa sessione; salvataggio in SQLite non riuscito.'; }
  }
  delete process.env.GARMIN_API_KEY;
  return key;
}
function getStatus() {
  return { ...client.status(), ...stepsService.info(), storage, storageNotice, today: today(), defaultFrom: shiftDate(today(), -6), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, input) => {
    if (event.sender !== window?.webContents || event.senderFrame?.url !== APP_URL) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'Richiesta non consentita.' } };
    }
    try { return { ok: true, value: await action(input) }; }
    catch (error) {
      return { ok: false, error: { code: error instanceof GarminError || error instanceof CharacterError || error instanceof GameError ? error.code : 'APP_ERROR', message: error instanceof GarminError || error instanceof CharacterError || error instanceof GameError ? error.message : 'Operazione non riuscita. Controlla i dati e riprova.', retryAt: error.retryAt || null } };
    }
  });
}
async function exclusive(action) {
  if (busy) throw new GarminError('BUSY', 'È già in corso un’operazione. Attendi il completamento.');
  busy = true;
  try { return await action(); } finally { busy = false; }
}
function registerHandlers() {
  handle('app:language',language=>{Menu.setApplicationMenu(Menu.buildFromTemplate(require('../lib/ui-menu.cjs').menuTemplate(language)));return true;});
  handle('characters:list',()=>{flushSession();return characters.list();});
  handle('characters:create',input=>characters.create(input));
  handle('characters:delete',input=>{if(typeof input?.id!=='string')throw new CharacterError('Personaggio non valido.');const c=characters.get(input.id);if(input.name!==c.name)throw new CharacterError('Il nome digitato non corrisponde.');if(activeCharacter===input.id)flushSession(true);characters.remove(input.id,input.name);return characters.list();});
  handle('characters:select',id=>{if(typeof id!=='string')throw new CharacterError('Personaggio non valido.');const c=characters.get(id);flushSession(true);activeCharacter=c.id;sessionStarted=performance.now();const stepsImport=gameSteps.claimCached();return {...characters.get(c.id),stepsImport};});
  handle('characters:leave',()=>{flushSession(true);return true;});
  const actor=()=>{if(!activeCharacter)throw new GameError('Seleziona prima un personaggio.');return activeCharacter;};
  handle('game:smith-quote',input=>game.previewCraft(actor(),input));
  handle('game:state',()=>game.state(actor()));
  handle('game:refine-item',input=>game.refineItem(actor(),input));
  handle('game:research-reward',input=>game.chooseResearchReward(actor(),input));
  handle('game:save-loot-filter',input=>game.saveLootFilter(actor(),input));
  handle('game:preview-rarity-sale',input=>game.previewRaritySale(actor(),input));
  handle('game:sell-rarity',input=>game.sellRarity(actor(),input));
  handle('game:preview-junk-sale',()=>game.previewJunkSale(actor()));
  handle('game:sell-junk',input=>game.sellJunk(actor(),input));
  for(const [channel,method]of [['mine-next','queueMining'],['mine-start','startMining'],['mine-collect','collectMining'],['mine-upgrade','upgradeMine'],['smith-craft','craftItem'],['smith-reforge','reforgeItem'],['arena-start','startArena'],['arena-action','arenaAction'],['enchant-prepare','prepareEnchantment'],['enchant-apply','applyEnchantment'],['expedition-start','startExpedition'],['expedition-choose','chooseExpedition'],['expedition-return','returnExpedition'],['equip','equip'],['buy-equip','buyAndEquip'],['unequip','unequip'],['buy','buy'],['sell','sell'],['use-item','useItem'],['start-battle','startBattle'],['act','act'],['auto-battle','autoBattle'],['auto-start-battle','startAutoBattle']])handle('game:'+channel,input=>game[method](actor(),input));
  handle('game:rest',()=>game.rest(actor()));
  handle('game:refresh-merchant',()=>game.refreshMerchant(actor()));
  handle('game:exchange',amount=>game.exchange(actor(),amount));
  const gameSteps=createGameStepsService({game,repository,stepsService,actor,today});
  handle('game:sync-steps',input=>exclusive(()=>gameSteps.sync(input)));
  handle('garmin:status', getStatus);
  function validateRange(input) {
    if (!input || typeof input.from !== 'string' || typeof input.to !== 'string') throw new GarminError('INVALID_DATE', 'Seleziona un intervallo di date valido.');
    if (input.to > today()) throw new GarminError('INVALID_DATE', 'La data finale non può essere nel futuro.');
    try { dateRange(input.from, input.to); }
    catch (error) { throw new GarminError('INVALID_DATE', error.message); }
  }
  handle('garmin:cache', input => exclusive(() => {
    validateRange(input);
    const result = stepsService.read(input.from, input.to);
    snapshot = result.cache.storedDays ? result : null;
    return { ...result, status: getStatus() };
  }));
  handle('garmin:download', input => exclusive(async () => {
    validateRange(input);
    snapshot = await stepsService.sync(input.from, input.to);
    return { ...snapshot, status: getStatus() };
  }));
  handle('garmin:save-key', key => exclusive(async () => {
    if (typeof key !== 'string' || !/^GCDC_[A-Za-z0-9+/=._-]{30,2048}$/.test(key.trim())) {
      throw new GarminError('INVALID_KEY', 'Inserisci una chiave Garmin Personal API completa, che inizi con GCDC_.');
    }
    const candidate = buildClient(key);
    // Verifica l’accesso prima di sostituire la chiave funzionante.
    const verified = await candidate.getSteps(today(), today());
    const result = stepsService.replaceAccount(candidate, key, verified);
    try { await persistKey(key.trim()); }
    catch { storage = 'session'; storageNotice = 'Chiave verificata per questa sessione; salvataggio locale non riuscito.'; }
    client = candidate; snapshot = result;
    return { ...result, status: getStatus() };
  }));
  handle('garmin:export', () => exclusive(async () => {
    if (!snapshot) throw new GarminError('NO_DATA', 'Scarica prima un intervallo di passi.');
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Esporta i passi', defaultPath: `stepquest-${snapshot.from}-${snapshot.to}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    await fs.writeFile(filePath, stepsCsv(snapshot), { encoding: 'utf8', mode: 0o600 });
    return { canceled: false };
  }));
}
function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 800, useContentSize: true, resizable: false, maximizable: false, fullscreenable: false,
    backgroundColor: '#171c1e', title: 'StepQuest', show: false, icon: path.join(__dirname,'../renderer/assets/app-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== APP_URL) event.preventDefault(); });
  window.once('ready-to-show', () => { if (!smoke) window.show(); });
  window.on('closed', () => { flushSession(true); window = null; });
  window.loadURL(APP_URL);
  if (smoke) {
    let completed=false;app.on('before-quit',()=>{if(!completed){console.error('Electron smoke test stopped before completion.');app.exit(1);}});
    require(app.isPackaged?'./packaged-smoke.cjs':process.argv.includes('--settlement')?'../scripts/settlement-smoke.cjs':process.argv.includes('--hero-layout')?'../scripts/hero-layout-smoke.cjs':process.argv.includes('--alchemy-layout')?'../scripts/alchemy-layout-smoke.cjs':'../scripts/electron-smoke.cjs')(window,app).then(()=>{completed=true;app.quit();}).catch(error=>{console.error('Electron smoke test failed:',error.stack);app.exit(1);});
  }
}
app.whenReady().then(async () => {
  if(!ownsInstance)return;
  prepareSave(path.join(app.getPath('userData'),'stepquest.sqlite'),{version:require('../package.json').version});
  const assets = new Map([['/index.html', ['index.html', 'text/html']], ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']]]);
  for(const monster of ['slime','wolf','raider'])assets.set(`/assets/monsters/${monster}.png`,[`assets/monsters/${monster}.png`,'image/png']);
  assets.set('/locales.js',['locales.js','text/javascript']);assets.set('/i18n.js',['i18n.js','text/javascript']);
  assets.set('/items.js',['items.js','text/javascript']);
  for(const item of ['sword','staff','bow','daggers','nature-staff','axe','armor-plate','armor-robe','armor-leather','boots','ring','amulet','potion-red','potion-blue','potion-green','food'])assets.set(`/assets/items/${item}.png`,[`assets/items/${item}.png`,'image/png']);
  assets.set('/action-icons.js',['action-icons.js','text/javascript']);assets.set('/game.js',['game.js','text/javascript']);assets.set('/game.css',['game.css','text/css']);
  for(const scene of ['home','market','wilds','alchemy','mine','smith','arena'])assets.set(`/assets/scene-${scene}.png`,[`assets/scene-${scene}.png`,'image/png']);
  for(const font of ['CinzelDecorative-Regular','Cinzel','IMFellEnglish']) assets.set(`/assets/fonts/${font}.ttf`,[`assets/fonts/${font}.ttf`,'font/ttf']);
  for(const svg of ['frame','parchment','seal']) assets.set(`/assets/ui/${svg}.svg`,[`assets/ui/${svg}.svg`,'image/svg+xml']);
  protocol.handle('stepquest', async request => {
    const url = new URL(request.url);
    if(/^\/assets\/(?:(?:guardian|arcanist|ranger|rogue|druid|berserker)-(?:male|female)|welcome)\.png$/.test(url.pathname))assets.set(url.pathname,[url.pathname.slice(1),'image/png']);
    const asset = url.host === 'app' && !url.search ? assets.get(url.pathname) : null;
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(await fs.readFile(path.join(__dirname, '..', 'renderer', asset[0])), { headers: { 'Content-Type': `${asset[1]}; charset=utf-8` } });
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('stepquest://app/') && !details.url.startsWith('devtools://') }));
  if(!smoke&&!app.isPackaged&&process.platform==='darwin')app.dock.setIcon(path.join(__dirname,'../renderer/assets/app-icon.png'));
  Menu.setApplicationMenu(Menu.buildFromTemplate(require('../lib/ui-menu.cjs').menuTemplate()));
  repository = createStepsRepository(path.join(app.getPath('userData'), 'stepquest.sqlite'));
  characters = createCharactersRepository(path.join(app.getPath('userData'), 'stepquest.sqlite'));
  game = createGameRepository(path.join(app.getPath('userData'), 'stepquest.sqlite'),smoke?{rng:()=>.5,today:()=>app.__testDay||today()}:{});
  if(smoke&&!app.isPackaged)require('../scripts/game-smoke-fixture.cjs').seedSteps(repository);
  credentials = createCredentialsRepository(path.join(app.getPath('userData'), 'stepquest.sqlite'));
  const apiKey = await loadKey();
  client = buildClient(apiKey);
  stepsService = createStepsService({ repository, client, apiKey });
  registerHandlers(); createWindow();
  app.on('activate', () => { if (!window) createWindow(); });
}).catch(async error => {
  console.error('Impossibile avviare StepQuest:',error.message);
  if(smoke){app.exit(1);return;}closeStores();
  const directory=app.getPath('userData'),filename=path.join(directory,'stepquest.sqlite');
  const result=await dialog.showMessageBox({type:'error',title:'StepQuest · Recupero salvataggio',message:'Impossibile aprire il salvataggio.',detail:'I dati originali sono conservati. Puoi ripristinare un backup oppure aprire la cartella dei salvataggi.\n\n'+error.message,buttons:['Ripristina un backup','Apri cartella salvataggi','Esci'],defaultId:2,cancelId:2});
  if(result.response===0){const selected=await dialog.showOpenDialog({title:'Scegli un backup StepQuest',defaultPath:path.join(directory,'backups'),properties:['openFile'],filters:[{name:'Salvataggi SQLite',extensions:['sqlite','db']}]});if(!selected.canceled){try{restoreSave(filename,selected.filePaths[0]);app.relaunch();app.exit(0);return;}catch(recoveryError){await dialog.showMessageBox({type:'error',title:'StepQuest',message:'Ripristino non riuscito. Il salvataggio originale è conservato.',detail:recoveryError.message});}}}
  if(result.response===1)await shell.openPath(directory);app.exit(1);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
function closeStores(){clearInterval(sessionTimer);flushSession(true);for(const store of [characters,credentials,game,repository])try{store?.close();}catch{}characters=credentials=game=repository=null;}
app.on('will-quit', () => {
  closeStores();
  if (smokeDirectory) require('node:fs').rmSync(smokeDirectory, { recursive: true, force: true });
});
