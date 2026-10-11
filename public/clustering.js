(function(root) {
  function distance(a,b) { let sum=0; for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2; return Math.sqrt(sum); }
  function overlap(a,b) { for(const p of a)if(b.has(p))return true; return false; }
  function clusterFaces(faces, threshold=0.56, corrections=[]) {
    const n=faces.length;
    const clusters=faces.map((face,i)=>({members:[i],photos:new Set([face.photo])}));
    const mean=Array.from({length:n},()=>new Float32Array(n));
    const max=Array.from({length:n},()=>new Float32Array(n));
    for(let i=0;i<n;i++)for(let j=0;j<i;j++)mean[i][j]=mean[j][i]=max[i][j]=max[j][i]=distance(faces[i].descriptor,faces[j].descriptor);
    function merge(a,b) {
      const left=clusters[a],right=clusters[b],total=left.members.length+right.members.length;
      for(let k=0;k<n;k++)if(clusters[k]&&k!==a&&k!==b){
        const value=(mean[a][k]*left.members.length+mean[b][k]*right.members.length)/total;
        mean[a][k]=mean[k][a]=value;max[a][k]=max[k][a]=Math.max(max[a][k],max[b][k]);
      }
      left.members.push(...right.members);for(const photo of right.photos)left.photos.add(photo);clusters[b]=null;
    }
    // Explicit user corrections are applied before automatic matching.
    for(const [first,second] of corrections){
      const a=clusters.findIndex(c=>c&&c.members.some(i=>faces[i].id===first));
      const b=clusters.findIndex(c=>c&&c.members.some(i=>faces[i].id===second));
      if(a>=0&&b>=0&&a!==b&&!overlap(clusters[a].photos,clusters[b].photos))merge(a,b);
    }
    // Merge the closest clusters across the entire album. Average linkage allows
    // pose/expression variation without an unbounded chain of weak matches.
    while(true){
      let best=threshold,a=-1,b=-1;
      for(let i=0;i<n;i++)if(clusters[i])for(let j=0;j<i;j++)if(clusters[j]){
        if(mean[i][j]>best||max[i][j]>threshold+0.16||overlap(clusters[i].photos,clusters[j].photos))continue;
        best=mean[i][j];a=i;b=j;
      }
      if(a<0)break;merge(a,b);
    }
    return clusters.filter(Boolean).map(c=>{
      const members=c.members.map(i=>faces[i]);
      const representative=members.reduce((best,f)=> (f.quality||0)>(best.quality||0)?f:best,members[0]);
      return {members,descriptors:members.map(f=>f.descriptor),photos:c.photos,crop:representative.crop};
    }).sort((a,b)=>b.photos.size-a.photos.size);
  }
  if(typeof module!=='undefined')module.exports={clusterFaces,distance};
  else root.FaceClustering={clusterFaces,distance};
})(typeof window==='undefined'?globalThis:window);
