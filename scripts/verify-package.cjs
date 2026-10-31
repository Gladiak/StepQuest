'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { listPackage, statFile, extractFile } = require('@electron/asar');

// Runs before installers/archives are created, on every supported platform.
module.exports = async context => {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, 'StepQuest.app', 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const archive = path.join(resources, 'app.asar');
  const entries = listPackage(archive).map(name => name.replaceAll('\\', '/').replace(/^\//, ''));
  const secretPatterns = [
    /GCDC_[A-Za-z0-9+/=._-]{30,}/,
    /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ];
  let files = 0;
  for (const name of entries) {
    // ASAR's filesystem lookup splits on the host's native path separator.
    const archiveName = name.split('/').join(path.sep);
    const stat = statFile(archive, archiveName);
    if (stat.files) continue;
    assert.match(name, /^(?:(?:electron|lib|renderer)\/|package\.json$|LICENSE$)/,
      `Unexpected packaged file: ${name}`);
    assert(!/(?:^|\/)(?:\.env(?:\..*)?|garmin-key\.enc.*|\.git|secrets)(?:\/|$)|\.(?:sqlite(?:-\w+)?|db|pem|key|p12|pfx)$/i.test(name),
      `Private file in application package: ${name}`);
    if (/\.(?:cjs|js|json|html|css|svg|txt|md)$/.test(name)) {
      const source = extractFile(archive, archiveName).toString('utf8');
      assert(!secretPatterns.some(pattern => pattern.test(source)), `Credential found in packaged file: ${name}`);
    }
    files++;
  }
  for (const required of ['lib/provision-rules.cjs','lib/merchant.cjs','lib/merchant-catalog.cjs','renderer/merchant.js','renderer/merchant.css','renderer/merchant-locales.js','renderer/scroll-state.js','lib/runic.cjs','lib/runic-catalog.cjs','lib/runic-combat.cjs','lib/combat-tactics.cjs','renderer/runic.js','renderer/runic.css','renderer/runic-locales.js','lib/watch-finale.cjs','renderer/watch-finale.js','renderer/watch-finale.css','renderer/watch-locales.js','renderer/reforging.js','lib/comparison-worker.cjs','lib/comparison-service.cjs','lib/comparison-simulation.cjs','renderer/comparisons.js','electron/main.cjs', 'electron/preload.cjs', 'renderer/index.html', 'renderer/assets/app-icon.png', 'renderer/assets/chronicle-badges.png', 'renderer/assets/scene-chronicles.png', 'renderer/chronicles.js', 'renderer/chronicle-art.js', 'renderer/chronicle-locales.js', 'lib/chronicles.cjs', 'lib/chronicle-catalog.cjs', 'renderer/assets/atlas-refuge.png', 'renderer/assets/scene-watch.png', 'renderer/assets/monsters/warden.png', 'renderer/atlas.js', 'renderer/atlas-locales.js', 'lib/atlas.cjs', 'lib/atlas-catalog.cjs', 'renderer/assets/scene-guild.png', 'renderer/guild-locales.js', 'lib/guild.cjs', 'lib/guild-catalog.cjs', 'lib/garmin-activities.cjs', 'lib/garmin-foundation.cjs', 'renderer/assets/scene-mine.png', 'renderer/assets/scene-smith.png', 'renderer/assets/scene-arena.png', 'lib/settlement.cjs', 'lib/save-protection.cjs', 'electron/packaged-smoke.cjs', 'package.json', 'LICENSE']) {
    assert(entries.includes(required), `Missing packaged file: ${required}`);
  }
  console.log(`Verified application package: ${files} files; no environment files, databases or credentials.`);
};
