import {loadChatBubbles, LOAD_CHAT_BUBBLES_TIMEOUT} from '@/tests/helpers/chatBubbles';
import {getMiddleware} from '@helpers/middleware';
import type {Message} from '@layer';
import '@helpers/peerIdPolyfill';

const avatarMocks = vi.hoisted(() => ({create: vi.fn()}));
vi.mock('@components/avatarNew', async(importOriginal) => ({
  ...await importOriginal<typeof import('@components/avatarNew')>(),
  avatarNew: (options: any) => {
    avatarMocks.create(options);
    return {node: document.createElement('div'), readyThumbPromise: Promise.resolve()};
  }
}));

let ChatBubbles: typeof import('@components/chat/bubbles').default;
let BubbleGroup: typeof import('@components/chat/bubbleGroups').BubbleGroup;

beforeAll(async() => {
  const loaded = await loadChatBubbles();
  ChatBubbles = loaded.bubbles.default;
  BubbleGroup = (await import('@components/chat/bubbleGroups')).BubbleGroup;
  (await import('@lib/rootScope')).default.myId = (20).toPeerId();
}, LOAD_CHAT_BUBBLES_TIMEOUT);

const message = (out = false) => ({
  _: 'message',
  pFlags: {out},
  fromId: (out ? 20 : 10).toPeerId()
}) as Message.message;

describe('message group avatars', () => {
  it.each([false, true])('shows regular incoming and outgoing authors in private chats (out=%s)', (out) => {
    const harness = {chat: {isLikeGroup: false, isOutMessage: () => out}};
    expect(ChatBubbles.prototype.isAvatarNeeded.call(harness, message(out))).toBe(true);
  });

  it('keeps service events free of author avatars', () => {
    expect(ChatBubbles.prototype.isAvatarNeeded.call({}, {_: 'messageService'} as Message.messageService)).toBe(false);
  });

  it('reuses one avatar per sender group and releases its reserved column on removal', async() => {
    avatarMocks.create.mockClear();
    const middleware = getMiddleware();
    const group = new BubbleGroup({peerId: (10).toPeerId(), bubbles: {getMiddleware: () => middleware.get()}} as any);
    await group.createAvatar(message(true));
    await group.createAvatar(message(true));
    expect(avatarMocks.create).toHaveBeenCalledTimes(1);
    expect(avatarMocks.create.mock.calls[0][0].peerId).toBe((20).toPeerId());
    expect(group.container.classList.contains('has-avatar')).toBe(true);
    group.destroyAvatar();
    expect(group.container.querySelector('.bubbles-group-avatar')).toBeNull();
    expect(group.container.classList.contains('has-avatar')).toBe(false);
    middleware.clean();
  });

  it.each([false, true])('resolves an omitted sender from the peer or our account (out=%s)', (out) => {
    const group = Object.create(BubbleGroup.prototype);
    group.chat = {peerId: (10).toPeerId()};
    expect(group.getAvatarOptions({...message(out), fromId: undefined}).peerId).toBe((out ? 20 : 10).toPeerId());
  });

  it('preserves anonymous forwarded names when no sender identity is available', () => {
    const group = Object.create(BubbleGroup.prototype);
    group.chat = {peerId: (10).toPeerId()};
    const options = group.getAvatarOptions({...message(), fromId: undefined, fwd_from: {from_name: 'Anonymous'}});
    expect(options.peerTitle).toBe('Anonymous');
    expect(options.peerId).not.toBe(group.chat.peerId);
  });
});
