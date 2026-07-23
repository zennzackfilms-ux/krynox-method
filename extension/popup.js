const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const procBtn = document.getElementById('procBtn');
const encToggle = document.getElementById('encToggle');
let currentFile = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

encToggle.addEventListener('change', () => {
  if (encToggle.checked) {
    document.getElementById('progSub').textContent =
      'Advanced Encoding requires the web version (method.evosmp.eu). Quick patch is local.';
  }
});

function handleFile(file) {
  if (!file.name.match(/\.(mp4|mov|m4v)$/i)) return showError('MP4, MOV, or M4V only');
  if (file.size > 500 * 1024 * 1024) return showError('Max 500MB');
  currentFile = file;
  dropZone.classList.add('has-file');
  document.getElementById('dropMsg').textContent = file.name;
  dropZone.querySelector('.drop-sub').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  procBtn.disabled = false;
  procBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Patch Video';
}

function showError(msg) {
  dropZone.classList.remove('has-file');
  document.getElementById('dropMsg').textContent = msg;
  dropZone.querySelector('.drop-sub').textContent = 'Try a different file';
  procBtn.disabled = true;
  setTimeout(() => {
    document.getElementById('dropMsg').innerHTML = 'Drop video or <u>click</u> to browse';
    dropZone.querySelector('.drop-sub').textContent = 'MP4 / MOV \u2022 max 500MB \u2022 Stays on your computer';
  }, 3000);
}

procBtn.addEventListener('click', () => {
  if (!currentFile) return;
  if (encToggle.checked) {
    document.getElementById('progSub').textContent =
      'Advanced Encoding requires the server version. Open method.evosmp.eu in your browser.';
    return;
  }
  showProgress();
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const arr = new Uint8Array(e.target.result);
      const original = new Uint8Array(arr);
      patchMP4(arr.buffer);
      const changed = buffersDiffer(original, new Uint8Array(arr.buffer));
      setTimeout(() => {
        clearInterval(window._prog);
        document.getElementById('barFill').style.width = '100%';
        setTimeout(() => {
          hideProg();
          triggerDownload(arr.buffer, currentFile.name, changed);
        }, 400);
      }, 600);
    } catch (err) {
      clearInterval(window._prog);
      document.getElementById('progTxt').textContent = 'Error: ' + err.message;
    }
  };
  reader.onerror = function() {
    clearInterval(window._prog);
    document.getElementById('progTxt').textContent = 'Failed to read file';
  };
  reader.readAsArrayBuffer(currentFile);
});

function buffersDiffer(a, b) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

function triggerDownload(buf, fileName, changed) {
  const ext = fileName.match(/\.[^.]+$/)?.[0] || '.mp4';
  const base = fileName.replace(/\.[^.]+$/, '');
  const dlName = base + '-krynox' + ext;
  const blob = new Blob([buf], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = dlName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  document.getElementById('resPanel').classList.remove('hidden');
  const dlBtn = document.getElementById('dlBtn');
  dlBtn.href = url;
  dlBtn.download = dlName;
  dlBtn.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function showProgress() {
  document.querySelector('.drop').classList.add('hidden');
  document.getElementById('procBtn').classList.add('hidden');
  document.querySelector('.opt').classList.add('hidden');
  document.getElementById('progPanel').classList.remove('hidden');
  document.getElementById('resPanel').classList.add('hidden');
  document.getElementById('progTxt').textContent = 'Patching locally...';
  document.getElementById('progSub').textContent = 'Your file never leaves this device';
  let sec = 0, pct = 0;
  window._prog = setInterval(() => {
    sec++;
    if (pct < 80) {
      pct += Math.random() * 3 + 1;
      document.getElementById('barFill').style.width = Math.min(pct, 80) + '%';
    }
  }, 200);
}

function hideProg() {
  document.getElementById('progPanel').classList.add('hidden');
  if (window._prog) clearInterval(window._prog);
}

function resetAll() {
  currentFile = null;
  document.getElementById('resPanel').classList.add('hidden');
  document.getElementById('progPanel').classList.add('hidden');
  document.getElementById('barFill').style.width = '0%';
  document.querySelector('.drop').classList.remove('hidden');
  document.getElementById('procBtn').classList.remove('hidden');
  document.querySelector('.opt').classList.remove('hidden');
  dropZone.classList.remove('has-file');
  document.getElementById('dropMsg').innerHTML = 'Drop video or <u>click</u> to browse';
  dropZone.querySelector('.drop-sub').textContent = 'MP4 / MOV \u2022 max 500MB \u2022 Stays on your computer';
  procBtn.disabled = true;
  procBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Select a file';
}
