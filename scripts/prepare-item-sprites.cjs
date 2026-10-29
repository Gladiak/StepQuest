'use strict';
// Preparazione di asset generati: ritaglio alpha, dimensionamento e padding uniforme.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(() => {
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const destination = path.join(__dirname, '../renderer/assets/items');
  fs.mkdirSync(destination, { recursive: true });
  const previews = [];
  for (const item of manifest) {
    const source = nativeImage.createFromPath(item.source);
    if (source.isEmpty()) throw new Error(`Asset mancante: ${item.id}`);
    const { width, height } = source.getSize(), bytes = source.toBitmap();
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[(y * width + x) * 4 + 3] > 64) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error(`Asset vuoto: ${item.id}`);
    const scale = 26 / Math.max(right - left + 1, bottom - top + 1);
    const targetWidth = Math.max(1, Math.round((right - left + 1) * scale));
    const targetHeight = Math.max(1, Math.round((bottom - top + 1) * scale));
    const small = source.crop({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 })
      .resize({ width: targetWidth, height: targetHeight, quality: 'best' }).toBitmap();
    const final = Buffer.alloc(32 * 32 * 4), dx = Math.floor((32 - targetWidth) / 2), dy = Math.floor((32 - targetHeight) / 2);
    for (let y = 0; y < targetHeight; y++) for (let x = 0; x < targetWidth; x++) {
      const src = (y * targetWidth + x) * 4, dst = ((y + dy) * 32 + x + dx) * 4, alpha = small[src + 3];
      if (alpha < 100) continue;
      for (let c = 0; c < 3; c++) final[dst + c] = Math.min(255, Math.round(small[src + c] * 255 / alpha / 17) * 17);
      final[dst + 3] = 255;
    }
    fs.writeFileSync(path.join(destination, item.id + '.png'), nativeImage.createFromBitmap(final, { width: 32, height: 32 }).toPNG());
    previews.push(final);
  }
  // Tavola di controllo 4×4, con sprite ingranditi a pixel interi.
  const tile = 112, columns = 4, sheetWidth = tile * columns, sheetHeight = tile * Math.ceil(previews.length / columns);
  const sheet = Buffer.alloc(sheetWidth * sheetHeight * 4);
  for (let p = 0; p < sheet.length; p += 4) { sheet[p] = 27; sheet[p + 1] = 33; sheet[p + 2] = 28; sheet[p + 3] = 255; }
  previews.forEach((sprite, i) => {
    const x0 = (i % columns) * tile + 8, y0 = Math.floor(i / columns) * tile + 8;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const src = (Math.floor(y / 3) * 32 + Math.floor(x / 3)) * 4;
      if (sprite[src + 3]) sprite.copy(sheet, ((y0 + y) * sheetWidth + x0 + x) * 4, src, src + 4);
    }
  });
  fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../artifacts/item-sprites.png'), nativeImage.createFromBitmap(sheet, { width: sheetWidth, height: sheetHeight }).toPNG());
  fs.writeFileSync(path.join(destination, 'prompts.json'), JSON.stringify(manifest.map(({ id, prompt }) => ({ id, prompt })), null, 2) + '\n');
  console.log(JSON.stringify({ sprites: previews.length, size: '32x32', transparent: true }));
  app.quit();
}).catch(error => { console.error(error.message); app.exit(1); });
