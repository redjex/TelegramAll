const path = require('node:path');
const {pathToFileURL} = require('node:url');
const webRoot = path.resolve(__dirname, '../tweb');
async function watchClient({root = webRoot, configFile = path.join(webRoot, 'vite.config.ts'), onBuild, onError = console.error, buildOptions = {
  outDir: path.join(webRoot, 'tmp/desktop-dist'),
  emptyOutDir: false,
  sourcemap: false,
  minify: false,
  cssMinify: false,
  reportCompressedSize: false
}}) {
  const {build} = await import(pathToFileURL(path.join(webRoot, 'node_modules/vite/dist/node/index.js')).href);
  let revision = 0;
  const watcher = await build({root, configFile, build: {...buildOptions, watch: {}}});
  watcher.on('event', (event) => {
    if(event.code === 'ERROR') onError(event.error);
    if(event.code === 'BUNDLE_END') {
      onBuild(++revision);
      event.result?.close();
    }
  });
  return watcher;
}
module.exports = {watchClient};
