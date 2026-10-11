const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {allowedAlbum, request, parseAlbum} = require('./importer.cjs');
const {exportAlbum}=require('./exporter.cjs');
const {configuration,createSessions}=require('./runtime.cjs');
const config=configuration();
const getSession=createSessions();
function imageHost(value){const target=new URL(value);if(target.protocol!=='https:'||target.port||!/^lh\d+\.googleusercontent\.com$/.test(target.hostname))throw Error('Invalid image host');return target;}
function json(res, code, value) { res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!config.hosts.includes(req.headers.host)) return json(res,403,{error:'Invalid host'});
  const u = new URL(req.url, config.origins[0]);
  try {
    if(req.method==='GET'&&u.pathname==='/health')return json(res,200,{status:'ok'});
    if(req.method==='POST'&&req.headers.origin&&!config.origins.includes(req.headers.origin))return json(res,403,{error:'Invalid origin'});
    if(req.method==='POST'&&req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Invalid request origin'});
    const session=u.pathname.startsWith('/api/')?getSession(req,res,config.secure):null;
    const images=session?.images,exportsInProgress=session?.exportsInProgress;
    if(req.method==='GET'&&u.pathname==='/api/export-config')return json(res,200,{clientId:process.env.GOOGLE_CLIENT_ID||''});
    if(req.method==='GET'&&u.pathname.startsWith('/api/export/')){
      const job=exportsInProgress.get(u.pathname.split('/').pop());
      return job?json(res,200,job):json(res,404,{error:'Export session expired.'});
    }
    if(req.method==='POST'&&u.pathname==='/api/export'){
      if(!process.env.GOOGLE_CLIENT_ID)return json(res,503,{error:'Google export needs a Google Cloud OAuth client ID. See README setup instructions.'});
      if([...exportsInProgress.values()].some(job=>job.state==='working'))return json(res,409,{error:'An export is already running.'});
      const auth=req.headers.authorization||'';
      if(!/^Bearer [A-Za-z0-9._~-]+$/.test(auth))return json(res,401,{error:'Sign in to Google to export.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)return json(res,413,{error:'Export request too large'});}
      const input=JSON.parse(body);
      if(typeof input.title!=='string'||!input.title.trim()||input.title.length>500||!Array.isArray(input.images)||!input.images.length||input.images.length>500)return json(res,400,{error:'Choose 1–500 photos and an album title of up to 500 characters.'});
      const tokens=[...new Set(input.images)];
      const sources=tokens.map(value=>typeof value==='string'&&/^\/api\/image\/[a-f0-9]{32}$/.test(value)?images.get(value.split('/').pop()):null);
      if(sources.some(value=>!value))return json(res,400,{error:'Some photos expired. Import the album again.'});
      const id=crypto.randomBytes(16).toString('hex');
      const job={state:'working',total:sources.length,uploaded:0,created:0,message:'Creating album…',url:null};
      exportsInProgress.set(id,job);
      exportAlbum({title:input.title.trim(),sources,token:auth.slice(7),job,download:source=>request(source+'=d',imageHost,64*1024*1024)}).finally(()=>{const timer=setTimeout(()=>exportsInProgress.delete(id),30*60*1000);timer.unref();});
      return json(res,202,{id});
    }
    if (req.method === 'POST' && u.pathname === '/api/import') {
      session.imports=session.imports.filter(time=>Date.now()-time<60000);
      if(session.imports.length>=6)return json(res,429,{error:'Too many imports. Wait a minute and try again.'});
      session.imports.push(Date.now());
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res,413,{error:'Request too large'}); }
      const input = JSON.parse(body);
      const result = await request(input.url, allowedAlbum);
      const album = parseAlbum(result.body.toString('utf8'));
      album.sourceUrl=result.url;
      images.clear();
      album.photos = album.photos.map(photo => {
        const token = crypto.randomBytes(16).toString('hex'); images.set(token,photo.source);
        return {id:photo.id,width:photo.width,height:photo.height,image:'/api/image/'+token};
      });
      return json(res,200,album);
    }
    if (req.method === 'GET' && u.pathname.startsWith('/api/image/')) {
      const source = images.get(u.pathname.split('/').pop());
      if (!source) return json(res,404,{error:'Image expired. Import the album again.'});
      const result = await request(source + '=w1600-h1600', value => {
        const target = new URL(value);
        if (target.protocol !== 'https:' || target.port || !/^lh\d+\.googleusercontent\.com$/.test(target.hostname)) throw Error('Invalid image host');
        return target;
      });
      if (!result.type || !result.type.startsWith('image/')) throw Error('Google did not return an image');
      res.writeHead(200,{'Content-Type':result.type,'Cache-Control':'private, max-age=600'}); return res.end(result.body);
    }
    const files = {'/':'index.html','/app.js':'app.js','/clustering.js':'clustering.js','/zip.js':'zip.js','/style.css':'style.css'};
    if (req.method !== 'GET' || !files[u.pathname]) return json(res,404,{error:'Not found'});
    const name = files[u.pathname];
    res.writeHead(200, {'Content-Type': name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
    res.end(fs.readFileSync(path.join(__dirname,'public',name)));
  } catch (e) { json(res,400,{error:e.message}); }
});
server.listen(config.port,config.host,()=>console.log('Album People ready at '+config.origins[0]));
