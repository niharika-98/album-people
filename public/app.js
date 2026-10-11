const $ = id => document.getElementById(id);
let album, faces = [], groups = [], selected = null, scanning = false, cancelled = false;
let modelPromise;
let corrections=[];
let exportPhotos=[],exportConfig=null,exportBusy=false;
let handoffPhotos=[];
let drivePhotos=[],driveBusy=false;
function originalPhotoLink(photo){
  const url=new URL(album.sourceUrl);
  url.pathname=url.pathname.replace(/\/$/,'')+'/photo/'+encodeURIComponent(photo.id);
  return url.href;
}
fetch('/api/export-config').then(r=>r.json()).then(c=>{exportConfig=c;}).catch(()=>{});
function status(message) { $('status').textContent = message; }
function loadModels() {
  if (!window.faceapi) throw Error('Face library could not load. Check your internet connection and reload.');
  if (!modelPromise) {
    const base = 'https://justadudewhohacks.github.io/face-api.js/models';
    modelPromise = Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri(base),faceapi.nets.faceLandmark68Net.loadFromUri(base),faceapi.nets.faceRecognitionNet.loadFromUri(base)]).catch(e => { modelPromise = null; throw e; });
  }
  return modelPromise;
}
function gallery() {
  const photos = album.photos.filter(p => selected === null || groups[selected].photos.has(p.id));
  $('filter-title').textContent = selected === null ? 'All photos' : 'Person ' + (selected + 1);
  $('count').textContent = photos.length + ' photos';
  $('export-actions').hidden=false;
  $('export-open').disabled=scanning||exportBusy||!photos.length;
  $('handoff-open').disabled=scanning||!photos.length||!album.sourceUrl;
  $('drive-open').disabled=scanning||driveBusy||!photos.length;
  $('gallery').replaceChildren(...photos.map(p => {
    const button = document.createElement('button'); button.className = 'photo'; button.setAttribute('aria-label','Open photo');
    const img = document.createElement('img'); img.src = p.image; img.loading = 'lazy'; img.alt = 'Album photo'; button.append(img);
    button.onclick = () => { $('full').src = p.image; $('viewer').showModal(); };
    return button;
  }));
}
function regroup() {
  const anchor = selected === null ? null : groups[selected]?.members[0].id;
  selected = null;
  const threshold = Number($('threshold').value);
  groups = FaceClustering.clusterFaces(faces,threshold,corrections);
  if (anchor) { const index = groups.findIndex(g => g.members.some(f=>f.id===anchor)); if (index >= 0) selected = index; }
  renderPeople(); gallery();
}
function renderPeople() {
  const all = document.createElement('button'); all.className='person'; all.textContent='All photos'; all.setAttribute('aria-pressed',String(selected===null)); all.onclick=()=>{selected=null;renderPeople();gallery();};
  const buttons = groups.map((g,i)=>{
    const b=document.createElement('button');b.className='person';b.setAttribute('aria-pressed',String(selected===i));
    const img=document.createElement('img');img.src=g.crop;img.alt='Face group '+(i+1);
    const label=document.createElement('span');label.textContent='Person '+(i+1);
    const count=document.createElement('small');count.textContent=g.photos.size+' photos';b.append(img,label,count);
    b.onclick=()=>{selected=i;renderPeople();gallery();};return b;
  });
  $('people').replaceChildren(all,...buttons);
  $('correction').hidden=selected===null||scanning;
  if(selected!==null){
    $('merge-target').replaceChildren(...groups.flatMap((g,i)=>{
      if(i===selected)return [];
      const option=document.createElement('option');option.value=i;option.textContent='Person '+(i+1)+' · '+g.photos.size+' photos';return [option];
    }));
    $('merge').disabled=groups.length<2;
    $('merge-preview').hidden=groups.length<2;
    if(groups.length>1)$('merge-preview').src=groups[Number($('merge-target').value)].crop;
  }
}
$('import').onsubmit = async e => {
  e.preventDefault(); if(scanning)return;
  $('submit').disabled=true;status('Reading the shared album…');
  try {
    const response=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('url').value.trim()})});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    album=result;faces=[];groups=[];corrections=[];selected=null;$('title').textContent=album.title;$('workspace').hidden=false;renderPeople();gallery();
    status(album.complete ? `Imported all ${album.photos.length} photos. Select “Find people” to scan faces.` : `Imported ${album.photos.length} of ${album.total || 'an unknown number of'} photos. This album may be incomplete; pagination is not yet supported.`);
  }catch(e){status(e.message);}finally{$('submit').disabled=false;}
};
$('scan').onclick = async () => {
  if(!album||scanning)return;
  scanning=true;cancelled=false;faces=[];corrections=[];groups=[];selected=null;renderPeople();$('drive-open').disabled=true;$('handoff-open').disabled=true;$('export-open').disabled=true;$('scan').disabled=true;$('submit').disabled=true;$('threshold').disabled=true;$('stop').hidden=false;$('progress').hidden=false;$('progress').max=album.photos.length;$('progress').value=0;
  let failed=0,processed=0;
  try {
    status('Loading face models. The first scan may take a little longer…');await loadModels();
    for(const photo of album.photos){
      if(cancelled)break;
      status(`Scanning photo ${processed+1} of ${album.photos.length}…`);
      try{
        const img=await faceapi.fetchImage(photo.image);
        const detections=await faceapi.detectAllFaces(img,new faceapi.SsdMobilenetv1Options({minConfidence:0.5})).withFaceLandmarks().withFaceDescriptors();
        for(const [faceIndex,detection] of detections.entries()){
          const b=detection.detection.box,pad=Math.max(b.width,b.height)*0.15;
          const x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad),w=Math.min(img.naturalWidth-x,b.width+2*pad),h=Math.min(img.naturalHeight-y,b.height+2*pad);
          const canvas=document.createElement('canvas');canvas.width=112;canvas.height=112;canvas.getContext('2d').drawImage(img,x,y,w,h,0,0,112,112);
          faces.push({id:photo.id+':'+faceIndex,photo:photo.id,descriptor:detection.descriptor,crop:canvas.toDataURL('image/jpeg',0.85),quality:detection.detection.score*Math.min(b.width,b.height)});
        }
      }catch(e){failed++;}
      processed++;$('progress').value=processed;
      if(processed%10===0)regroup();
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    regroup();status(`${cancelled?'Stopped':'Scan complete'}: ${processed} photos scanned, ${faces.length} faces in ${groups.length} estimated person groups. ${failed} photos could not be analyzed. Adjust sensitivity to refine groups.`);
  }catch(e){status('Face scan failed: '+e.message);}finally{scanning=false;renderPeople();$('drive-open').disabled=driveBusy;$('handoff-open').disabled=!album.sourceUrl;$('export-open').disabled=exportBusy;$('scan').disabled=false;$('submit').disabled=false;$('threshold').disabled=false;$('stop').hidden=true;$('progress').hidden=true;}
};
$('stop').onclick=()=>{cancelled=true;status('Stopping after the current photo…');};
$('threshold').oninput=()=>{$('threshold-value').textContent=$('threshold').value;if(faces.length)regroup();};
$('close').onclick=()=>$('viewer').close();
$('merge').onclick=()=>{
  if(selected===null||scanning)return;
  const a=groups[selected],b=groups[Number($('merge-target').value)];
  if(!b)return;
  for(const photo of a.photos)if(b.photos.has(photo)){status('These groups contain two different faces in the same photo. They cannot be merged automatically.');return;}
  const combined=[...a.members,...b.members];
  for(const face of combined.slice(1))corrections.push([combined[0].id,face.id]);
  regroup();status('Merged the selected groups. This correction stays in place when you adjust sensitivity.');
};
$('undo-merge').onclick=()=>{corrections=[];regroup();status('Manual merges reset. Automatic face groups restored.');};
$('merge-target').onchange=()=>{$('merge-preview').src=groups[Number($('merge-target').value)].crop;};
$('drive-open').onclick=()=>{
  drivePhotos=album.photos.filter(p=>selected===null||groups[selected].photos.has(p.id));
  $('drive-summary').textContent=drivePhotos.length+' '+(selected===null?'album photos':'photos containing Person '+(selected+1))+'.';
  $('drive-status').textContent='Prepare a ZIP, then open Drive to upload it.';$('drive-dialog').showModal();
};
$('drive-close').onclick=()=>$('drive-dialog').close();
$('drive-download').onclick=async()=>{
  if(driveBusy)return;
  const photos=drivePhotos.slice(),files=[];let bytes=0;
  driveBusy=true;$('drive-download').disabled=true;$('drive-open').disabled=true;$('submit').disabled=true;$('scan').disabled=true;
  try{
    for(const [i,photo] of photos.entries()){
      $('drive-status').textContent='Preparing photo '+(i+1)+' of '+photos.length+'…';
      const response=await fetch(photo.image);if(!response.ok)throw Error('A photo could not be downloaded. No incomplete ZIP was saved.');
      const type=(response.headers.get('Content-Type')||'').split(';')[0];if(!type.startsWith('image/'))throw Error('A selected item is not an image.');
      const data=new Uint8Array(await response.arrayBuffer());bytes+=data.length;
      if(bytes>128*1024*1024)throw Error('This selection exceeds the 128 MB browser export limit. Choose a smaller person group.');
      const ext=type==='image/png'?'png':type==='image/webp'?'webp':type==='image/gif'?'gif':'jpg';
      files.push({name:'photo-'+String(i+1).padStart(4,'0')+'.'+ext,bytes:data});
    }
    const zip=PhotoZip.buildZip(files),url=URL.createObjectURL(zip),link=document.createElement('a');
    link.href=url;link.download='selected-photos.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('drive-status').textContent='ZIP ready: '+files.length+' photos, '+(zip.size/1024/1024).toFixed(1)+' MB. Open Drive and upload the ZIP or its extracted folder.';
  }catch(e){$('drive-status').textContent=e.message;}finally{files.length=0;driveBusy=false;$('drive-download').disabled=false;$('drive-open').disabled=scanning;$('submit').disabled=scanning;$('scan').disabled=scanning;}
};
$('handoff-open').onclick=()=>{
  handoffPhotos=album.photos.filter(p=>selected===null||groups[selected].photos.has(p.id));
  $('handoff-summary').textContent=handoffPhotos.length+' matching photos. No photo files are downloaded or uploaded by this handoff.';
  $('handoff-album').href=album.sourceUrl;
  $('handoff-status').textContent='Use the links below as a reference when selecting photos in Google Photos.';
  $('handoff-photos').replaceChildren(...handoffPhotos.map((p,i)=>{
    const link=document.createElement('a');link.href=originalPhotoLink(p);link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open matching photo '+(i+1)+' in Google Photos');
    const img=document.createElement('img');img.src=p.image;img.loading='lazy';img.alt='Matching photo '+(i+1);img.style.cssText='width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px';link.append(img);return link;
  }));
  $('handoff-dialog').showModal();
};
$('handoff-close').onclick=()=>$('handoff-dialog').close();
$('handoff-copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(handoffPhotos.map(originalPhotoLink).join('\n'));$('handoff-status').textContent='Copied '+handoffPhotos.length+' photo links. Anyone with these links may access the original shared album.';}catch(e){$('handoff-status').textContent='Clipboard access failed. Use Save selection list instead.';}
};
$('handoff-save').onclick=()=>{
  const selection={albumTitle:album.title,sourceAlbum:album.sourceUrl,photos:handoffPhotos.map(p=>({id:p.id,url:originalPhotoLink(p)}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(selection,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='selected-photo-links.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  $('handoff-status').textContent='Saved photo links and IDs only. No photo files or face data are included.';
};
$('export-open').onclick=async()=>{
  exportPhotos=album.photos.filter(p=>selected===null||groups[selected].photos.has(p.id));
  $('export-summary').textContent='Export '+exportPhotos.length+' '+(selected===null?'album photos':'photos containing Person '+(selected+1))+'.';
  $('export-title').value=album.title.trim()+(selected===null?' — Export':' — Person '+(selected+1));
  $('export-result').hidden=true;$('export-dialog').showModal();
  if(!exportConfig){try{exportConfig=await(await fetch('/api/export-config')).json();}catch(e){}}
  $('export-status').textContent=exportConfig?.clientId?'You will choose the destination Google account when signing in.':'Google export is not configured yet. Set GOOGLE_CLIENT_ID on the server using the Google Cloud setup in README.md. Enable the Photos Library API and register http://localhost:3000 as an authorized JavaScript origin.';
  $('export-start').disabled=!exportConfig?.clientId||exportBusy;
};
$('export-close').onclick=()=>$('export-dialog').close();
$('export-start').onclick=()=>{
  if(exportBusy)return;
  if(!$('export-title').value.trim()){$('export-status').textContent='Enter an album title.';return;}
  if(!window.google?.accounts?.oauth2){$('export-status').textContent='Google sign-in could not load. Check your connection and try again.';return;}
  const title=$('export-title').value.trim(),photos=exportPhotos.slice();
  const client=google.accounts.oauth2.initTokenClient({client_id:exportConfig.clientId,scope:'https://www.googleapis.com/auth/photoslibrary.appendonly',error_callback:()=>{$('export-status').textContent='Google sign-in was cancelled or could not open.';},callback:async response=>{
    if(response.error||!response.access_token){$('export-status').textContent='Google sign-in did not grant permission to create the album.';return;}
    exportBusy=true;$('export-start').disabled=true;$('export-title').disabled=true;$('export-open').disabled=true;
    try{
      const result=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+response.access_token},body:JSON.stringify({title,images:photos.map(p=>p.image)})});
      response.access_token=null;
      const data=await result.json();if(!result.ok)throw Error(data.error);
      while(true){
        const poll=await fetch('/api/export/'+data.id);const job=await poll.json();if(!poll.ok)throw Error(job.error);
        $('export-status').textContent=job.message+' ('+job.created+'/'+job.total+' photos added)';
        if(job.url){$('export-result').href=job.url;$('export-result').hidden=false;}
        if(job.state!=='working')break;
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
    }catch(e){$('export-status').textContent=e.message;}finally{response.access_token=null;exportBusy=false;$('export-start').disabled=false;$('export-title').disabled=false;$('export-open').disabled=scanning;}
  }});
  client.requestAccessToken({prompt:'select_account'});
};
