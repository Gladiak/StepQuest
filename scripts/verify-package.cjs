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
    const stat = statFile(archive, name);
    if (stat.files) continue;
    assert.match(name, /^(?:(?:electron|lib|renderer)\/|package\.json$|LICENSE$)/,
      `Unexpected packaged file: ${name}`);
    assert(!/(?:^|\/)(?:\.env(?:\..*)?|garmin-key\.enc.*|\.git|secrets)(?:\/|$)|\.(?:sqlite(?:-\w+)?|db|pem|key|p12|pfx)$/i.test(name),
      `Private file in application package: ${name}`);
    if (/\.(?:cjs|js|json|html|css|svg|txt|md)$/.test(name)) {
      const source = extractFile(archive, name).toString('utf8');
      assert(!secretPatterns.some(pattern => pattern.test(source)), `Credential found in packaged file: ${name}`);
    }
    files++;
  }
  for (const required of ['electron/main.cjs', 'electron/preload.cjs', 'renderer/index.html', 'renderer/assets/app-icon.png', 'package.json', 'LICENSE']) {
    assert(entries.includes(required), `Missing packaged file: ${required}`);
  }
  console.log(`Verified application package: ${files} files; no environment files, databases or credentials.`);
};
