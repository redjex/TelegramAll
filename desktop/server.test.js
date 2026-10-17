const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {test} = require('node:test');
const {createContentServer} = require('./server');
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'telegramall-server-'));
  const dist = path.join(root, 'dist'), publicDir = path.join(root, 'public');
  fs.mkdirSync(dist); fs.mkdirSync(publicDir);
  const server = createContentServer({dist, publicDir});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^telegramall-server-/);
    fs.rmSync(root, {recursive: true, force: true});
  });
  return {dist, publicDir, url: 'http://127.0.0.1:' + server.address().port};
}
test('serves the new bundle before old public files and refreshes index without caching', async (t) => {
  const {dist, publicDir, url} = await fixture(t);
  fs.writeFileSync(path.join(publicDir, 'index.html'), 'old public bundle');
  fs.writeFileSync(path.join(dist, 'index.html'), 'first bundle');
  assert.equal(await (await fetch(url)).text(), 'first bundle');
  fs.writeFileSync(path.join(dist, 'index.html'), 'rebuilt bundle');
  const next = await fetch(url);
  assert.equal(await next.text(), 'rebuilt bundle');
  assert.equal(next.headers.get('cache-control'), 'no-cache');
});
test('runtime assets are available without copying the stale public build over dist', async (t) => {
  const {dist, publicDir, url} = await fixture(t);
  fs.writeFileSync(path.join(dist, 'index.html'), 'app');
  fs.writeFileSync(path.join(publicDir, 'font.woff2'), 'font');
  fs.writeFileSync(path.join(dist, 'app-abcdefgh.js'), 'code');
  const font = await fetch(url + '/font.woff2');
  assert.equal(await font.text(), 'font');
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  const asset = await fetch(url + '/app-abcdefgh.js');
  assert.equal(await asset.text(), 'code');
  assert.match(asset.headers.get('cache-control'), /immutable/);
  assert.equal(asset.headers.get('service-worker-allowed'), '/');
  assert.equal(await (await fetch(url + '/settings')).text(), 'app');
});
