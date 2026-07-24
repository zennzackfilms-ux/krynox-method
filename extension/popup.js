const dz=document.getElementById('dz'),fi=document.getElementById('fi'),btn=document.getElementById('btn');
const mt=document.getElementById('mt'),md=document.getElementById('md');
let cur=null,mode='patch';

mt.querySelectorAll('.mtt').forEach(t=>{t.onclick=()=>{
  mt.querySelectorAll('.mtt').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');mode=t.dataset.m;
  md.innerHTML=mode==='patch'?'⚡ Patch metadata — works offline, same file size (stops TikTok compression)':'📦 Sends to server for ffmpeg encoding — lower MB, keeps quality (needs internet, takes 2-3 min)';
  btn.textContent=!cur?'Select a file':mode==='patch'?'⚡ Patch Video':'📦 Compress Video';
}});

dz.onclick=()=>fi.click();
dz.ondragover=e=>{e.preventDefault();dz.classList.add('ov')};
dz.ondragleave=()=>dz.classList.remove('ov');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('ov');if(e.dataTransfer.files.length)set(e.dataTransfer.files[0])};
fi.onchange=()=>{if(fi.files.length)set(fi.files[0])};

function set(f){
  if(!f.name.match(/\.(mp4|mov|m4v)$/i))return er('MP4/MOV/M4V only');
  if(f.size>500e6)return er('Max 500MB');
  cur=f;dz.classList.add('ok');
  document.getElementById('dm').textContent=f.name;
  dz.querySelector('.ds').textContent=(f.size/1e6).toFixed(1)+' MB';
  btn.disabled=false;
  btn.textContent=mode==='patch'?'⚡ Patch Video':'📦 Compress Video';
}
function er(m){
  dz.classList.remove('ok');
  document.getElementById('dm').textContent=m;
  dz.querySelector('.ds').textContent='Try another file';
  btn.disabled=true;
  setTimeout(()=>{document.getElementById('dm').innerHTML='Drop video or <u>click</u> to browse';dz.querySelector('.ds').textContent='MP4 / MOV • max 500MB'},3000);
}

btn.onclick=()=>{
  if(!cur)return;
  if(mode==='compress'){compress();return}
  // Quick patch (offline)
  document.querySelector('.drop').classList.add('h');mt.classList.add('h');btn.classList.add('h');
  document.getElementById('pp').classList.remove('h');document.getElementById('rp').classList.add('h');
  document.getElementById('pt').textContent='Patching locally...';
  document.getElementById('ps').textContent='Your file never leaves this device';
  document.getElementById('bf').className='bf';
  let p=0;
  window._p=setInterval(()=>{if(p<80){p+=Math.random()*3+1;document.getElementById('bf').style.width=Math.min(p,80)+'%'}},200);
  const r=new FileReader();
  r.onload=e=>{try{
    const buf=e.target.result,orig=new Uint8Array(buf.slice(0));
    patchMP4(buf);
    let ch=false;const now=new Uint8Array(buf);
    for(let i=0;i<orig.length;i++){if(orig[i]!==now[i]){ch=true;break}}
    setTimeout(()=>{clearInterval(window._p);document.getElementById('bf').style.width='100%';setTimeout(()=>{
      document.getElementById('pp').classList.add('h');if(window._p)clearInterval(window._p);
      const ext=cur.name.match(/\.[^.]+$/)?.[0]||'.mp4',base=cur.name.replace(/\.[^.]+$/,''),dn=base+'-krynox'+ext;
      const blob=new Blob([buf],{type:'video/mp4'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=dn;a.style.display='none';
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      document.getElementById('rp').classList.remove('h');
      document.getElementById('rpT').textContent='Patched & Ready';
      document.getElementById('rpD').textContent=ch?'✓ Patched — same size is normal (metadata only)':'✓ Already optimized';
      const fb=document.getElementById('fb');fb.href=url;fb.download=dn;fb.classList.remove('h');
    },400)},500);
  }catch(e){clearInterval(window._p);document.getElementById('pt').textContent='⚠ Error: '+e.message}};
  r.onerror=()=>{clearInterval(window._p);document.getElementById('pt').textContent='⚠ Failed to read file'};
  r.readAsArrayBuffer(cur);
};

function compress(){
  document.querySelector('.drop').classList.add('h');mt.classList.add('h');btn.classList.add('h');
  document.getElementById('pp').classList.remove('h');document.getElementById('rp').classList.add('h');
  document.getElementById('pt').textContent='Uploading to server...';
  document.getElementById('ps').textContent='Sending file...';
  document.getElementById('bf').className='bf amber';
  let p=0,sec=0;
  window._p=setInterval(()=>{sec++;if(p<80){p+=Math.random()*1.5+0.5;document.getElementById('bf').style.width=Math.min(p,80)+'%'}
    document.getElementById('ps').textContent='Processing '+sec+'s... (up to 3 min)';},1000);

  const fd=new FormData();
  fd.append('video',cur);
  fd.append('encode','1');
  fetch('https://method.evosmp.eu/api/process',{method:'POST',body:fd}).then(r=>{
    if(!r.ok)throw new Error('Server error');
    return r.blob();
  }).then(blob=>{
    clearInterval(window._p);document.getElementById('bf').style.width='100%';
    setTimeout(()=>{
      document.getElementById('pp').classList.add('h');
      const fn=cur.name.replace(/\.[^.]+$/,'')+'-compressed-krynox.mp4';
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=fn;a.style.display='none';
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      document.getElementById('rp').classList.remove('h');
      document.getElementById('rpT').textContent='Compressed ✓';
      document.getElementById('rpD').textContent='File saved — lower MB, same quality';
      const fb=document.getElementById('fb');fb.href=url;fb.download=fn;fb.classList.remove('h');
    },400);
  }).catch(e=>{
    clearInterval(window._p);document.getElementById('bf').style.width='100%';
    setTimeout(()=>{
      document.getElementById('pp').classList.add('h');
      document.getElementById('rp').classList.remove('h');
      document.getElementById('rpT').textContent='Server Unavailable';
      document.getElementById('rpD').textContent='Could not reach the server. Try the website.';
      document.getElementById('fb').classList.add('h');
      const rp=document.getElementById('rp');
      const btn=rp.querySelector('.btn.ghost');
      btn.insertAdjacentHTML('beforebegin','<a class="btn" href="https://method.evosmp.eu" target="_blank" style="margin-bottom:4px">🌐 Open Website</a>');
    },400);
  });
}

function rst(){
  cur=null;
  document.getElementById('rp').classList.add('h');document.getElementById('pp').classList.add('h');
  document.getElementById('bf').style.width='0%';document.getElementById('fb').classList.add('h');
  document.querySelector('.drop').classList.remove('h');mt.classList.remove('h');btn.classList.remove('h');
  document.querySelector('.drop').classList.remove('ok');
  document.getElementById('dm').innerHTML='Drop video or <u>click</u> to browse';
  dz.querySelector('.ds').textContent='MP4 / MOV • max 500MB';
  btn.disabled=true;btn.textContent='Select a file';
  if(window._p)clearInterval(window._p);
  // Remove fallback buttons added by compress
  document.getElementById('rp').querySelectorAll('.btn[href*="method.evosmp"]').forEach(e=>e.remove());
}
