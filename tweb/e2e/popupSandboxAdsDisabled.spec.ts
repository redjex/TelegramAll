import {expect} from '@playwright/test';
import {test} from './workerContext';
import {closeStory, openStory, preparePopupSandbox} from './popupSandbox.helpers';

for(const direction of ['ltr', 'rtl'] as const) {
  test(`channels, bots and search do not request or display advertising (${direction})`, async({page}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await preparePopupSandbox(page, false, {a11y: true});
    expect(await openStory(page, 'chatPreview')).toBeNull();
    expect(await closeStory(page, {})).toBe(true);
    await page.evaluate((direction) => window.popupSandbox.setDirection(direction), direction);
    const start = await page.evaluate(() => window.popupSandbox.calls().length);

    for(const kind of ['CHANNEL_PEER_ID', 'BOT_PEER_ID']) {
      await page.evaluate(async(kind) => {
        const fixturePath = '/src/components/popupSandbox/fixtures.ts';
        const previewPath = '/src/components/popups/chatPreview.tsx';
        const fixtures = await import(fixturePath);
        const {default: showPreview} = await import(previewPath);
        showPreview({peerId: fixtures[kind]});
      }, kind);
      await expect(page.locator('.popup-chat-preview.active .chat')).toBeVisible();
      await expect(page.locator('.popup-chat-preview .pinned-sponsored, .popup-chat-preview .is-sponsored')).toHaveCount(0);
      expect(await closeStory(page, {})).toBe(true);
    }

    await page.evaluate(async() => {
      const searchPath = '/src/components/appSearchSuper.ts';
      const groupsPath = '/src/components/searchGroup.tsx';
      const fixturesPath = '/src/components/popupSandbox/fixtures.ts';
      const rootPath = '/src/lib/rootScope.ts';
      const middlewarePath = '/src/helpers/middleware.ts';
      const [{default: AppSearchSuper}, {createSearchGroup}, fixtures, {default: rootScope}, {getMiddleware}] = await Promise.all([
        import(searchPath), import(groupsPath), import(fixturesPath), import(rootPath), import(middlewarePath)
      ]);
      const host = document.createElement('div');
      host.id = 'ad-free-search';
      host.style.cssText = 'position:fixed;inset:100px 0 0;width:350px;background:white;z-index:10';
      document.body.append(host);
      const search = Object.create(AppSearchSuper.prototype);
      Object.assign(search, {
        middleware: getMiddleware(),
        tabs: {inputMessagesFilterEmpty: host},
        searchContext: {query: 'alice'},
        searchGroups: {
          contacts: createSearchGroup({type: 'contacts', name: 'SearchContacts'}),
          globalContacts: createSearchGroup({type: 'globalContacts', name: 'GlobalSearch'})
        },
        managers: {
          ...rootScope.managers,
          appUsersManager: {
            getUser: (peerId: number) => rootScope.managers.appUsersManager.getUser(peerId),
            getContactsPeerIds: () => Promise.resolve([fixtures.CONTACT_PEER_ID]),
            searchContacts: () => Promise.resolve({my_results: [], results: [fixtures.PREMIUM_PEER_ID]})
          },
          dialogsStorage: {getDialogs: () => Promise.resolve({dialogs: []})},
          appChatsManager: {
            getSponsoredPeers: () => {throw new Error('Search requested advertising');}
          }
        }
      });
      await search.loadChats();
    });
    await expect(page.locator('#ad-free-search a[data-peer-id="777002"]')).toBeVisible();
    await expect(page.locator('#ad-free-search a[data-peer-id="777003"]')).toBeVisible();
    await expect(page.locator('#ad-free-search [data-sponsored], #ad-free-search .sponsored-peer-chip')).toHaveCount(0);
    expect(await page.evaluate((start) => window.popupSandbox.calls().slice(start)
    .filter(({method}) => /sponsored/i.test(method)), start)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
