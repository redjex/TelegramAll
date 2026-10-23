// Queue updates: a successful build arriving during navigation must not be lost.
function createLiveReloader(contents, onReload = () => {}, onError = console.error) {
  let requested = 0, completed = 0, running = false;
  return async function reload(revision) {
    requested = Math.max(requested, revision);
    if(running) return;
    running = true;
    try {
      while(completed < requested && !contents.isDestroyed()) {
        const target = requested;
        // Preserve IndexedDB, localStorage and media; unregister only the code worker.
        await contents.session.clearStorageData({storages: ['serviceworkers']});
        await new Promise((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timeout);
            contents.removeListener('did-finish-load', loaded);
            contents.removeListener('did-fail-load', failed);
          };
          const loaded = () => { cleanup(); resolve(); };
          const failed = (_event, code, description, _url, isMainFrame) => {
            if(isMainFrame === false) return;
            cleanup(); reject(new Error('Reload failed: ' + code + ' ' + description));
          };
          const timeout = setTimeout(() => { cleanup(); reject(new Error('Reload timed out')); }, 30000);
          contents.once('did-finish-load', loaded);
          contents.on('did-fail-load', failed);
          contents.reloadIgnoringCache();
        });
        completed = target;
        onReload(target);
      }
    } catch(error) { onError(error); }
    finally { running = false; }
  };
}
module.exports = {createLiveReloader};
