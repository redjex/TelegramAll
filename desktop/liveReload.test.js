const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {test} = require('node:test');
const {createLiveReloader} = require('./liveReload');
function contents() {
  const page = new EventEmitter();
  page.cleared = []; page.navigations = 0;
  page.isDestroyed = () => false;
  page.session = {clearStorageData: async (options) => page.cleared.push(options)};
  page.reloadIgnoringCache = () => { page.navigations++; };
  return page;
}
test('only unregisters the code worker, preserving login and media stores', async () => {
  const page = contents(), completed = [];
  const reload = createLiveReloader(page, (revision) => completed.push(revision));
  const work = reload(1);
  await new Promise(setImmediate);
  assert.equal(page.navigations, 1);
  assert.deepEqual(completed, []);
  page.emit('did-finish-load'); await work;
  assert.deepEqual(page.cleared, [{storages: ['serviceworkers']}]);
  assert.deepEqual(completed, [1]);
  await reload(1);
  assert.equal(page.navigations, 1);
});
test('coalesces builds arriving during navigation without losing the newest update', async () => {
  const page = contents(), completed = [];
  const reload = createLiveReloader(page, (revision) => completed.push(revision));
  const work = reload(1);
  await new Promise(setImmediate);
  await reload(2); await reload(3);
  page.emit('did-finish-load');
  await new Promise(setImmediate);
  assert.equal(page.navigations, 2);
  page.emit('did-finish-load'); await work;
  assert.deepEqual(completed, [1, 3]);
});
test('a failed navigation is reported and a later build can recover', async () => {
  const page = contents(), errors = [], completed = [];
  const reload = createLiveReloader(page, (revision) => completed.push(revision), (error) => errors.push(error));
  const work = reload(1);
  await new Promise(setImmediate);
  page.emit('did-fail-load', {}, -2, 'failed', '', true); await work;
  assert.equal(errors.length, 1);
  assert.equal(page.listenerCount('did-finish-load'), 0);
  const recovery = reload(2);
  await new Promise(setImmediate);
  page.emit('did-finish-load'); await recovery;
  assert.deepEqual(completed, [2]);
});
