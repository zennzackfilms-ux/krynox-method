const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { patchVideo } = require('./patcher');

const app = express();
const PORT = process.env.PORT || 3002;

const processedDir = path.join(__dirname, 'processed');
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, processedDir),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.mp4', '.mov', '.m4v'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only MP4/MOV/M4V allowed'), ok);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/process', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const encode = req.body.encode === '1';
    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/\.[^.]+$/, '-out.mp4');
    const origName = req.file.originalname;
    await patchVideo(inputPath, outputPath, encode);
    fs.unlink(inputPath, () => {});
    const dlName = encode ? origName.replace(/\.[^.]+$/, '') + '-encoded-krynox.mp4' : origName.replace(/\.[^.]+$/, '') + '-krynox.mp4';
    res.download(outputPath, dlName);
  } catch (e) {
    console.error('Error:', e);
    if (req.file) try { fs.unlinkSync(req.file.path) } catch {}
    res.status(500).send('Processing failed: ' + e.message);
  }
});

setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const f of fs.readdirSync(processedDir)) {
    try {
      const p = path.join(processedDir, f);
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    } catch {}
  }
}, 3600000);

app.listen(PORT, '0.0.0.0', () => {
  console.log('Krynox Method on port ' + PORT);
});
