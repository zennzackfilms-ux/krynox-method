// ─── FAQ Toggle ───
function toggleFaq(el) {
  const item = el.parentElement;
  item.classList.toggle('open');
}

// ─── Upload Method Toggle ───
document.querySelectorAll('.method-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.upload-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('upload' + btn.dataset.method.charAt(0).toUpperCase() + btn.dataset.method.slice(1)).classList.remove('hidden');
    document.getElementById('resultPanel').classList.add('hidden');
  });
});

// ─── Drag & Drop / File Input ───
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
let selectedFile = null;

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  const maxSize = 500 * 1024 * 1024;
  if (!['video/mp4', 'video/quicktime', ''].includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
    showError('Please select an MP4, MOV, or M4V file.');
    return;
  }
  if (file.size > maxSize) {
    showError('File exceeds 500MB limit.');
    return;
  }
  selectedFile = file;
  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-text').textContent = file.name;
  dropZone.querySelector('.drop-hint').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  processBtn.disabled = false;
  processBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Patch Video`;
}

function showError(msg) {
  dropZone.classList.remove('has-file');
  dropZone.querySelector('.drop-text').textContent = msg;
  dropZone.querySelector('.drop-hint').textContent = 'Try a different file';
  processBtn.disabled = true;
  setTimeout(() => {
    dropZone.querySelector('.drop-text').textContent = 'Drop your video here or click to browse';
    dropZone.querySelector('.drop-hint').textContent = 'MP4, MOV, M4V \u2022 Maximum 500MB';
  }, 4000);
}

// ─── Process: File Upload ───
processBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  await processFile(selectedFile, document.getElementById('encodeToggle').checked);
});

// ─── Process: Link ───
document.getElementById('processLinkBtn').addEventListener('click', async () => {
  const link = document.getElementById('streamLink').value.trim();
  if (!link) return;
  await processLink(link);
});

// ─── Upload via Fetch ───
async function uploadFile(file, encode) {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('encode', encode ? '1' : '0');

  const resp = await fetch('/api/process', { method: 'POST', body: formData });
  if (!resp.ok) { const err = await resp.json().catch(()=>({})); throw new Error(err.error || 'Upload failed'); }
  return resp.blob();
}

// ─── Process File ───
async function processFile(file, encode) {
  showProgress('Applying Krynox patch...', 'Reading video metadata');
  try {
    const blob = await uploadFile(file, encode);
    showProgress('Finalizing...', 'Almost done');
    showResult(blob, file.name);
  } catch (e) {
    showErrorState(e.message);
  }
}

// ─── Process Link ───
async function processLink(link) {
  showProgress('Fetching from itzStream...', 'Downloading video');
  try {
    const resp = await fetch('/api/process-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link, encode: false })
    });
    if (!resp.ok) { const err = await resp.json().catch(()=>({})); throw new Error(err.error || 'Failed to process link'); }
    const blob = await resp.blob();
    showProgress('Applying Krynox patch...', 'Optimizing metadata');
    showResult(blob, 'stream-video.mp4');
  } catch (e) {
    showErrorState(e.message);
  }
}

// ─── Progress UI ───
function showProgress(status, detail) {
  document.querySelector('.upload-panel:not(.hidden)').classList.add('hidden');
  document.getElementById('progressPanel').classList.remove('hidden');
  document.getElementById('resultPanel').classList.add('hidden');
  document.getElementById('progressText').textContent = status;
  document.getElementById('progressDetail').textContent = detail || '';
  document.getElementById('progressTime').classList.remove('hidden');

  let p = 0;
  const start = Date.now();
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (p < 70) {
      p += Math.random() * 2 + 0.3;
      document.getElementById('progressFill').style.width = Math.min(p, 70) + '%';
    }
    document.getElementById('progressTime').textContent = elapsed + 's elapsed';
    if (elapsed > 30 && p < 70) {
      document.getElementById('progressDetail').textContent = 'Still processing, larger files take longer...';
    }
    if (elapsed > 120) {
      document.getElementById('progressDetail').textContent = 'This is taking unusually long. The server may be waking up from sleep.';
    }
  }, 1000);
  window._progressInterval = interval;
}

function showResult(blob, filename) {
  clearInterval(window._progressInterval);
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('progressText').textContent = 'Complete!';
  document.getElementById('progressDetail').textContent = '';

  setTimeout(() => {
    document.getElementById('progressPanel').classList.add('hidden');
    document.getElementById('resultPanel').classList.remove('hidden');
    document.getElementById('resultDesc').textContent = filename + ' \u2014 Ready for TikTok';

    const dlName = filename.replace(/\.[^.]+$/, '') + '-krynox.mp4';
    const url = URL.createObjectURL(blob);

    const dl = document.getElementById('downloadBtn');
    dl.href = url;
    dl.download = dlName;

    // Auto-download
    const link = document.createElement('a');
    link.href = url;
    link.download = dlName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const isEncode = document.getElementById('encodeToggle').checked;
    const statEl = document.getElementById(isEncode ? 'statEncoded' : 'statPatched');
    const curr = parseInt(statEl.textContent.replace(/,/g, '')) || 0;
    statEl.textContent = (curr + 1).toLocaleString();
  }, 500);
}

function showErrorState(msg) {
  clearInterval(window._progressInterval);
  document.getElementById('progressText').textContent = 'Error';
  document.getElementById('progressDetail').textContent = '';
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('progressFill').style.background = 'linear-gradient(90deg,#ef4444,#dc2626)';

  setTimeout(() => {
    document.getElementById('progressPanel').classList.add('hidden');
    document.getElementById('progressFill').style.background = '';
    document.getElementById('resultPanel').classList.remove('hidden');
    document.getElementById('resultIcon').className = 'result-icon';
    document.getElementById('resultIcon').style.cssText = 'border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.1)';
    document.getElementById('resultIcon').textContent = '\u2717';
    document.querySelector('.result-title').textContent = 'Something went wrong';
    document.getElementById('resultDesc').textContent = msg || 'Please try again';
    document.getElementById('downloadBtn').style.display = 'none';
    document.querySelector('.result-panel .btn-outline').textContent = 'Try again';
  }, 600);
}

function resetUpload() {
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('streamLink').value = '';
  dropZone.classList.remove('has-file');
  dropZone.querySelector('.drop-text').textContent = 'Drop your video here or click to browse';
  dropZone.querySelector('.drop-hint').textContent = 'MP4, MOV, M4V \u2022 Maximum 500MB';
  processBtn.disabled = true;
  processBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Select a file first`;
  document.getElementById('resultPanel').classList.add('hidden');
  document.getElementById('resultIcon').style.cssText = '';
  document.getElementById('resultIcon').textContent = '\u2713';
  document.querySelector('.result-title').textContent = 'Your video is ready!';
  document.getElementById('downloadBtn').style.display = '';
  document.querySelector('.result-panel .btn-outline').textContent = 'Process another video';
  document.querySelectorAll('.upload-panel').forEach(p => p.classList.remove('hidden'));
  document.querySelector('.method-btn.active').click();
}

// ─── Animate stats on scroll ───
function animateStats() {
  document.querySelectorAll('.stat-num[id^="stat"]').forEach(async el => {
    if (el.dataset.animated) return;
    el.dataset.animated = '1';
    const target = parseInt(el.textContent.replace(/,/g, ''));
    if (target < 100) return;
    const step = Math.ceil(target / 60);
    let curr = 0;
    const int = setInterval(() => {
      curr += step;
      if (curr >= target) { curr = target; clearInterval(int); }
      el.textContent = curr.toLocaleString();
    }, 20);
  });
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) animateStats(); });
}, { threshold: .3 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) observer.observe(heroStats);
