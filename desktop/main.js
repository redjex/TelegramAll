const { app, BrowserWindow, shell, Menu, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { createContentServer } = require('./server');
const { createLiveReloader } = require('./liveReload');

// A separate profile for testing: `TelegramAll.exe --profile=dev` (or TELEGRAMALL_PROFILE=dev) keeps its own logins, chats
// and caches and its own port, so it never touches the main profile.
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
const PROFILE = (profileArg ? profileArg.slice('--profile='.length) : process.env.TELEGRAMALL_PROFILE || '').replace(/[^\w-]/g, '');

// All local data (chats, messages, contacts, media cache, login) lives outside the repository, in one stable folder:
// %APPDATA%\TelegramAll (or %APPDATA%\TelegramAll-<profile>)
app.setPath('userData', path.join(app.getPath('appData'), PROFILE ? 'TelegramAll-' + PROFILE : 'TelegramAll'));

// fixed port => stable origin => login/IndexedDB persist; every profile gets its own origin
const PORT = PROFILE ? 47822 + (PROFILE.length % 50) : 47821;
const DEV_MODE = !app.isPackaged && process.argv.includes('--dev');
const DIST = DEV_MODE ? path.resolve(process.env.TELEGRAMALL_DEV_DIST || path.join(__dirname, '../tweb/tmp/desktop-dist')) :
  app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '../tweb/dist');

function serve() {
  return new Promise((resolve) => {
    const srv = createContentServer({dist: DIST, publicDir: DEV_MODE ? path.join(__dirname, '../tweb/public') : undefined});
    srv.on('error', (error) => {
      // the port is held by something else (or by an instance still shutting down): say so instead of crashing
      require('electron').dialog.showErrorBox('TelegramAll', 'Port ' + PORT + ' is busy: ' + error.message + '\nClose the other TelegramAll window and start again.');
      app.exit(1);
    });
    srv.listen(PORT, '127.0.0.1', resolve);
  });
}

// only one instance per profile: a second launch just brings the first one forward and exits at once
const isFirstInstance = app.requestSingleInstanceLock();
if(!isFirstInstance) app.quit();

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

if(isFirstInstance) app.whenReady().then(async () => {
  // The development launcher asks for a graceful shutdown before restarting the shell.
  if(DEV_MODE) process.on('message', (message) => { if(message === 'dev:quit') app.quit(); });
  const serverReady = serve(); // the server starts while the window is being created
  Menu.setApplicationMenu(null);
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width, height: state.height, x: state.x, y: state.y, minWidth: 400, minHeight: 500,
    title: PROFILE ? 'TelegramAll (' + PROFILE + ')' : 'TelegramAll', icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#ffffff', autoHideMenuBar: true, show: DEV_MODE,
    webPreferences: {backgroundThrottling: !DEV_MODE}
  });
  if(DEV_MODE) {
    const reload = createLiveReloader(win.webContents, (revision) => {
      if(process.connected) process.send({type: 'dev:reloaded', revision});
    });
    process.on('message', (message) => {
      if(message?.type === 'dev:reload') reload(message.revision);
    });
    win.webContents.on('did-fail-load', (_event, code, description) => {
      console.error('[desktop-dev] Page failed to load:', code, description);
    });
    win.webContents.on('console-message', (details) => {
      if(details.level === 'error') console.error('[desktop-dev] Renderer:', details.message);
    });
  }
  win.once('ready-to-show', () => {
    if(state.isMaximized) win.maximize();
    if(state.isFullScreen) win.setFullScreen(true);
    win.show();
  });
  trackWindowState(win, state);
  // Chats, messages and contacts stay in IndexedDB between runs, so the app opens from the local copy and only
  // fetches updates. The code caches are dropped only when the app build itself changed.
  const stampFile = path.join(app.getPath('userData'), 'build-stamp.txt');
  const stamp = (DEV_MODE ? 'dev:' : '') + fs.statSync(path.join(DIST, 'index.html')).mtimeMs;
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
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action: 'deny'}; });
  app.on('second-instance', () => { if(win.isMinimized()) win.restore(); win.focus(); });
  await win.loadURL(`http://localhost:${PORT}/`);
  if(DEV_MODE && process.connected) process.send({type: 'dev:ready'});
});
app.on('window-all-closed', () => app.quit());

