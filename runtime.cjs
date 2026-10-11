const crypto=require('crypto');
function configuration(env=process.env){
  const port=Number(env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
  const configured=env.APP_ORIGIN||env.RENDER_EXTERNAL_URL;
  const origins=configured?[new URL(configured).origin]:['http://localhost:'+port,'http://127.0.0.1:'+port];
  return {port,origins,hosts:origins.map(value=>new URL(value).host),host:env.HOST||(configured?'0.0.0.0':'127.0.0.1'),secure:origins.every(value=>value.startsWith('https:'))};
}
function createSessions({now=()=>Date.now(),max=100,ttl=2*60*60*1000}={}){
  const sessions=new Map();
  return function session(req,res,secure){
    const time=now();for(const [id,value] of sessions)if(time-value.lastSeen>ttl)sessions.delete(id);
    let id=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('album_session='));
    id=id? id.slice('album_session='.length):null;
    let value=id&&sessions.get(id);
    if(!value){
      if(sessions.size>=max)throw Error('The server is busy. Please try again later.');
      id=crypto.randomBytes(24).toString('hex');value={images:new Map(),exportsInProgress:new Map(),lastSeen:time,imports:[]};sessions.set(id,value);
      res.setHeader('Set-Cookie','album_session='+id+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+Math.floor(ttl/1000)+(secure?'; Secure':''));
    }
    value.lastSeen=time;return value;
  };
}
module.exports={configuration,createSessions};
