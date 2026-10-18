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

  const begin = (target: EventTarget, x: number, y: number) => {
    tracking = !isInteractive(target);
    dragging = false;
    startX = x;
    startY = lastY = y;
    startTime = lastTime = performance.now();
    velocity = 0;
  };

  // returns true once the drag is ours (the caller then keeps the browser from scrolling)
  const move = (x: number, y: number) => {
    if(!tracking) return false;
    const dx = x - startX, dy = y - startY;
    if(!dragging) {
      if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        tracking = false; // sideways: not ours
        return false;
      }

      if(dy < 8) return false;
      dragging = true;
      popup.classList.add('qr-dragging');
    }

    const now = performance.now();
    velocity = (y - lastY) / Math.max(1, now - lastTime);
    lastY = y;
    lastTime = now;
    container.style.setProperty('--qr-drag', Math.max(0, dy) + 'px');
    return true;
  };

  const finish = (y: number) => {
    if(!tracking) return;
    tracking = false;
    if(!dragging) return;
    dragging = false;
    popup.classList.remove('qr-dragging');
    const dy = y - startY;
    const far = dy > container.offsetHeight * .2;
    const flick = velocity > .6 && dy > 30;
    container.style.removeProperty('--qr-drag');
    if(far || flick) {
      // down it goes: through the close button, so that everything the popup does on closing happens.
      // A plain click: on a touch screen `simulateClickEvent` sends a touchend, which this button
      // (a solid onClick) never hears.
      popup.querySelector<HTMLElement>('.popup-close')?.click();
    }
  };

  // A finger is followed through touch events (a webview may cancel the pointer ones the moment it
  // takes a gesture for a scroll); a mouse and a stylus through pointer events.
  let touchSeen = false;

  const onTouchStart = (e: TouchEvent) => {
    touchSeen = true;
    const t = e.touches[0];
    if(e.touches.length !== 1) {
      tracking = false;
      return;
    }

    begin(e.target, t.clientX, t.clientY);
  };

  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if(t && move(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
  };

  const onTouchEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    finish(t ? t.clientY : lastY);
  };

  const onDown = (e: PointerEvent) => {
    if(touchSeen && e.pointerType === 'touch') return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    begin(e.target, e.clientX, e.clientY);
  };

  const onMove = (e: PointerEvent) => {
    if(touchSeen && e.pointerType === 'touch') return;
    move(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent) => {
    if(touchSeen && e.pointerType === 'touch') return;
    finish(e.clientY);
  };

  popup.addEventListener('touchstart', onTouchStart, {passive: true});
  popup.addEventListener('touchmove', onTouchMove, {passive: false});
  popup.addEventListener('touchend', onTouchEnd, {passive: true});
  popup.addEventListener('touchcancel', onTouchEnd, {passive: true});
  popup.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  return () => {
    popup.removeEventListener('touchstart', onTouchStart);
    popup.removeEventListener('touchmove', onTouchMove);
    popup.removeEventListener('touchend', onTouchEnd);
    popup.removeEventListener('touchcancel', onTouchEnd);
    popup.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}
