const { app, BrowserWindow, shell, Menu, screen } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// A separate profile for testing: `TelegramAll.exe --profile=dev` (or TELEGRAMALL_PROFILE=dev) keeps its own logins, chats
// and caches and its own port, so it never touches the main profile.
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
const PROFILE = (profileArg ? profileArg.slice('--profile='.length) : process.env.TELEGRAMALL_PROFILE || '').replace(/[^\w-]/g, '');

// All local data (chats, messages, contacts, media cache, login) lives outside the repository, in one stable folder:
// %APPDATA%\TelegramAll (or %APPDATA%\TelegramAll-<profile>)
app.setPath('userData', path.join(app.getPath('appData'), PROFILE ? 'TelegramAll-' + PROFILE : 'TelegramAll'));

// fixed port => stable origin => login/IndexedDB persist; every profile gets its own origin
const PORT = PROFILE ? 47822 + (PROFILE.length % 50) : 47821;
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

// The window remembers where it was, how big it was and whether it was maximised (per profile).
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  const fallback = {width: 1280, height: 860};
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
    const width = Math.max(400, state.width | 0);
    const height = Math.max(500, state.height | 0);
    const result = {width, height, isMaximized: !!state.isMaximized, isFullScreen: !!state.isFullScreen};
    // the saved spot is used only while it is still on some connected display (a monitor may have been unplugged)
    if(Number.isFinite(state.x) && Number.isFinite(state.y)) {
      const visible = screen.getAllDisplays().some(({workArea: a}) => (
        state.x < a.x + a.width - 50 && state.x + width > a.x + 50 && state.y >= a.y - 10 && state.y < a.y + a.height - 50
      ));
      if(visible) {
        result.x = state.x;
        result.y = state.y;
      }
    }
    return result;
  } catch {
    return fallback;
  }
}

function trackWindowState(win, initial) {
  let timer;
  // minimising a maximised window must not forget that it was maximised, so these follow only their own events
  let isMaximized = !!initial.isMaximized;
  let isFullScreen = !!initial.isFullScreen;
  win.on('maximize', () => { isMaximized = true; });
  win.on('unmaximize', () => { isMaximized = false; });
  win.on('enter-full-screen', () => { isFullScreen = true; });
  win.on('leave-full-screen', () => { isFullScreen = false; });
  const save = () => {
    if(win.isDestroyed()) return;
    const state = {isMaximized, isFullScreen};
    // the restored (non-maximised) bounds are what has to come back after un-maximising
    Object.assign(state, win.getNormalBounds());
    try { fs.writeFileSync(STATE_FILE(), JSON.stringify(state)); } catch {}
  };
  const saveSoon = () => { clearTimeout(timer); timer = setTimeout(save, 400); };
  ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach((e) => win.on(e, saveSoon));
  win.on('close', save);
}

app.whenReady().then(async () => {
  const serverReady = serve(); // the server starts while the window is being created
  Menu.setApplicationMenu(null);
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width, height: state.height, x: state.x, y: state.y, minWidth: 400, minHeight: 500,
    title: PROFILE ? 'TelegramAll (' + PROFILE + ')' : 'TelegramAll', icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#ffffff', autoHideMenuBar: true, show: false
  });
  win.once('ready-to-show', () => {
    if(state.isMaximized) win.maximize();
    if(state.isFullScreen) win.setFullScreen(true);
    win.show();
  });
  trackWindowState(win, state);
  // Chats, messages and contacts stay in IndexedDB between runs, so the app opens from the local copy and only
  // fetches updates. The code caches are dropped only when the app build itself changed.
  const stampFile = path.join(app.getPath('userData'), 'build-stamp.txt');
  const stamp = String(fs.statSync(path.join(DIST, 'index.html')).mtimeMs);
  let previous = '';
  try { previous = fs.readFileSync(stampFile, 'utf8'); } catch {}
  if(previous !== stamp) {
    await win.webContents.session.clearCache();
    // Only the service worker is dropped: CacheStorage also holds the downloaded avatars, pictures and
    // other media (`cachedFiles`, ...), which must survive an update so a start without internet still
    // has them. The new worker clears its own code cache (`cachedAssets`) when it activates.
    await win.webContents.session.clearStorageData({storages: ['serviceworkers']});
    fs.writeFileSync(stampFile, stamp);
  }
  win.on('page-title-updated', (e) => e.preventDefault());
  await serverReady;
  win.loadURL(`http://localhost:${PORT}/`);
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action: 'deny'}; });
  app.on('second-instance', () => { if(win.isMinimized()) win.restore(); win.focus(); });
});
app.on('window-all-closed', () => app.quit());

