const assert=require('assert');
const {exportAlbum,albumUrl}=require('./exporter.cjs');
(async()=>{
  assert.throws(()=>albumUrl('https://example.com/album'));
  const calls=[];const job={created:0,uploaded:0,state:'working'};
  const api=async(endpoint,token,body)=>{
    calls.push({endpoint,body});
    if(endpoint==='albums')return{id:'album-id',productUrl:'https://photos.google.com/album/example'};
    if(endpoint==='uploads')return'upload-token';
    return{newMediaItemResults:body.newMediaItems.map(()=>({status:{code:0},mediaItem:{id:'photo'}}))};
  };
  await exportAlbum({title:'Test',sources:Array(51).fill('test'),token:'fake',job,download:async()=>({type:'image/jpeg',body:Buffer.from('test')}),api});
  assert.equal(job.state,'complete');assert.equal(job.created,51);assert.equal(job.uploaded,51);
  assert.deepEqual(calls.filter(c=>c.endpoint==='mediaItems:batchCreate').map(c=>c.body.newMediaItems.length),[50,1]);
  const failed={state:'working',created:0,uploaded:0};
  await exportAlbum({title:'Test',sources:['test'],token:'fake',job:failed,download:async()=>{throw Error('download failed');},api});
  assert.equal(failed.state,'failed');assert.equal(failed.url,'https://photos.google.com/album/example');assert.equal(failed.created,0);
  const partial={state:'working',created:0,uploaded:0};
  await exportAlbum({title:'Test',sources:['one','two'],token:'fake',job:partial,download:async()=>({type:'image/jpeg',body:Buffer.from('test')}),api:async(e,t,b)=>e==='mediaItems:batchCreate'?{newMediaItemResults:[{mediaItem:{id:'one'}},{status:{code:3}}]}:api(e,t,b)});
  assert.equal(partial.state,'failed');assert.equal(partial.created,1);
  console.log('Export tests passed: batching, album link, download failure, and partial creation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
