import appNavigationController from '@components/appNavigationController';

// how far from the left edge a swipe may start, how far it has to go, and how level it has to stay
const EDGE = 56;
const DISTANCE = 72;
const SLOPE = .6;

/** Goes one step back: closes the open screen or chat. False when there is nowhere to go (the chat list). */
export function androidGoBack() {
  const navigations: unknown[] = (appNavigationController as any).navigations;
  if(!navigations?.length) return false;
  history.back();
  return true;
}

/**
 * The Android back gesture for the page: a swipe from the left edge to the right returns to where you
 * were — the same step the system back button takes (`window.__tgAndroidBack` is what the native side asks).
 */
export default function installAndroidSwipeBack() {
  (window as any).__tgAndroidBack = androidGoBack;

  let startX = 0, startY = 0, tracking = false, done = false;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    tracking = e.touches.length === 1 && touch.clientX <= EDGE;
    done = false;
    startX = touch.clientX;
    startY = touch.clientY;
  }, {passive: true});

  document.addEventListener('touchmove', (e) => {
    if(!tracking || done) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);
    if(dy > Math.max(24, dx * 1.2) && dx < DISTANCE) {
      tracking = false; // it is a scroll
      return;
    }

    if(dx >= DISTANCE && dy <= dx * SLOPE) {
      done = true;
      androidGoBack();
    }
  }, {passive: true});

  const stop = () => tracking = false;
  document.addEventListener('touchend', stop, {passive: true});
  document.addEventListener('touchcancel', stop, {passive: true});
}
