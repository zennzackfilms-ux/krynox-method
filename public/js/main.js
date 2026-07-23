function toggleFaq(el) {
  el.parentElement.classList.toggle('open');
}

document.querySelectorAll('.method-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.upload-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('upload' + btn.dataset.method.charAt(0).toUpperCase() + btn.dataset.method.slice(1)).classList.remove('hidden');
    document.getElementById('resultPanel').classList.add('hidden');
  });
});

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const hiddenFormInput = document.getElementById('formFileInput');
const processBtn = document.getElementById('processBtn');
const dlFrame = document.getElementById('dlframe');

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
  if (!file.name.match(/\.(mp4|mov|m4v)$/i)) return showFileError('Please select an MP4, MOV, or M4V file.');
  if (file.size > 500 * 1024 * 1024) return showFileError('File exceeds 500MB limit.');
  const dt = new DataTransfer();
  dt.items.add(file);
  hiddenFormInput.files = dt.files;
  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-text').textContent = file.name;
  dropZone.querySelector('.drop-hint').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  processBtn.disabled = false;
  processBtn.innerHTML = 'Patch Video';
}

function showFileError(msg) {
  dropZone.classList.remove('has-file');
  dropZone.querySelector('.drop-text').textContent = msg;
  dropZone.querySelector('.drop-hint').textContent = 'Try a different file';
  processBtn.disabled = true;
  setTimeout(() => {
    dropZone.querySelector('.drop-text').textContent = 'Drop your video here or click to browse';
    dropZone.querySelector('.drop-hint').textContent = 'MP4, MOV, M4V \u2022 Maximum 500MB';
  }, 4000);
}

processBtn.addEventListener('click', () => {
  if (!hiddenFormInput.files.length) return;
  dlFrame.onload = () => {
    clearInterval(window._prog);
    document.getElementById('progressPanel').classList.add('hidden');
    document.getElementById('resultPanel').classList.remove('hidden');
  };
  document.getElementById('formEncode').value = document.getElementById('encodeToggle').checked ? '1' : '0';
  showProgress();
  document.getElementById('uploadForm').submit();
});

function showProgress() {
  document.querySelector('.upload-panel:not(.hidden)').classList.add('hidden');
  document.getElementById('progressPanel').classList.remove('hidden');
  document.getElementById('resultPanel').classList.add('hidden');
  let sec = 0;
  window._prog = setInterval(() => {
    sec++;
    document.getElementById('progressTime').textContent = sec + 's elapsed';
  }, 1000);
}

const statObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      document.querySelectorAll('.stat-num[id^="stat"]').forEach(el => {
        if (el.dataset.animated) return;
        el.dataset.animated = '1';
        const target = parseInt(el.textContent.replace(/,/g, ''));
        if (target < 100) return;
        const step = Math.ceil(target / 60);
        let curr = 0;
        setInterval(() => {
          curr += step;
          if (curr >= target) { curr = target; clearInterval(this); }
          el.textContent = curr.toLocaleString();
        }, 20);
      });
    }
  });
}, { threshold: .3 });
const heroStats = document.querySelector('.hero-stats');
if (heroStats) statObserver.observe(heroStats);
