const https=require('https');
function googleRequest(endpoint,token,body,extra={}) {
  return new Promise((resolve,reject)=>{
    const bytes=Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
    const req=https.request('https://photoslibrary.googleapis.com/v1/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':Buffer.isBuffer(body)?'application/octet-stream':'application/json','Content-Length':bytes.length,...extra}},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)res.destroy(Error('Google response too large'));else chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>{
        const text=Buffer.concat(chunks).toString();
        if(res.statusCode<200||res.statusCode>=300)return reject(Error('Google Photos returned HTTP '+res.statusCode+'. '+(res.statusCode===401?'Sign in again.':res.statusCode===403?'Check the Library API and Google consent permissions.':'Export stopped; check the new album before retrying.')));
        try{resolve(endpoint==='uploads'?text.trim():JSON.parse(text));}catch(e){reject(Error('Invalid Google Photos response'));}
      });
    });
    req.setTimeout(60000,()=>req.destroy(Error('Google Photos upload timed out.')));req.on('error',reject);req.end(bytes);
  });
}
function albumUrl(value) {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.hostname!=='photos.google.com'||u.username||u.password||u.port)throw Error('Google returned an invalid album URL.');
  return u.href;
}
async function exportAlbum({title,sources,token,job,download,api=googleRequest}) {
  try {
    const album=await api('albums',token,{album:{title}});
    job.url=albumUrl(album.productUrl);job.albumId=album.id;
    for(let start=0;start<sources.length;start+=50){
      const items=[];
      for(let i=start;i<Math.min(start+50,sources.length);i++){
        job.message='Uploading photo '+(i+1)+' of '+sources.length;
        const image=await download(sources[i]);
        if(!image.type||!image.type.startsWith('image/'))throw Error('One selected item is not a supported image.');
        const ext=image.type.includes('png')?'png':image.type.includes('webp')?'webp':'jpg';
        const uploadToken=await api('uploads',token,image.body,{'X-Goog-Upload-Protocol':'raw','X-Goog-Upload-Content-Type':image.type,'X-Goog-Upload-File-Name':'album-photo-'+(i+1)+'.'+ext});
        if(!uploadToken)throw Error('Google returned an empty upload token.');
        items.push({simpleMediaItem:{uploadToken,fileName:'album-photo-'+(i+1)+'.'+ext}});
        job.uploaded=i+1;
      }
      job.message='Adding uploaded photos to the album…';
      const result=await api('mediaItems:batchCreate',token,{albumId:album.id,newMediaItems:items});
      const results=result.newMediaItemResults||[];
      const success=results.filter(r=>r.mediaItem&&(!r.status||!r.status.code)).length;
      job.created+=success;
      if(success!==items.length)throw Error('Some photos could not be added. Open the album to review the partial export before retrying.');
    }
    job.state='complete';job.message='Album created. Open it in Google Photos, then choose Share → Create link to share it.';
  }catch(e){job.state='failed';job.message=e.message;}finally{token=null;}
}
module.exports={googleRequest,exportAlbum,albumUrl};
