const dz = document.getElementById('dz');
const fi = document.getElementById('fi');
const btn = document.getElementById('btn');
let cur = null;

dz.onclick = () => fi.click();
dz.ondragover = e => { e.preventDefault(); dz.classList.add('ov'); };
dz.ondragleave = () => dz.classList.remove('ov');
dz.ondrop = e => {
  e.preventDefault();
  dz.classList.remove('ov');
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
};
fi.onchange = () => { if (fi.files.length) setFile(fi.files[0]); };

function setFile(f) {
  if (!f.name.match(/\.(mp4|mov|m4v)$/i)) return err('MP4/MOV/M4V only');
  if (f.size > 500e6) return err('Max 500MB');
  cur = f;
  dz.classList.add('ok');
  document.getElementById('dm').textContent = f.name;
  dz.querySelector('.ds').textContent = (f.size / 1e6).toFixed(1) + ' MB';
  btn.disabled = false;
  btn.textContent = '⚡ Patch Video';
}

function err(m) {
  dz.classList.remove('ok');
  document.getElementById('dm').textContent = m;
  dz.querySelector('.ds').textContent = 'Try another file';
  btn.disabled = true;
  setTimeout(() => {
    document.getElementById('dm').innerHTML = 'Drop video or <u>click</u> to browse';
    dz.querySelector('.ds').textContent = 'MP4 / MOV • max 500MB • Stays on your device';
  }, 3000);
}

btn.onclick = () => {
  if (!cur) return;
  showProg();
  const r = new FileReader();
  r.onload = e => {
    try {
      const buf = e.target.result;
      const orig = new Uint8Array(buf.slice(0));
      patchMP4(buf);
      let changed = false;
      const now = new Uint8Array(buf);
      for (let i = 0; i < orig.length; i++) { if (orig[i] !== now[i]) { changed = true; break; } }
      setTimeout(() => {
        clearInterval(window._p);
        document.getElementById('bf').style.width = '100%';
        setTimeout(() => { hideProg(); dload(buf, cur.name, changed); }, 400);
      }, 500);
    } catch (err) {
      clearInterval(window._p);
      document.getElementById('pt').textContent = '⚠ Error: ' + err.message;
    }
  };
  r.onerror = () => { clearInterval(window._p); document.getElementById('pt').textContent = '⚠ Failed to read file'; };
  r.readAsArrayBuffer(cur);
};

function dload(buf, name, changed) {
  const ext = name.match(/\.[^.]+$/)?.[0] || '.mp4';
  const base = name.replace(/\.[^.]+$/, '');
  const dlName = base + '-krynox' + ext;
  const blob = new Blob([buf], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = dlName; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  document.getElementById('rp').classList.remove('h');
  document.getElementById('ds2').textContent = changed ? '✓ Metadata patched for TikTok' : '⚠ No changes needed';
  const fb = document.getElementById('fb');
  fb.href = url; fb.download = dlName; fb.classList.remove('h');
}

function showProg() {
  document.querySelector('.drop').classList.add('h');
  btn.classList.add('h');
  document.getElementById('pp').classList.remove('h');
  document.getElementById('rp').classList.add('h');
  document.getElementById('pt').textContent = 'Patching locally...';
  document.getElementById('ps').textContent = 'Your file never leaves this device';
  let p = 0;
  window._p = setInterval(() => { if (p < 80) { p += Math.random() * 3 + 1; document.getElementById('bf').style.width = Math.min(p, 80) + '%'; } }, 200);
}

function hideProg() { document.getElementById('pp').classList.add('h'); if (window._p) clearInterval(window._p); }

function resetAll() {
  cur = null;
  document.getElementById('rp').classList.add('h');
  document.getElementById('pp').classList.add('h');
  document.getElementById('bf').style.width = '0%';
  document.getElementById('fb').classList.add('h');
  document.querySelector('.drop').classList.remove('h'); btn.classList.remove('h');
  document.querySelector('.drop').classList.remove('ok');
  document.getElementById('dm').innerHTML = 'Drop video or <u>click</u> to browse';
  dz.querySelector('.ds').textContent = 'MP4 / MOV • max 500MB • Stays on your device';
  btn.disabled = true; btn.textContent = 'Select a file';
}
