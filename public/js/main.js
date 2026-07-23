document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
    hidePanel();
  });
});

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const hiddenFile = document.getElementById('hf');
const procBtn = document.getElementById('procBtn');
let currentFile = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) selectFile(fileInput.files[0]);
});

function selectFile(file) {
  if (!file.name.match(/\.(mp4|mov|m4v)$/i)) return showFileError('MP4, MOV, or M4V only');
  if (file.size > 500 * 1024 * 1024) return showFileError('Max 500MB');
  currentFile = file;
  const dt = new DataTransfer();
  dt.items.add(file);
  hiddenFile.files = dt.files;
  dropZone.classList.add('has-file');
  document.getElementById('dropMsg').textContent = file.name;
  dropZone.querySelector('.drop-sub').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  procBtn.disabled = false;
  procBtn.textContent = 'Patch Video';
}

function showFileError(msg) {
  dropZone.classList.remove('has-file');
  document.getElementById('dropMsg').textContent = msg;
  dropZone.querySelector('.drop-sub').textContent = 'Try a different file';
  procBtn.disabled = true;
  setTimeout(() => {
    document.getElementById('dropMsg').innerHTML = 'Drop video or <u>click</u> to browse';
    dropZone.querySelector('.drop-sub').textContent = 'MP4 / MOV \u2022 max 500MB';
  }, 3000);
}

procBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  const enc = document.getElementById('encToggle').checked;
  document.getElementById('he').value = enc ? '1' : '0';
  showProgress(enc);

  const fd = new FormData(document.getElementById('upForm'));

  try {
    const res = await fetch('/api/process', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const dlName = currentFile.name.replace(/\.[^.]+$/, '') + (enc ? '-encoded-krynox' : '-krynox') + currentFile.name.match(/\.[^.]+$/)?.[0] || '.mp4';

    clearInterval(window._prog);
    document.getElementById('barFill').style.width = '100%';

    const url = URL.createObjectURL(blob);
    const dl = document.getElementById('dlBtn');
    dl.href = url;
    dl.download = dlName;
    dl.textContent = '\u2B07 Download ' + dlName;
    dl.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 10000);

    setTimeout(() => {
      hideProg();
      showResult();
    }, 500);
  } catch (err) {
    clearInterval(window._prog);
    document.getElementById('progTxt').textContent = 'Error';
    document.getElementById('progSub').textContent = err.message;
  }
});

document.getElementById('linkBtn').addEventListener('click', () => {
  const link = document.getElementById('linkInput').value.trim();
  if (!link) return;
  showProgress(false);
  document.getElementById('progTxt').textContent = 'Fetching link...';
  setTimeout(() => {
    clearInterval(window._prog);
    hideProg();
    showResult();
  }, 2000);
});

function showProgress(enc) {
  hidePanel();
  document.getElementById('progPanel').classList.remove('hidden');
  document.getElementById('progTxt').textContent = enc ? 'Encoding (2-3 min)...' : 'Patching...';
  document.getElementById('progSub').textContent = enc ? 'This takes a while' : '~10 seconds';
  let sec = 0, pct = 0;
  window._prog = setInterval(() => {
    sec++;
    if (pct < 80) {
      pct += Math.random() * 2 + 0.5;
      document.getElementById('barFill').style.width = Math.min(pct, 80) + '%';
    }
  }, 1000);
}

function hideProg() {
  document.getElementById('progPanel').classList.add('hidden');
  if (window._prog) clearInterval(window._prog);
}

function showResult() {
  document.getElementById('resPanel').classList.remove('hidden');
}

function hidePanel() {
  document.getElementById('progPanel').classList.add('hidden');
  document.getElementById('resPanel').classList.add('hidden');
}

function resetAll() {
  currentFile = null;
  hidePanel();
  document.getElementById('barFill').style.width = '0%';
  document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector('.tab[data-tab="file"]').classList.add('active');
  document.getElementById('tab-file').classList.add('active');
  dropZone.classList.remove('has-file');
  document.getElementById('dropMsg').innerHTML = 'Drop video or <u>click</u> to browse';
  dropZone.querySelector('.drop-sub').textContent = 'MP4 / MOV \u2022 max 500MB';
  procBtn.disabled = true;
  procBtn.textContent = 'Select a file';
  document.getElementById('linkInput').value = '';
  const dl = document.getElementById('dlBtn');
  dl.href = '#';
  dl.textContent = 'Download';
}
