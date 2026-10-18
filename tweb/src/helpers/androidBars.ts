import {IN_ANDROID_PREVIEW_FRAME} from '@environment/userAgent';

/**
 * The Android app draws the page edge to edge, under the system bars. The native side tells how big the
 * bars are (and again whenever they change); the sizes live in `--sat` / `--sab` / `--sal` / `--sar`
 * (CSS px) for whatever has to stay clear of them. The phone frame of the web preview plays the same part.
 */
export default function initAndroidInsets() {
  const style = document.documentElement.style;
  const set = (top: number, bottom: number, left = 0, right = 0) => {
    style.setProperty('--sat', top + 'px');
    style.setProperty('--sab', bottom + 'px');
    style.setProperty('--sal', left + 'px');
    style.setProperty('--sar', right + 'px');
  };

  try {
    const native = (window as any).TgAllAndroid?.getInsets?.();
    if(native) {
      const [top, bottom, left, right] = String(native).split(',').map(parseFloat);
      set(top, bottom, left, right);
      return;
    }
  } catch{}

  if(IN_ANDROID_PREVIEW_FRAME) {
    set(34, 24);
  }
}

/**
 * Takes the navigation bar (the strip at the bottom) away while a full-screen sheet is up, and gives it
 * back. The class on the root is for the phone frame of the web preview, which hides its own strip.
 */
export function setAndroidNavigationHidden(hidden: boolean) {
  document.documentElement.classList.toggle('android-nav-hidden', hidden);
  // the frame of the preview has no native side to tell the bar's size
  if(IN_ANDROID_PREVIEW_FRAME) document.documentElement.style.setProperty('--sab', hidden ? '0px' : '24px');
  try {
    (window as any).TgAllAndroid?.setNavigationHidden?.(hidden);
  } catch{}
}
