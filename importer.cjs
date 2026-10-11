const https = require('https');

function allowedAlbum(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Use an HTTPS Google Photos shared-album link.');
  if (!(u.hostname === 'photos.app.goo.gl' || (u.hostname === 'photos.google.com' && /^\/(?:u\/\d+\/)?share\//.test(u.pathname)))) throw Error('Use a Google Photos shared-album link.');
  return u;
}
function request(url, validate, limit = 16 * 1024 * 1024, redirects = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = validate(url); } catch (e) { reject(e); return; }
    const req = https.get(u, {headers: {'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'identity'}}, res => {
      if ([301,302,303,307,308].includes(res.statusCode)) {
        res.resume();
        if (redirects >= 5 || !res.headers.location) return reject(Error('Too many redirects.'));
        return request(new URL(res.headers.location, u).href, validate, limit, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(Error('Google returned HTTP ' + res.statusCode + '. Check that sharing is enabled.')); }
      const chunks = []; let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; if (bytes > limit) res.destroy(Error('Response exceeds import size limit.')); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({body: Buffer.concat(chunks), type: res.headers['content-type'], url: u.href}));
    });
    req.setTimeout(30000, () => req.destroy(Error('Google request timed out.')));
    req.on('error', reject);
  });
}
function parseAlbum(html) {
  for (const block of html.matchAll(/AF_initDataCallback\((\{[\s\S]*?)\);<\/script>/g)) {
    const match = block[1].match(/data:([\s\S]*),\s*sideChannel:/);
    if (!match) continue;
    let data;
    try { data = JSON.parse(match[1]); } catch (_) { continue; }
    if (!Array.isArray(data[1]) || !Array.isArray(data[3])) continue;
    const photos = data[1].filter(x => typeof x[0] === 'string' && Array.isArray(x[1]) && typeof x[1][0] === 'string' && /^https:\/\/lh\d+\.googleusercontent\.com\//.test(x[1][0])).map(x => ({id:x[0], source:x[1][0], width:x[1][1], height:x[1][2]}));
    if (!photos.length) continue;
    const total = Number.isInteger(data[3][21]) ? data[3][21] : null;
    return {title: data[3][1] || 'Shared album', photos, total, complete: !data[2] && total === photos.length};
  }
  throw Error('No photo records found. The album may be private, empty, or Google may have changed its page format.');
}
module.exports = {allowedAlbum, request, parseAlbum};
