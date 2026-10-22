import ListenerSetter from '@helpers/listenerSetter';

/** Keep a hover preview across its source row and the gap leading to its content. */
export default function keepHoverPreviewOpen({source, preview, onClose}: {
  source: HTMLElement,
  preview: HTMLElement,
  onClose: () => void
}) {
  const listeners = new ListenerSetter();
  const doc = preview.ownerDocument;
  const win = doc.defaultView;
  let timeout: number;
  let closed = false;

  const cancelClose = () => {
    win.clearTimeout(timeout);
    timeout = undefined;
  };
  const dispose = () => {
    cancelClose();
    listeners.removeAll();
  };
  const close = () => {
    if(closed) return;
    closed = true;
    dispose();
    onClose();
  };
  const isInside = (target: EventTarget) => {
    const node = target as Node;
    return !!node?.nodeType && (source.contains(node) || preview.contains(node));
  };
  const scheduleClose = () => {
    if(timeout !== undefined || closed) return;
    // The row and popup stand 8px apart. Let the pointer cross that gap without
    // closing the popup underneath it, just like the client's hover dropdowns.
    timeout = win.setTimeout(close, 200);
  };

  listeners.add(doc)('pointerover', (event) => {
    if(event.pointerType !== 'mouse') return;
    if(isInside(event.target)) cancelClose();
    else scheduleClose();
  }, {capture: true});
  listeners.add(doc)('pointerout', (event) => {
    if(event.pointerType !== 'mouse') return;
    if(isInside(event.relatedTarget)) cancelClose();
    else scheduleClose();
  }, {capture: true});
  listeners.add(doc)('pointerdown', (event) => {
    if(!isInside(event.target)) close();
  }, {capture: true});
  listeners.add(doc)('scroll', (event) => {
    // Scrolling the preview is the point; scrolling its source list moves the anchor.
    if(!preview.contains(event.target as Node)) close();
  }, {capture: true, passive: true});
  listeners.add(doc)('visibilitychange', () => {
    if(doc.hidden) close();
  });
  listeners.add(win)('blur', close);
  return dispose;
}
