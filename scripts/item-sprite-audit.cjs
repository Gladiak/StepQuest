'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');
const { nativeImage } = require('electron');
module.exports = () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/items.js'), 'utf8'), context);
  const catalog = context.window.StepQuestItems;
  const sprites = catalog.sprites;
  for (const name of sprites) {
    const image = nativeImage.createFromPath(path.join(__dirname, '../renderer/assets/items', name + '.png'));
    assert.equal(image.isEmpty(), false, `${name}: sprite mancante`);
    assert.deepEqual(image.getSize(), { width: 32, height: 32 });
    const bytes = image.toBitmap(); let visible = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const alpha = bytes[(y * 32 + x) * 4 + 3];
      assert.ok(alpha === 0 || alpha === 255, `${name}: bordo non pixel art`);
      if (alpha) { visible++; assert.ok(x >= 3 && x < 29 && y >= 3 && y < 29, `${name}: manca il margine nello slot`); }
    }
    assert.ok(visible > 25, `${name}: sprite vuoto o illeggibile`);
  }
  return sprites.length;
};
