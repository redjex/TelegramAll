const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// All local data (chats, messages, contacts, media cache, login) lives in one stable folder: %APPDATA%\TelegramAll
app.setPath('userData', path.join(app.getPath('appData'), 'TelegramAll'));

const PORT = 47821; // fixed port => stable origin => login/IndexedDB persist
const DIST = app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '..', 'tweb', 'dist');
const MIME = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.tgs':'application/octet-stream','.webp':'image/webp','.map':'application/json','.ttf':'font/ttf','.otf':'font/otf','.gif':'image/gif','.mp4':'video/mp4','.xml':'text/xml','.txt':'text/plain'};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(DIST, path.normalize(p));
      if(!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
      if(!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
      // files with a content hash in the name never change, so the browser may keep them for good
      const hashed = /-[A-Za-z0-9_-]{8}.[a-z0-9]+$/.test(f) && !f.endsWith('index.html');
      res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Service-Worker-Allowed': '/', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache'});
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', resolve);
  });
}

if(!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(async () => {
  const serverReady = serve(); // the server starts while the window is being created
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 400, minHeight: 500,
    title: 'TelegramAll', icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#ffffff', autoHideMenuBar: true
  });
  // Chats, messages and contacts stay in IndexedDB between runs, so the app opens from the local copy and only
  // fetches updates. The code caches are dropped only when the app build itself changed.
  const stampFile = path.join(app.getPath('userData'), 'build-stamp.txt');
  const stamp = String(fs.statSync(path.join(DIST, 'index.html')).mtimeMs);
  let previous = '';
  try { previous = fs.readFileSync(stampFile, 'utf8'); } catch {}
  if(previous !== stamp) {
    await win.webContents.session.clearCache();
    await win.webContents.session.clearStorageData({storages: ['serviceworkers', 'cachestorage']});
    fs.writeFileSync(stampFile, stamp);
  }
  win.on('page-title-updated', (e) => e.preventDefault());
  await serverReady;
  win.loadURL(`http://localhost:${PORT}/`);
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action: 'deny'}; });
  app.on('second-instance', () => { if(win.isMinimized()) win.restore(); win.focus(); });
});
app.on('window-all-closed', () => app.quit());

