import parseEntities from '@lib/richTextProcessor/parseEntities';

const ADDRESS = 'UQCCXZE0_PWdyskZHkjwDprr0U3m8DxpRh6cdrV-TGSUv7dS';

describe('wallet addresses in text', () => {
  test('are linked to the explorer when asked for', () => {
    const text = `send to ${ADDRESS} please`;
    const entity = parseEntities(text, {wallets: true}).find((e) => e._ === 'messageEntityTextUrl') as any;
    expect(entity).toMatchObject({offset: 8, length: 48, url: 'https://gram.org/address/' + ADDRESS, walletAddress: true});
  });

  test('are left alone by default, so nothing extra is sent', () => {
    expect(parseEntities(`send to ${ADDRESS}`).some((e) => e._ === 'messageEntityTextUrl')).toBe(false);
  });

  test('a longer or shorter run of the same characters is no address', () => {
    expect(parseEntities(ADDRESS + 'A', {wallets: true}).some((e) => e._ === 'messageEntityTextUrl')).toBe(false);
    expect(parseEntities(ADDRESS.slice(0, 47), {wallets: true}).some((e) => e._ === 'messageEntityTextUrl')).toBe(false);
  });
});

describe('wallet addresses when rendering', () => {
  vi.mock('@lib/apiManagerProxy', () => ({default: new Proxy({}, {get: () => vi.fn()})}));

  test('are linked even when the entities handed in know nothing of them', async() => {
    const {stubBrowserGlobals} = await import('@/tests/helpers/browserGlobals');
    stubBrowserGlobals();
    const wrapRichText = (await import('@lib/richTextProcessor/wrapRichText')).default;
    const div = document.createElement('div');
    div.append(wrapRichText(`to ${ADDRESS}`, {entities: []}));
    const anchor = div.querySelector('a.anchor-wallet');
    expect(anchor?.getAttribute('onclick')).toBe('showWalletMenu(this)');
    expect(anchor?.textContent).toBe(ADDRESS);
  });
});

describe('wallet addresses the server marked itself', () => {
  test('a messageEntityTonAddress gets the same link and menu', async() => {
    const {stubBrowserGlobals} = await import('@/tests/helpers/browserGlobals');
    stubBrowserGlobals();
    const wrapRichText = (await import('@lib/richTextProcessor/wrapRichText')).default;
    const div = document.createElement('div');
    div.append(wrapRichText(ADDRESS, {entities: [{_: 'messageEntityTonAddress', offset: 0, length: 48}]}));
    const anchor = div.querySelector('a.anchor-wallet') as HTMLAnchorElement;
    expect(anchor?.getAttribute('onclick')).toBe('showWalletMenu(this)');
    expect(anchor?.href).toBe('https://gram.org/address/' + ADDRESS);
  });
});
