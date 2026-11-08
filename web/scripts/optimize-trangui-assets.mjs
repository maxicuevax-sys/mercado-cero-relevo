import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep the reviewed original import as the reproducible source; never JPEG-recompress an already optimized output.
const sourceRef = '65b5639140f49ad993b89942449ef51feb99f218';
const original = relative => execFileSync('git', ['show', `${sourceRef}:web/${relative}`], { cwd: web, maxBuffer: 8 * 1024 * 1024 });
const icons = ['src/app/icon.png','src/app/apple-icon.png','public/icons/icon-192.png','public/icons/icon-512.png','public/icons/icon-maskable-512.png','public/icons/trangui-192-v1.png','public/icons/trangui-512-v1.png','public/icons/trangui-maskable-512-v1.png'];
const source = original('public/icons/trangui-512-v1.png');
for (const relative of icons) {
  const target = path.join(web, relative), input = original(relative);
  // Four palette entries retain the cream/green logo and edge shades, without
  // preserving high-entropy paper grain at launcher-icon resolution.
  const output = await sharp(input).png({ palette: true, colours: 4, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer();
  fs.writeFileSync(target, output); console.log(`${relative}: ${input.length} -> ${output.length}`);
}
// Next's ICO decoder requires RGBA PNG frames, not indexed palette frames.
const frames = [];
for (const size of [16,32,48]) frames.push({size,data:await sharp(source).resize(size,size).ensureAlpha().png({palette:false,compressionLevel:9}).toBuffer()});
const header = Buffer.alloc(6); header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=6+16*frames.length;const entries=[];
for(const {size,data} of frames){const e=Buffer.alloc(16);e[0]=size;e[1]=size;e.writeUInt16LE(1,4);e.writeUInt16LE(32,6);e.writeUInt32LE(data.length,8);e.writeUInt32LE(offset,12);offset+=data.length;entries.push(e);}
const ico = Buffer.concat([header,...entries,...frames.map(f=>f.data)]);
const favicon=path.join(web,'src/app/favicon.ico');const old=fs.statSync(favicon).size;fs.writeFileSync(favicon,ico);console.log(`favicon: ${old} -> ${ico.length}`);
const social=path.join(web,'public/social/trangui-qr-codi-v2.jpg');const input=original('public/social/trangui-qr-codi-v2.jpg');
const output=await sharp(input).jpeg({quality:25,mozjpeg:true,progressive:true,chromaSubsampling:'4:2:0'}).toBuffer();
fs.writeFileSync(social,output);console.log(`social: ${input.length} -> ${output.length}`);
