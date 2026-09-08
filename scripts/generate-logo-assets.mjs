import sharp from 'sharp';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'img');
mkdirSync(OUT, { recursive: true });

const MASTER_PATH = resolve(OUT, 'dwm-logo-new.png');
if (!existsSync(MASTER_PATH)) {
  console.error('ERROR: Master logo not found at', MASTER_PATH);
  console.error('Please place dwm-logo-new.png in /assets/img/ first.');
  process.exit(1);
}

const masterBuf = readFileSync(MASTER_PATH);
const masterMeta = await sharp(masterBuf).metadata();
console.log(`Master logo: ${masterMeta.width}x${masterMeta.height}, format=${masterMeta.format}`);

async function makeSquare(size, paddingPct = 0.12) {
  const fit = Math.floor(size * (1 - paddingPct * 2));
  const resized = await sharp(masterBuf)
    .resize(fit, fit, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  const meta = await sharp(resized).metadata();
  const left = Math.floor((size - meta.width) / 2);
  const top = Math.floor((size - meta.height) / 2);

  return canvas
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const written = [];

const fav16 = await makeSquare(16, 0.1);
const p16 = resolve(OUT, 'favicon-16x16.png');
writeFileSync(p16, fav16);
written.push(p16);

const fav32 = await makeSquare(32, 0.12);
const p32 = resolve(OUT, 'favicon-32x32.png');
writeFileSync(p32, fav32);
written.push(p32);

const apple = await makeSquare(180, 0.14);
const pApple = resolve(OUT, 'apple-touch-icon.png');
writeFileSync(pApple, apple);
written.push(pApple);

const icoData = [];
function push(buf) { for (let i = 0; i < buf.length; i++) icoData.push(buf[i]); }

const entries = [
  { size: 16, data: fav16 },
  { size: 32, data: fav32 }
];

const ICONDIR_SIZE = 6;
const DIRENTRY_SIZE = 16;
const header = Buffer.alloc(ICONDIR_SIZE);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
push(...header);

let dataOffset = ICONDIR_SIZE + entries.length * DIRENTRY_SIZE;
for (const e of entries) {
  const dir = Buffer.alloc(DIRENTRY_SIZE);
  dir[0] = e.size === 16 ? 16 : 32;
  dir[1] = e.size === 16 ? 16 : 32;
  dir[2] = 0;
  dir[3] = 0;
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(e.data.length, 8);
  dir.writeUInt32LE(dataOffset, 12);
  push(...dir);
  dataOffset += e.data.length;
}
for (const e of entries) push(...e.data);

const icoPath = resolve(OUT, 'favicon.ico');
writeFileSync(icoPath, Buffer.from(icoData));
written.push(icoPath);

console.log('Generated favicon derivatives from master logo:');
for (const p of written) console.log(' -', p);
