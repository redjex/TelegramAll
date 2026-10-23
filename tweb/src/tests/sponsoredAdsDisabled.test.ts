import {describe, expect, it, vi} from 'vitest';
import '@helpers/peerIdPolyfill';
import {AppMessagesManager} from '@appManagers/appMessagesManager';
import {AppChatsManager} from '@appManagers/appChatsManager';

describe('disabled sponsored advertising', () => {
  const unexpectedApi = new Proxy({}, {
    get: () => vi.fn(() => {throw new Error('Advertising must not reach the API');})
  });

  it.each([777004, -888002])('returns no ads for peer %s without fetching peers or media', async(peerId) => {
    const manager = new AppMessagesManager();
    Object.assign(manager, {apiManager: unexpectedApi});
    // No peer, photo or permission managers are installed: fetching any ad data must fail.
    expect(await manager.getSponsoredMessage(peerId as PeerId)).toEqual({_: 'messages.sponsoredMessagesEmpty'});
  });

  it('keeps repeated global searches free of sponsored peer requests', async() => {
    const manager = new AppChatsManager();
    Object.assign(manager, {apiManager: unexpectedApi});
    for(const query of ['bot', 'channel', 'bot']) {
      expect(await manager.getSponsoredPeers(query)).toEqual([]);
    }
  });

  it('does not send impression or click events from stale advertising UI', async() => {
    const manager = new AppMessagesManager();
    Object.assign(manager, {apiManager: unexpectedApi});
    const randomId = new Uint8Array([1, 2, 3]);
    expect(await manager.viewSponsoredMessage(randomId)).toBe(false);
    expect(await manager.clickSponsoredMessage(randomId)).toBe(false);
    await expect(manager.reportSponsoredMessage(randomId, new Uint8Array())).rejects.toThrow('Sponsored messages are disabled');
  });
});
