const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { patchVideo } = require('./patcher');

const app = express();
const PORT = process.env.PORT || 3002;

const uploadDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');
for (const d of [uploadDir, processedDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/process', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inputPath = req.file.path;
    const outName = crypto.randomUUID() + '.mp4';
    const outputPath = path.join(processedDir, outName);
    const encode = req.body.encode === '1';

    await patchVideo(inputPath, outputPath, encode);
    fs.unlink(inputPath, () => {});

    res.json({
      url: '/api/download/' + outName,
      filename: req.file.originalname
    });
  } catch (e) {
    console.error('Process error:', e);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: e.message || 'Processing failed' });
  }
});

app.get('/api/download/:file', (req, res) => {
  const filepath = path.join(processedDir, req.params.file);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="krynox-video.mp4"');
  fs.createReadStream(filepath).pipe(res);
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
  console.log('Krynox Method server running on port ' + PORT);
});
