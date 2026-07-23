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

    const dlName = req.file.originalname.replace(/\.[^.]+$/, '') + '-krynox.mp4';
    res.download(outputPath, dlName, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
      fs.unlink(outputPath, () => {});
    });
  } catch (e) {
    console.error('Process error:', e);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: e.message || 'Processing failed' });
  }
});

app.post('/api/process-link', async (req, res) => {
  try {
    const { url, encode } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });
    const match = url.match(/video\.itzcrih\.it\/v\/([a-f0-9]+)/i);
    if (!match) return res.status(400).json({ error: 'Invalid itzStream URL format' });

    const resp = await fetch(url);
    if (!resp.ok) return res.status(502).json({ error: 'Failed to fetch from itzStream' });

    const buffer = Buffer.from(await resp.arrayBuffer());
    const inputPath = path.join(uploadDir, crypto.randomUUID() + '.mp4');
    fs.writeFileSync(inputPath, buffer);

    const outName = crypto.randomUUID() + '.mp4';
    const outputPath = path.join(processedDir, outName);

    await patchVideo(inputPath, outputPath, !!encode);
    fs.unlink(inputPath, () => {});

    res.download(outputPath, 'stream-video-krynox.mp4', (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
      fs.unlink(outputPath, () => {});
    });
  } catch (e) {
    console.error('Link process error:', e);
    res.status(500).json({ error: e.message || 'Link processing failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Krynox Method server running on port ' + PORT);
});
