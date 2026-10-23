import ListenerSetter from '@helpers/listenerSetter';

/** Delegated hover: no listeners or layout reads per dialog, including virtualized rows. */
export default function attachDialogAvatarHover({list, canOpen, onOpen}: {
  list: HTMLElement,
  canOpen: (row: HTMLElement) => boolean,
  onOpen: (row: HTMLElement) => void
}) {
  const listeners = new ListenerSetter();
  const pendingListeners = new ListenerSetter();
  list.classList.add('chatlist-avatar-hover');
  let avatar: HTMLElement;
  let timeout: number;
  let timeoutWindow: Window;

  const cancel = () => {
    timeoutWindow?.clearTimeout(timeout);
    timeoutWindow = undefined;
    timeout = undefined;
    avatar = undefined;
    pendingListeners.removeAll();
  };

  const getRowKey = (row: HTMLElement) => [
    row.dataset.peerId,
    row.dataset.threadId,
    row.dataset.monoforumParentPeerId,
    row.dataset.mid
  ].join(':');

  listeners.add(list)('pointerover', (event) => {
    if(event.pointerType !== 'mouse' || event.buttons) {
      cancel();
      return;
    }

    const target = event.target as HTMLElement;
    const nextAvatar = target.closest<HTMLElement>('.dialog-avatar');
    if(!nextAvatar || nextAvatar === avatar) return;

    cancel();
    const row = nextAvatar.closest<HTMLElement>('a[data-peer-id]');
    if(!row || !list.contains(row) || !row.dataset.peerId || row.dataset.isAllChats ||
      target.closest('[data-dialog-list-action]') || !canOpen(row)) return;

    avatar = nextAvatar;
    const rowKey = getRowKey(row);
    const doc = list.ownerDocument;
    const win = doc.defaultView;
    // Only hold document/window listeners during the half-second wait. Scrolling an
    // ancestor, clicking elsewhere or switching windows must cancel a pending preview.
    pendingListeners.add(doc)('scroll', cancel, {capture: true, passive: true});
    pendingListeners.add(doc)('wheel', cancel, {capture: true, passive: true});
    pendingListeners.add(doc)('pointerdown', cancel, {capture: true});
    pendingListeners.add(doc)('contextmenu', cancel, {capture: true});
    pendingListeners.add(doc)('keydown', cancel, {capture: true});
    pendingListeners.add(doc)('visibilitychange', cancel);
    pendingListeners.add(win)('blur', cancel);

    timeoutWindow = win;
    timeout = win.setTimeout(() => {
      cancel();
      if(nextAvatar.isConnected && list.contains(nextAvatar) && row.contains(nextAvatar) &&
        getRowKey(row) === rowKey && !doc.hidden && canOpen(row)) {
        onOpen(row);
      }
    }, 500);
  });

  listeners.add(list)('pointerout', (event) => {
    if(avatar && (!event.relatedTarget || !avatar.contains(event.relatedTarget as Node))) cancel();
  });
  listeners.add(list)('pointercancel', cancel);
  listeners.addCleanup(cancel);
  listeners.addCleanup(() => list.classList.remove('chatlist-avatar-hover'));
  return () => listeners.removeAll();
}
