import {simulateClickEvent} from '@helpers/dom/clickEvent';

/**
 * The QR code screen of the Android app goes down under a finger: a drag that starts on it and runs down
 * (more than sideways) pulls the screen along (`--qr-drag`), and letting go past a fifth of its height, or
 * with a quick flick, closes it through its own close button; otherwise it springs back.
 */
export default function attachAndroidQrSwipe(sentinel: HTMLElement) {
  const popup = sentinel.closest<HTMLElement>('.popup');
  const container = popup?.querySelector<HTMLElement>('.popup-container');
  if(!popup || !container) return;

  let startX = 0, startY = 0, startTime = 0, tracking = false, dragging = false, lastY = 0, lastTime = 0, velocity = 0;

  const isInteractive = (target: EventTarget) => {
    // a horizontal strip of themes and the buttons keep their own gestures
    return !!(target as HTMLElement).closest?.('.themes-container, .scrollable-x, button, .btn-icon');
  };

  const onDown = (e: PointerEvent) => {
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    tracking = !isInteractive(e.target);
    dragging = false;
    startX = e.clientX;
    startY = lastY = e.clientY;
    startTime = lastTime = performance.now();
    velocity = 0;
  };

  const onMove = (e: PointerEvent) => {
    if(!tracking) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if(!dragging) {
      if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        tracking = false; // sideways: not ours
        return;
      }

      if(dy < 8) return;
      dragging = true;
      popup.classList.add('qr-dragging');
    }

    const now = performance.now();
    velocity = (e.clientY - lastY) / Math.max(1, now - lastTime);
    lastY = e.clientY;
    lastTime = now;
    // a little resistance when pulled up past the start
    container.style.setProperty('--qr-drag', Math.max(0, dy) + 'px');
  };

  const onUp = (e: PointerEvent) => {
    if(!tracking) return;
    tracking = false;
    if(!dragging) return;
    dragging = false;
    popup.classList.remove('qr-dragging');
    const dy = e.clientY - startY;
    const far = dy > container.offsetHeight * .2;
    const flick = velocity > .6 && dy > 30;
    if(far || flick) {
      // down it goes: through the close button, so that everything the popup does on closing happens
      container.style.removeProperty('--qr-drag');
      const close = popup.querySelector<HTMLElement>('.popup-close');
      if(close) simulateClickEvent(close);
    } else {
      container.style.removeProperty('--qr-drag');
    }
  };

  popup.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  return () => {
    popup.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}
