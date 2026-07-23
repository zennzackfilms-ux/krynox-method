const { exec } = require('child_process');
const fs = require('fs');
const util = require('util');
const execP = util.promisify(exec);

const FFMPEG_PATHS = [
  'ffmpeg',
  'C:\\Users\\borco\\ffmpeg\\ffmpeg-7.1-essentials_build\\bin\\ffmpeg.exe',
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
];

let ffmpegBin = FFMPEG_PATHS[0];

async function checkFfmpeg() {
  for (const p of FFMPEG_PATHS) {
    try {
      await execP(`"${p}" -version`, { timeout: 5000 });
      ffmpegBin = p;
      return;
    } catch {}
  }
  throw new Error('FFmpeg not found. Download from https://ffmpeg.org/');
}

function q(s) { return '"' + s + '"'; }

async function patchVideo(inputPath, outputPath, encode = false) {
  if (encode) {
    await checkFfmpeg();
    await execP(
      `${q(ffmpegBin)} -i ${q(inputPath)} ` +
      `-c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 ` +
      `-pix_fmt yuv420p -c:a aac -b:a 192k ` +
      `-movflags +faststart ` +
      `-metadata:s:v:0 "encoder=KrynoxOptimizer" ` +
      `-metadata:s:a:0 "encoder=KrynoxAudio" ` +
      `-y ${q(outputPath)}`,
      { timeout: 600000 }
    );
  } else {
    quickPatch(inputPath, outputPath);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('Processing failed — no output file was created');
  }
}

function quickPatch(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  const len = buf.length;
  let pos = 0;

  while (pos + 8 <= len) {
    const boxSize = buf.readUInt32BE(pos);
    const boxType = buf.toString('ascii', pos + 4, pos + 8);
    if (boxSize < 8) break;
    if (boxType === 'moov') { patchMoov(buf, pos, len); break; }
    pos += boxSize;
    if (boxSize === 0) break;
  }

  fs.writeFileSync(outputPath, buf);
}

function patchMoov(buf, start, len) {
  const end = start + buf.readUInt32BE(start);
  let pos = start + 8;
  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = buf.readUInt32BE(pos);
    const ty = buf.toString('ascii', pos + 4, pos + 8);
    if (sz < 8) break;
    if (ty === 'mvhd') {
      const ver = buf.readUInt8(pos + 8);
      const off = ver === 1 ? pos + 28 : pos + 20;
      if (off + 4 <= len) buf.writeUInt32BE(3, off);
    }
    if (ty === 'trak') patchTrak(buf, pos, len);
    pos += sz;
  }
}

function patchTrak(buf, start, len) {
  const end = start + buf.readUInt32BE(start);
  let pos = start + 8;
  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = buf.readUInt32BE(pos);
    const ty = buf.toString('ascii', pos + 4, pos + 8);
    if (sz < 8) break;
    if (ty === 'mdia') patchMdia(buf, pos, len);
    pos += sz;
  }
}

function patchMdia(buf, start, len) {
  const end = start + buf.readUInt32BE(start);
  let pos = start + 8;
  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = buf.readUInt32BE(pos);
    const ty = buf.toString('ascii', pos + 4, pos + 8);
    if (sz < 8) break;
    if (ty === 'hdlr') {
      const nameStart = pos + 32;
      const maxLen = Math.min(48, end - nameStart);
      if (nameStart + maxLen <= len) {
        const nameBuf = Buffer.from('Krynox Encoder\0');
        const copyLen = Math.min(nameBuf.length, maxLen);
        nameBuf.copy(buf, nameStart, 0, copyLen);
      }
    }
    pos += sz;
  }
}

module.exports = { patchVideo };
