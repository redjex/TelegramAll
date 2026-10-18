/**
 * The header of the chat list the way Telegram for Android has it: a title on the left, the menu (three
 * dots instead of the burger) on the right, the stories under it that fold into the title row, and the
 * search pill under them. The title row gets the two elements the layout is built on; the rest is CSS
 * (scss/partials/_androidInsets.scss).
 */
let measureTitle: () => void;

/** measures again how far the title has to go to the middle of the stories (their number changes where it stands) */
export function updateAndroidTitleShift() {
  measureTitle?.();
}

export default function setupAndroidChatsHeader() {
  const header = document.querySelector('.item-main .main-search-sidebar-header');
  if(!header || header.querySelector('.android-stories-anchor')) return;

  // the stack of folded story avatars ends at the right edge of this
  const anchor = document.createElement('div');
  anchor.classList.add('android-stories-anchor');

  const title = document.createElement('div');
  title.classList.add('android-chats-title');
  title.textContent = 'Telegram';

  // the same word over the stories when they are open: the two trade places by fading, the one beside
  // the folded avatars goes as the stories open
  const openTitle = document.createElement('div');
  openTitle.classList.add('android-chats-title-open');
  openTitle.textContent = title.textContent;

  header.prepend(anchor, title, openTitle);

  // how far the title has to go to stand over the middle of the stories
  const item = header.closest<HTMLElement>('.item-main');
  measureTitle = () => {
    // where the title stands now, beside the stack of folded avatars (its margin follows their number)
    const shift = item.clientWidth / 2 - (title.offsetLeft + title.offsetWidth / 2);
    title.style.setProperty('--title-shift', Math.round(shift) + 'px');
  };

  const observer = new ResizeObserver(measureTitle);
  observer.observe(item);
  observer.observe(title);
  measureTitle();
}
