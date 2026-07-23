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
  await checkFfmpeg();

  if (encode) {
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
    await execP(
      `${q(ffmpegBin)} -i ${q(inputPath)} ` +
      `-c copy -map 0 ` +
      `-metadata:s:v:0 "encoder=KrynoxOptimizer" ` +
      `-metadata:s:a:0 "encoder=KrynoxAudio" ` +
      `-movflags +faststart ` +
      `-y ${q(outputPath)}`,
      { timeout: 60000 }
    );
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('Processing failed — no output file was created');
  }
}

module.exports = { patchVideo };
