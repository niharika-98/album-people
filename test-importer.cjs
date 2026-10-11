const assert = require('assert');
const {allowedAlbum, parseAlbum} = require('./importer.cjs');
for (const url of ['http://photos.google.com/share/test','https://example.com','https://photos.google.com.evil.test/share/a','https://user:pass@photos.google.com/share/a','https://photos.google.com:444/share/a','https://photos.google.com/album/a']) {
  assert.throws(() => allowedAlbum(url));
}
assert(allowedAlbum('https://photos.app.goo.gl/test'));
assert(allowedAlbum('https://photos.google.com/share/test?key=example'));
function fixture(total, token) {
  const metadata = []; metadata[1] = 'Test album'; metadata[21] = total;
  const data = [null,[['photo-1',['https://lh3.googleusercontent.com/example',100,100]]],token,metadata];
  return '<script>AF_initDataCallback({key:\'ds:1\',data:'+JSON.stringify(data)+', sideChannel: {}});</script>';
}
assert.strictEqual(parseAlbum(fixture(1,'')).complete,true);
assert.strictEqual(parseAlbum(fixture(2,'next-page')).complete,false);
assert.strictEqual(parseAlbum(fixture(2,'')).complete,false);
assert.throws(()=>parseAlbum('<html>Sign in</html>'));
console.log('Importer tests passed: URL restrictions, photo parsing, incomplete imports, and private-page rejection.');
