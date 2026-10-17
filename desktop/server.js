const http = require('http');
const fs = require('fs');
const path = require('path');
const MIME = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.tgs':'application/octet-stream','.webp':'image/webp','.map':'application/json','.ttf':'font/ttf','.otf':'font/otf','.gif':'image/gif','.mp4':'video/mp4','.xml':'text/xml','.txt':'text/plain'};
function createContentServer({dist, publicDir}) {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(req.url.split('?')[0]); }
    catch { res.writeHead(400); return res.end(); }
    const roots = publicDir ? [dist, publicDir] : [dist];
    let filename;
    for(const root of roots) {
      const candidate = path.join(root, path.normalize(pathname));
      const relative = path.relative(root, candidate);
      if(relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
        res.writeHead(403); return res.end();
      }
      if(fs.existsSync(candidate) && fs.statSync(candidate).isFile()) { filename = candidate; break; }
    }
    filename ||= path.join(dist, 'index.html');
    const hashed = /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/.test(filename) && !filename.endsWith('index.html');
    res.writeHead(200, {'Content-Type': MIME[path.extname(filename)] || 'application/octet-stream', 'Service-Worker-Allowed': '/', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache'});
    fs.createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  });
}
module.exports = {createContentServer};
