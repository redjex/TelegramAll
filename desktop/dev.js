const {spawn, spawnSync} = require('child_process');
const {once} = require('events');
const fs = require('fs');
const path = require('path');
const {watchClient} = require('./watchBuild');
const webRoot = path.resolve(__dirname, '../tweb');
const output = path.join(webRoot, 'tmp/desktop-dist');
const lockFile = path.join(webRoot, 'tmp/desktop-dev.lock');
let builder, electron, watcher, restartTimer;
let restarting = false, stopping = false, ownsLock = false, revision = 0;

function acquireLock() {
  fs.mkdirSync(path.dirname(lockFile), {recursive: true});
  if(fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, 'utf8'));
    if(!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid desktop-dev.lock; check that no launcher is running.');
    try { process.kill(pid, 0); }
    catch(error) {
      if(error.code !== 'ESRCH') throw error;
      fs.unlinkSync(lockFile);
    }
    if(fs.existsSync(lockFile)) throw new Error('Desktop development is already running (PID ' + pid + ').');
  }
  fs.writeFileSync(lockFile, String(process.pid), {flag: 'wx'});
  ownsLock = true;
}
function terminate(child) {
  if(!child?.pid || child.exitCode !== null || child.signalCode) return;
  if(process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore', windowsHide: true});
  else child.kill('SIGTERM');
}
async function stopElectron() {
  const child = electron;
  if(!child?.pid || child.exitCode !== null || child.signalCode) return;
  const exited = once(child, 'exit');
  if(child.connected) child.send('dev:quit', () => {});
  const fallback = setTimeout(() => terminate(child), 3000);
  await exited;
  clearTimeout(fallback);
}
async function shutdown(code = 0) {
  if(stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  watcher?.close();
  await stopElectron();
  await builder?.close();
  if(ownsLock && fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8') === String(process.pid)) fs.unlinkSync(lockFile);
  process.exitCode = code;
}
function notifyBuild() {
  if(electron?.devReady && electron.connected) electron.send({type: 'dev:reload', revision}, () => {});
}
function launchElectron() {
  const env = {...process.env, TELEGRAMALL_DEV_DIST: output};
  delete env.ELECTRON_RUN_AS_NODE;
  const launchedRevision = revision;
  const child = electron = spawn(require('electron'), [__dirname, '--profile=dev', '--dev'], {
    cwd: __dirname, env, stdio: ['ignore', 'inherit', 'inherit', 'ipc']
  });
  child.on('message', (message) => {
    if(message?.type === 'dev:ready') {
      child.devReady = true;
      if(revision > launchedRevision) notifyBuild();
    } else if(message?.type === 'dev:reloaded') console.log('[desktop-dev] Window updated to build ' + message.revision);
  });
  child.once('error', (error) => { console.error(error); shutdown(1); });
  child.once('exit', (code) => {
    if(restarting || stopping) return;
    if(!child.devReady && code === 0) {
      console.error('[desktop-dev] Another dev-profile window may be open. Close it and start development again.');
      shutdown(1);
    } else shutdown(code || 0);
  });
}
async function restartElectron() {
  if(stopping || restarting) return;
  restarting = true;
  console.log('[desktop-dev] Shell changed; restarting Electron.');
  await stopElectron();
  if(!stopping) launchElectron();
  restarting = false;
}
async function main() {
  acquireLock();
  const viteEntry = path.join(webRoot, 'node_modules/vite/dist/node/index.js');
  if(!fs.existsSync(viteEntry)) throw new Error('Install web dependencies first: cd tweb && pnpm install');
  let resolveFirstBuild;
  const firstBuild = new Promise((resolve) => { resolveFirstBuild = resolve; });
  console.log('[desktop-dev] Building the client; the window opens after the first successful build.');
  builder = await watchClient({
    onBuild(buildRevision) {
      if(stopping) return;
      revision = buildRevision;
      console.log('[desktop-dev] Build ' + revision + ' ready.');
      resolveFirstBuild();
      notifyBuild();
    },
    onError(error) {
      console.error(error);
      console.error('[desktop-dev] Build failed; keeping the last working page. Fix the error and save again.');
    }
  });
  if(stopping) { await builder.close(); return; }
  await firstBuild;
  if(stopping) return;
  launchElectron();
  watcher = fs.watch(__dirname, (_event, filename) => {
    if(!['main.js', 'server.js', 'liveReload.js'].includes(String(filename))) return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => restartElectron().catch((error) => { console.error(error); shutdown(1); }), 250);
  });
  console.log('[desktop-dev] Save UI code to rebuild and reload automatically. Close the window or press Ctrl+C to stop.');
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
main().catch((error) => { console.error(error.message); shutdown(1); });
