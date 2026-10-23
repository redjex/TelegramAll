const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');

if(process.versions.electron) {
  const {app, BrowserWindow} = require('electron');
  const {createContentServer} = require('./server');
  const {createLiveReloader} = require('./liveReload');
  app.disableHardwareAcceleration();
  app.setPath('userData', path.join(process.env.TELEGRAMALL_VERIFY_ROOT, 'profile'));
  app.whenReady().then(async () => {
    const server = createContentServer({dist: path.join(process.env.TELEGRAMALL_VERIFY_ROOT, 'dist')});
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const win = new BrowserWindow({show: false, webPreferences: {offscreen: true, backgroundThrottling: false}});
    const report = async (type, revision) => process.send({type, revision, data: await win.webContents.executeJavaScript(
      "({text:document.querySelector('#value').textContent,session:localStorage.getItem('session-probe')})"
    )});
    const reload = createLiveReloader(win.webContents, (revision) => report('verify:reloaded', revision), (error) => {
      process.send({type: 'verify:error', error: String(error)});
    });
    process.on('message', (message) => {
      if(message.type === 'dev:reload') reload(message.revision);
      if(message.type === 'verify:read') report('verify:read');
      if(message.type === 'verify:quit') {
        win.destroy(); server.closeAllConnections(); server.close(); app.quit();
      }
    });
    await win.loadURL('http://127.0.0.1:' + server.address().port);
    await win.webContents.executeJavaScript("localStorage.setItem('session-probe','preserved');new Promise(resolve=>requestAnimationFrame(()=>resolve(true)))");
    await report('verify:ready');
  }).catch((error) => { console.error(error); app.exit(1); });
} else {
  (async () => {
    const {watchClient} = require('./watchBuild');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'telegramall-reload-'));
    const inbox = [], subscribers = new Set();
    let watcher, child, resolveInitial, resolveBuildError;
    const initial = new Promise((resolve) => { resolveInitial = resolve; });
    const buildError = new Promise((resolve) => { resolveBuildError = resolve; });
    const waitMessage = (type) => new Promise((resolve, reject) => {
      const take = () => {
        const index = inbox.findIndex((message) => message.type === type || message.type === 'verify:error');
        if(index < 0) return;
        const [message] = inbox.splice(index, 1);
        subscribers.delete(take); clearTimeout(timeout);
        if(message.type === 'verify:error') reject(new Error(message.error)); else resolve(message);
      };
      const timeout = setTimeout(() => { subscribers.delete(take); reject(new Error('Timed out: ' + type)); }, 30000);
      subscribers.add(take); take();
    });
    const entry = path.join(root, 'entry.js');
    const setText = (text) => fs.writeFileSync(entry, "document.querySelector('#value').textContent=" + JSON.stringify(text) + ';');
    let builds = 0;
    try {
      fs.writeFileSync(path.join(root, 'index.html'), '<div id="value"></div><script type="module" src="/entry.js"></script>');
      setText('before');
      watcher = await watchClient({root, configFile: false,
        buildOptions: {outDir: path.join(root, 'dist'), emptyOutDir: false, minify: false},
        onBuild(revision) {
          builds = revision; resolveInitial();
          if(child?.connected) child.send({type: 'dev:reload', revision});
        },
        onError: () => resolveBuildError()
      });
      await initial;
      const env = {...process.env, TELEGRAMALL_VERIFY_ROOT: root};
      delete env.ELECTRON_RUN_AS_NODE;
      child = spawn(require('electron'), [__filename], {env, stdio: ['ignore','inherit','inherit','ipc'], windowsHide: true});
      child.on('message', (message) => { inbox.push(message); for(const take of [...subscribers]) take(); });
      child.on('error', (error) => { inbox.push({type: 'verify:error', error: String(error)}); for(const take of [...subscribers]) take(); });
      const ready = await waitMessage('verify:ready');
      assert.deepEqual(ready.data, {text:'before', session:'preserved'});
      const started = Date.now(); setText('after');
      const updated = await waitMessage('verify:reloaded');
      assert.deepEqual(updated.data, {text:'after', session:'preserved'});
      console.log('[verify] File edit reached the hidden Electron page in ' + (Date.now()-started) + ' ms; storage preserved.');
      const beforeError = builds;
      fs.writeFileSync(entry, "document.querySelector('#value').textContent = ;");
      await buildError;
      assert.equal(builds, beforeError);
      child.send({type:'verify:read'});
      assert.equal((await waitMessage('verify:read')).data.text, 'after');
      setText('recovered');
      const recovered = await waitMessage('verify:reloaded');
      assert.deepEqual(recovered.data, {text:'recovered', session:'preserved'});
      console.log('[verify] Broken source kept the working page; saving a fix rebuilt and reloaded it.');
    } finally {
      if(child?.connected) {
        const exited = once(child, 'exit'); child.send({type:'verify:quit'});
        await exited;
      }
      await watcher?.close();
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
      assert.match(path.basename(root), /^telegramall-reload-/);
      fs.rmSync(root, {recursive: true, force: true});
    }
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
