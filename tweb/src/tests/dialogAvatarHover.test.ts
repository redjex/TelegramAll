import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import attachDialogAvatarHover from '@helpers/dom/attachDialogAvatarHover';

describe('dialog avatar hover preview', () => {
  let list: HTMLElement, row: HTMLElement, avatar: HTMLElement, photo: HTMLElement;
  let dispose: () => void;
  const onOpen = vi.fn();
  const canOpen = vi.fn();

  const pointer = (target: EventTarget, type = 'pointerover', options: MouseEventInit & {pointerType?: string} = {}) => {
    const event = new MouseEvent(type, {bubbles: true, ...options});
    Object.defineProperty(event, 'pointerType', {value: options.pointerType ?? 'mouse'});
    target.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    onOpen.mockReset();
    canOpen.mockReset().mockReturnValue(true);
    list = document.createElement('div');
    list.innerHTML = '<a data-peer-id="123"><div class="dialog-avatar"><span></span></div><div class="dialog-title">Chat</div></a>';
    document.body.append(list);
    row = list.querySelector('a');
    avatar = row.querySelector('.dialog-avatar');
    photo = avatar.querySelector('span');
    dispose = attachDialogAvatarHover({list, canOpen, onOpen});
  });

  afterEach(() => {
    dispose();
    list.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['ltr', 'rtl'])('opens only after 500 ms on the avatar in %s', (direction) => {
    list.dir = direction;
    pointer(photo);
    vi.advanceTimersByTime(499);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(row);
  });

  it('ignores the title and row padding', () => {
    pointer(row.querySelector('.dialog-title'));
    pointer(row);
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cancels when leaving the avatar before the delay', () => {
    pointer(photo);
    vi.advanceTimersByTime(300);
    pointer(photo, 'pointerout', {relatedTarget: row});
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not restart the delay when moving between avatar children', () => {
    pointer(avatar);
    vi.advanceTimersByTime(300);
    pointer(avatar, 'pointerout', {relatedTarget: photo});
    pointer(photo, 'pointerover', {relatedTarget: avatar});
    vi.advanceTimersByTime(200);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(row);
  });

  it('starts a new delay when moving to another avatar', () => {
    const otherRow = row.cloneNode(true) as HTMLElement;
    otherRow.dataset.peerId = '456';
    list.append(otherRow);
    pointer(avatar);
    vi.advanceTimersByTime(300);
    pointer(avatar, 'pointerout', {relatedTarget: otherRow});
    pointer(otherRow.querySelector('.dialog-avatar'));
    vi.advanceTimersByTime(499);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(otherRow);
  });

  it.each(['touch', 'pen'])('ignores %s input', (pointerType) => {
    pointer(avatar, 'pointerover', {pointerType});
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('ignores dragging with a mouse button held', () => {
    pointer(avatar, 'pointerover', {buttons: 1});
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each(['pointerdown', 'contextmenu', 'keydown', 'wheel', 'scroll', 'visibilitychange'])('cancels on %s', (type) => {
    pointer(avatar);
    vi.advanceTimersByTime(300);
    document.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cancels when an ancestor scrolls', () => {
    pointer(avatar);
    document.body.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cancels when the window loses focus', () => {
    pointer(avatar);
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('checks permission again after the delay (selection, menus or popups)', () => {
    pointer(avatar);
    canOpen.mockReturnValue(false);
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not schedule a preview while opening is blocked', () => {
    canOpen.mockReturnValue(false);
    pointer(avatar);
    canOpen.mockReturnValue(true);
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each(['peerId', 'threadId', 'monoforumParentPeerId', 'mid'])('ignores a row recycled with a different %s', (key) => {
    pointer(avatar);
    row.dataset[key] = '456';
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('ignores a removed row', () => {
    pointer(avatar);
    row.remove();
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('ignores the synthetic All Chats row', () => {
    row.dataset.isAllChats = '1';
    pointer(avatar);
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps clicks and story avatars usable', () => {
    avatar.classList.add('has-stories');
    const onClick = vi.fn();
    avatar.addEventListener('click', onClick);
    pointer(avatar);
    pointer(avatar, 'pointerdown');
    avatar.click();
    vi.advanceTimersByTime(500);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('removes the pending timer and listeners when disposed', () => {
    pointer(avatar);
    dispose();
    pointer(avatar);
    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
