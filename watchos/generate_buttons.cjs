// Script to generate pixel-art retro GBA button textures
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, getPixelColor) {
  // getPixelColor(x, y) => [r, g, b, a]
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelColor(x, y);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a !== undefined ? a : 255;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcBuffer = Buffer.alloc(len + 4);
  crcBuffer.write(type, 0, 4, 'ascii');
  data.copy(crcBuffer, 4);
  const crc = crc32(crcBuffer);
  chunk.writeUInt32BE(crc, len + 8);

  return chunk;
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const W = 350;
const H = 64;

// Generate Normal GBA Button (Classic Royal/Pokédex Sapphire Blue with GBA pixel bevel & Pokédex red accent)
const normalPng = createPng(W, H, (x, y) => {
  // Outer 2px border: Black / Dark Slate
  if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) {
    return [15, 23, 42, 255]; // #0f172a
  }

  // 1px inner highlight top & left
  if (x === 2 || y === 2) {
    return [96, 165, 250, 255]; // Light blue highlight #60a5fa
  }
  // 1px inner shadow bottom & right
  if (x === W - 3 || y === H - 3) {
    return [29, 78, 216, 255]; // Deep shadow #1d4ed8
  }

  // Red accent corner / tab on left (x from 4 to 28)
  if (x >= 4 && x <= 26 && y >= 6 && y <= H - 7) {
    if (x === 4 || y === 6) return [248, 113, 113, 255]; // Light red highlight
    if (x === 26 || y === H - 7) return [185, 28, 28, 255]; // Dark red shadow
    return [220, 38, 38, 255]; // Pokédex red #dc2626
  }

  // Main body gradient / fill
  const progress = y / H;
  const r = Math.floor(37 + progress * 10);
  const g = Math.floor(99 + progress * 20);
  const b = Math.floor(235 - progress * 20);
  return [r, g, b, 255]; // #2563eb
});

// Generate Pressed GBA Button (Amber Gold active state)
const pressPng = createPng(W, H, (x, y) => {
  if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) {
    return [15, 23, 42, 255];
  }
  if (x === 2 || y === 2) {
    return [253, 224, 71, 255]; // Light gold highlight
  }
  if (x === W - 3 || y === H - 3) {
    return [180, 83, 9, 255]; // Deep amber shadow
  }
  if (x >= 4 && x <= 26 && y >= 6 && y <= H - 7) {
    return [220, 38, 38, 255];
  }
  return [217, 119, 6, 255]; // Amber fill #d97706
});

const dirs = [
  path.join(__dirname, 'assets'),
  path.join(__dirname, 'assets', 'bip-6'),
  path.join(__dirname, 'assets', 'bip-5')
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'btn_tasks_gba.png'), normalPng);
  fs.writeFileSync(path.join(d, 'btn_tasks_gba_press.png'), pressPng);
  console.log('Saved GBA button assets to:', d);
});
