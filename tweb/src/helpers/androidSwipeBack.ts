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

/** a swipe may not start on these: they have touches of their own */
const KEEPS_TOUCHES = 'input, textarea, [contenteditable], .chat-input, .popup, .media-viewer, .stories-viewer, .btn-menu, .scrollable-x, .emoji-dropdown, .reply-wrapper';

/**
 * The Android back gesture for the page: a swipe to the right returns to where you were: the same step the system back
 * button takes (`window.__tgAndroidBack` is what the native side asks).
 *
 * In an open chat it works from anywhere on the screen and follows the finger: the chat slides to the right, and the chat
 * list comes out from under it. Let go past a third of the screen (or with a quick flick) and the chat closes the way it
 * does on the back button, from where the finger left it; short of that it springs back.
 */
export default function installAndroidSwipeBack() {
  (window as any).__tgAndroidBack = androidGoBack;

  let startX = 0, startY = 0, lastX = 0, lastT = 0, speed = 0;
  let tracking = false, done = false, dragging = false;

  const center = () => document.getElementById('column-center') as HTMLElement;
  const left = () => document.getElementById('column-left') as HTMLElement;
  const chatOpen = () => document.body.classList.contains('has-chat');

  const follow = (dx: number) => {
    const width = center().offsetWidth || window.innerWidth;
    center().style.setProperty('transform', `translate3d(${dx}px, 0, 0)`);
    // the list comes out from under it: it stands a quarter of the width to the left while the chat is open
    left()?.style.setProperty('transform', `translate3d(${-width * .25 * (1 - dx / width)}px, 0, 0)`);
  };

  const release = (commit: boolean) => {
    const c = center(), l = left();
    const clean = () => {
      for(const el of [c, l]) {
        el?.style.removeProperty('transition');
        el?.style.removeProperty('transform');
      }
    };

    if(commit) {
      // the chat closes by itself from where the finger left it: the inline position goes once the app has moved on
      for(const el of [c, l]) el?.style.removeProperty('transition');
      const observer = new MutationObserver(() => {
        if(chatOpen()) return;
        observer.disconnect();
        requestAnimationFrame(clean);
      });
      observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
      setTimeout(() => {
        observer.disconnect();
        clean();
      }, 700);
      // the same step as the arrow in the top bar
      const back = document.querySelector<HTMLElement>('.chat.active .sidebar-close-button, .chat .sidebar-close-button');
      if(back) back.click();
      else androidGoBack();
    } else {
      // back to where it was
      for(const el of [c, l]) el?.style.removeProperty('transition');
      follow(0);
      left()?.style.setProperty('transform', `translate3d(${-(center().offsetWidth || window.innerWidth) * .25}px, 0, 0)`);
      setTimeout(clean, 260);
    }
  };

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    // in a chat from anywhere (but where touches are used); elsewhere from the left edge only
    tracking = e.touches.length === 1 && (chatOpen() ? !target.closest?.(KEEPS_TOUCHES) : touch.clientX <= EDGE);
    done = dragging = false;
    startX = lastX = touch.clientX;
    startY = touch.clientY;
    lastT = performance.now();
    speed = 0;
  }, {passive: true});

  document.addEventListener('touchmove', (e) => {
    if(!tracking || done) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);

    if(!chatOpen()) {
      if(dy > Math.max(24, dx * 1.2) && dx < DISTANCE) {
        tracking = false; // it is a scroll
        return;
      }

      if(dx >= DISTANCE && dy <= dx * SLOPE) {
        done = true;
        androidGoBack();
      }

      return;
    }

    if(!dragging) {
      if(dy > 12 && dy > dx) {
        tracking = false; // it is a scroll
        return;
      }

      // it has to go to the right, and more along than across
      if(dx < 14 || dx < dy * 1.4) return;
      dragging = true;
      for(const el of [center(), left()]) el?.style.setProperty('transition', 'none');
    }

    const now = performance.now();
    speed = (touch.clientX - lastX) / Math.max(1, now - lastT);
    lastX = touch.clientX;
    lastT = now;
    follow(Math.max(0, dx));
    // the page must not scroll under a swipe
    e.preventDefault();
  }, {passive: false});

  const end = (e: TouchEvent) => {
    if(dragging) {
      const width = center().offsetWidth || window.innerWidth;
      const dx = (e.changedTouches?.[0]?.clientX ?? lastX) - startX;
      release(dx > width * .35 || speed > .6);
    }

    tracking = dragging = false;
  };

  document.addEventListener('touchend', end, {passive: true});
  document.addEventListener('touchcancel', end, {passive: true});
}
