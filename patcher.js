const { exec } = require('child_process');
const fs = require('fs');
const util = require('util');
const execP = util.promisify(exec);
const fsp = fs.promises;

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

const SCAN_CHUNK = 262144;

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
    await quickPatch(inputPath, outputPath);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('Processing failed — no output file was created');
  }
}

async function quickPatch(inputPath, outputPath) {
  // Step 1: fast OS-level copy (kernel buffered, no Node memory)
  await fsp.copyFile(inputPath, outputPath);

  // Step 2: open copy in read-write mode, find & patch moov in-place
  const fd = await fsp.open(outputPath, 'r+');
  try {
    const stat = await fd.stat();
    const fileLen = stat.size;

    // Scan for moov box using 256KB chunks
    let moovStart = -1;
    let moovSize = 0;
    let offset = 0;

    while (offset < fileLen) {
      const n = Math.min(SCAN_CHUNK, fileLen - offset);
      const buf = Buffer.alloc(n);
      const { bytesRead } = await fd.read(buf, 0, n, offset);
      if (bytesRead === 0) break;

      for (let i = 0; i + 8 <= bytesRead; i++) {
        if (buf[i+4]===0x6d && buf[i+5]===0x6f && buf[i+6]===0x6f && buf[i+7]===0x76) {
          const sz = buf.readUInt32BE(i);
          if (sz >= 8 && offset + i + sz <= fileLen) {
            moovStart = offset + i;
            moovSize = sz;
            break;
          }
        }
      }
      if (moovStart !== -1) break;
      offset += bytesRead;
    }

    if (moovStart === -1) throw new Error('No moov box found');

    // Read only the moov box into memory (typically < 1MB)
    const moovBuf = Buffer.alloc(moovSize);
    await fd.read(moovBuf, 0, moovSize, moovStart);

    // Patch in memory
    patchMoovBuffer(moovBuf, moovSize);

    // Write patched moov back in-place
    await fd.write(moovBuf, 0, moovSize, moovStart);
  } finally {
    await fd.close();
  }
}

function patchMoovBuffer(buf, len) {
  patchMvhd(buf, 0, len);
  let pos = 8;
  while (pos + 8 <= len) {
    const sz = buf.readUInt32BE(pos);
    const ty = buf.toString('ascii', pos + 4, pos + 8);
    if (sz < 8) break;
    if (ty === 'trak') patchTrak(buf, pos, len);
    pos += sz;
  }
}

function patchMvhd(buf, start, len) {
  posLoop(buf, start, len, (pos, sz, ty) => {
    if (ty === 'mvhd') {
      const ver = buf.readUInt8(pos + 8);
      const off = ver === 1 ? pos + 28 : pos + 20;
      if (off + 4 <= len) buf.writeUInt32BE(3, off);
      return true;
    }
    return false;
  });
}

function patchTrak(buf, start, len) {
  posLoop(buf, start, len, (pos, sz, ty) => {
    if (ty === 'mdia') { patchMdia(buf, pos, len); return true; }
    return false;
  });
}

function patchMdia(buf, start, len) {
  posLoop(buf, start, len, (pos, sz, ty) => {
    if (ty === 'hdlr') {
      const nameStart = pos + 32;
      const maxLen = Math.min(48, start + buf.readUInt32BE(start) - nameStart);
      if (nameStart + maxLen <= len) {
        const nameBuf = Buffer.from('Krynox Encoder\0');
        const copyLen = Math.min(nameBuf.length, maxLen);
        nameBuf.copy(buf, nameStart, 0, copyLen);
      }
      return true;
    }
    return false;
  });
}

function posLoop(buf, start, len, fn) {
  const end = start + buf.readUInt32BE(start);
  let pos = start + 8;
  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = buf.readUInt32BE(pos);
    const ty = buf.toString('ascii', pos + 4, pos + 8);
    if (sz < 8) break;
    if (fn(pos, sz, ty)) return;
    pos += sz;
  }
}

module.exports = { patchVideo };
