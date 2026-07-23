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

const CHUNK = 65536;

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

function quickPatch(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(inputPath, 'r');
    const outFd = fs.openSync(outputPath, 'w');
    const fileLen = fs.fstatSync(fd).size;
    let moovStart = -1, moovSize = 0;

    // Phase 1: scan chunks to find moov box offset
    function scan(offset, cb) {
      if (offset >= fileLen) return cb(new Error('No moov box found'));
      const buf = Buffer.alloc(Math.min(CHUNK, fileLen - offset));
      fs.read(fd, buf, 0, buf.length, offset, (err, n) => {
        if (err) return cb(err);
        const s = buf.subarray(0, n);
        for (let i = 0; i + 8 <= n; i++) {
          if (s[i+4]===0x6d && s[i+5]===0x6f && s[i+6]===0x6f && s[i+7]===0x76) {
            const sz = s.readUInt32BE(i);
            if (sz >= 8 && offset + i + sz <= fileLen) {
              moovStart = offset + i;
              moovSize = sz;
              return cb(null);
            }
          }
        }
        scan(offset + n, cb);
      });
    }

    scan(0, (err) => {
      if (err) { try { fs.closeSync(fd) } catch {} try { fs.closeSync(outFd) } catch {} return reject(err); }

      // Phase 2: load only the moov box into memory, patch it
      const moovBuf = Buffer.alloc(moovSize);
      fs.read(fd, moovBuf, 0, moovSize, moovStart, (err2) => {
        if (err2) { try { fs.closeSync(fd) } catch {} try { fs.closeSync(outFd) } catch {} return reject(err2); }

        patchMoovBuffer(moovBuf, moovSize);

        // Phase 3: stream-copy file, replacing moov region with patched version
        let pos = 0;
        function copy() {
          if (pos >= fileLen) {
            fs.closeSync(fd); fs.closeSync(outFd);
            return resolve();
          }
          // If we've reached the moov region, write patched buffer and skip past it
          if (pos === moovStart) {
            fs.write(outFd, moovBuf, 0, moovSize, pos, (err3) => {
              if (err3) { cleanup(); return reject(err3); }
              pos = moovStart + moovSize;
              copy();
            });
            return;
          }
          // If we're before the moov region, write up to moovStart or CHUNK
          const nextMoov = pos < moovStart ? moovStart : fileLen;
          const n = Math.min(CHUNK, nextMoov - pos);
          if (n <= 0) { fs.closeSync(fd); fs.closeSync(outFd); return resolve(); }
          const buf = Buffer.alloc(n);
          fs.read(fd, buf, 0, n, pos, (err3, n2) => {
            if (err3) { cleanup(); return reject(err3); }
            fs.write(outFd, buf.subarray(0, n2), 0, n2, pos, (err4) => {
              if (err4) { cleanup(); return reject(err4); }
              pos += n2;
              copy();
            });
          });
        }
        function cleanup() { try { fs.closeSync(fd); } catch {} try { fs.closeSync(outFd); } catch {} }
        copy();
      });
    });
  });
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
