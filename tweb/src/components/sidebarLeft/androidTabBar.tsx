import {createEffect, createSignal, For, onCleanup, onMount} from 'solid-js';
import {render} from 'solid-js/web';

import {AvatarNewTsx} from '@components/avatarNew';
import {AppContactsTab, AppEditProfileTab, AppSettingsTab, getEditProfileInitArgs} from '@components/solidJsTabs/tabs';
import classNames from '@helpers/string/classNames';
import pause from '@helpers/schedulers/pause';
import applyLiquidGlass from '@helpers/liquidGlass';
import rootScope from '@lib/rootScope';
import {setTabSwitchDirection} from '@components/transition';
import type SliderSuperTab from '@components/sliderTab';
import Icon from '@components/icon';
import {mountAndroidLottie, MountedAndroidLottie} from '@/pages/androidIntro/androidLottie';
import type {AppSidebarLeft} from '@components/sidebarLeft';

import styles from '@/components/sidebarLeft/androidTabBar.module.scss';

type TabId = 'chats' | 'contacts' | 'settings' | 'profile';

const TAB_ORDER: TabId[] = ['chats', 'contacts', 'settings', 'profile'];

/** a little more than the slide itself, so the old screen is gone only after the new one has settled */
const SLIDE_TIME = 450;

/** the glyph fills only part of the animation's canvas: the canvas is a little bigger than the official 24dp */
const ICON_SIZE = 26;

/** the droplet at rest: its height and the gap between it and the edge of the bar */
const DROPLET_HEIGHT = 48;
const DROPLET_INSET = 4;

/** the last frame of the official tab animations (res/raw/tab_*.json run from 0 to 6 at 60 fps) */
const LAST_FRAME = 5;

type TabConfig = {id: TabId, label: string, animation?: string, fallback: Icon};

const TABS: TabConfig[] = [
  {id: 'chats', label: 'Chats', animation: 'tab_chats', fallback: 'message'},
  {id: 'contacts', label: 'Contacts', animation: 'tab_contacts', fallback: 'user'},
  {id: 'settings', label: 'Settings', animation: 'tab_settings', fallback: 'settings'},
  {id: 'profile', label: 'Profile', fallback: 'user'}
];

/** the outline of a rounded rectangle (a stadium when it is as tall as twice its radius) for a CSS path() */
function roundedRectPath(left: number, top: number, right: number, bottom: number) {
  const r = Math.min((right - left) / 2, (bottom - top) / 2);
  const f = (n: number) => Math.round(n * 100) / 100;
  return 'M' + f(left + r) + ' ' + f(top) + 'H' + f(right - r) +
    'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(right) + ' ' + f(top + r) +
    'V' + f(bottom - r) +
    'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(right - r) + ' ' + f(bottom) +
    'H' + f(left + r) +
    'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(left) + ' ' + f(bottom - r) +
    'V' + f(top + r) +
    'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(left + r) + ' ' + f(top) + 'Z';
}

/** which of the bar's tabs the screen on top of the left sidebar belongs to; none for the deeper screens */
function detectTab(): TabId | undefined {
  const slider = document.querySelector('.sidebar-slider');
  if(!slider) return;
  const active = [...slider.children].filter((el) => el.classList.contains('tabs-tab') && el.classList.contains('active'));
  const top = active[active.length - 1] as HTMLElement;
  if(!top || top.classList.contains('item-main')) return 'chats';
  if(top.classList.contains('settings-container')) return 'settings';
  if(top.id === 'contacts-container') return 'contacts';
  if(top.classList.contains('edit-profile-container')) return 'profile';
}

/**
 * The icon of a tab. The bar draws every tab twice: once plain (the outline, in the text colour) and once
 * lit (filled, blue) in a layer that is cut out to the droplet, so the colour is only ever inside it.
 */
function TabIcon(props: {tab: TabConfig, lit?: boolean}) {
  let host!: HTMLDivElement;
  let mounted: MountedAndroidLottie;

  const paint = () => {
    const player = mounted?.player;
    if(!player) return;
    const style = getComputedStyle(document.documentElement);
    player.setColor(style.getPropertyValue(props.lit ? '--as-blue' : '--as-text').trim(), false);
    player.requestFrame(props.lit ? LAST_FRAME : 0);
  };

  onMount(() => {
    mounted = mountAndroidLottie(host, props.tab.animation, {
      width: ICON_SIZE,
      height: ICON_SIZE,
      onLoaded: paint,
      onFailed: () => host.replaceChildren(Icon(props.tab.fallback))
    });
  });

  rootScope.addEventListener('theme_changed', paint);
  onCleanup(() => {
    rootScope.removeEventListener('theme_changed', paint);
    mounted?.destroy();
  });

  return <div ref={host} class={styles.icon} />;
}

/** the face of one tab: the icon and the label */
function TabFace(props: {tab: TabConfig, lit?: boolean}) {
  return (
    <>
      {props.tab.id === 'profile' ? (
        <div class={styles.icon}>
          <div class={styles.avatar}><AvatarNewTsx peerId={rootScope.myId} size={22} isDialog={false} /></div>
        </div>
      ) : (
        <TabIcon tab={props.tab} lit={props.lit} />
      )}
      <span class={styles.label}>{props.tab.label}</span>
    </>
  );
}

function AndroidTabBar(props: {sidebar: AppSidebarLeft}) {
  const [current, setCurrent] = createSignal<TabId>('chats');
  const [shown, setShown] = createSignal(true);
  let pill!: HTMLDivElement;
  let droplet!: HTMLDivElement;
  let glow!: HTMLDivElement;
  let base!: HTMLDivElement;

  // The sidebar reports the screen on top with a delay: while the user is hopping between tabs it would
  // pull the droplet back to the one he has just left.
  let chosen: TabId | undefined;
  let chosenUntil = 0;

  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const tab = detectTab();
      // the bar belongs to the list of chats and the screens of its own tabs: not to a chat, not to the
      // deeper screens
      const visible = !!tab && document.body.classList.contains('is-left-column-shown');
      setShown(visible);
      document.documentElement.classList.toggle('android-tabbar-on', visible);
      if(tab) {
        if(chosen && tab !== chosen && performance.now() < chosenUntil) return;
        chosen = undefined;
        if(!busy && pending === undefined) shownTab = tab;
        setCurrent(tab);
      }
    });
  };

  onMount(() => {
    const observer = new MutationObserver(update);
    observer.observe(document.querySelector('.sidebar-slider'), {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
    update();

    const stopGlass = applyLiquidGlass(pill, {after: 'blur(7px) var(--as-glass-after)'});
    const sizeObserver = new ResizeObserver(() => droplets.snap());
    sizeObserver.observe(pill);
    onCleanup(() => {
      observer.disconnect();
      sizeObserver.disconnect();
      stopGlass();
      droplets.stop();
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('android-tabbar-on');
    });
  });

  // ----- the droplet: a glass lens under the selected tab that can be taken and dragged along the bar.
  // It follows the finger, stretches with its speed, and settles on a tab with a spring, as on iOS.
  const droplets = (() => {
    const SPRING = 320; // stiffness
    const DAMPING = 24;
    let x = 0, v = 0, target = 0, press = 0, pressTarget = 0, raf = 0, last = 0, dragging = false;

    const tabWidth = () => (pill.clientWidth - 8) / TABS.length;
    let grabbedAt = 0;
    const xOf = (id: TabId) => TAB_ORDER.indexOf(id) * tabWidth();
    const indexAt = (value: number, width: number) => Math.max(0, Math.min(TABS.length - 1, Math.round(value / width)));

    const render = () => {
      const stretch = Math.min(Math.abs(v) / 2400, .3);
      // held, the droplet swells well past its resting size
      const scale = 1 + .26 * press;
      const sx = scale * (1 + stretch), sy = scale * (1 - stretch * .45);
      droplet.style.transform = 'translate3d(' + x + 'px, 0, 0) scale(' + sx + ', ' + sy + ')';
      droplet.style.setProperty('--press', String(press));

      // The lit layer shows through a window the shape of the droplet, and the plain layer has that window
      // cut out of it: inside the droplet there is only blue, outside it only the plain tabs.
      const w = tabWidth();
      const cx = DROPLET_INSET + x + w / 2;
      const cy = DROPLET_INSET + DROPLET_HEIGHT / 2;
      const halfWidth = w * sx / 2, halfHeight = DROPLET_HEIGHT * sy / 2;
      const hole = roundedRectPath(cx - halfWidth, cy - halfHeight, cx + halfWidth, cy + halfHeight);
      glow.style.clipPath = 'path(\'' + hole + '\')';
      base.style.clipPath = 'path(evenodd, \'M-40 -40H' + (pill.clientWidth + 40) + 'V' + (pill.clientHeight + 40) + 'H-40Z' + hole + '\')';
    };

    const tick = (time: number) => {
      const dt = Math.min(.032, (time - last) / 1000) || .016;
      last = time;

      if(dragging) {
        const next = x + (target - x) * Math.min(1, dt * 18);
        v = (next - x) / dt;
        x = next;
      } else {
        v += (SPRING * (target - x) - DAMPING * v) * dt;
        x += v * dt;
      }

      press += (pressTarget - press) * Math.min(1, dt * 14);
      render();

      const moving = dragging || Math.abs(target - x) > .05 || Math.abs(v) > .5 || Math.abs(pressTarget - press) > .01;
      raf = moving ? requestAnimationFrame(tick) : 0;
      if(!moving) {
        x = target;
        v = 0;
        press = pressTarget;
        render();
      }
    };

    const run = () => {
      if(!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    return {
      /** puts the droplet over the tab at once (first layout, resize) */
      snap() {
        x = target = xOf(current());
        v = 0;
        droplet.style.width = tabWidth() + 'px';
        render();
      },
      moveTo(id: TabId) {
        if(dragging || !droplet) return;
        target = xOf(id);
        run();
      },
      stop() {
        cancelAnimationFrame(raf);
      },
      /** a touch on the bar: a tap picks the tab under it, a drag takes the droplet along */
      begin(event: PointerEvent) {
        const rect = pill.getBoundingClientRect();
        const width = tabWidth();
        const startX = event.clientX;
        const grabbed = indexAt(startX - rect.left - 4 - width / 2, width);
        let moved = false;

        // the droplet is taken where it is and moves by as much as the finger does
        grabbedAt = x;
        const follow = (clientX: number) => {
          target = Math.max(-10, Math.min(width * (TABS.length - 1) + 10, grabbedAt + clientX - startX));
        };

        const onMove = (e: PointerEvent) => {
          if(!moved && Math.abs(e.clientX - startX) < 6) return;
          if(!moved) {
            moved = true;
            dragging = true;
            pressTarget = 1;
            run();
          }

          follow(e.clientX);
        };

        const onUp = (e: PointerEvent) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          const id = TAB_ORDER[moved ? indexAt(target, width) : grabbed];
          dragging = false;
          pressTarget = 0;
          target = xOf(id);
          run();
          if(e.type !== 'pointercancel') open(id);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        pressTarget = .5;
        run();
      }
    };
  })();

  createEffect(() => droplets.moveTo(current()));

  // ----- the screens change one switch at a time: tapping faster than they can slide moves the droplet
  // at once, and the screen follows to the last tab asked for (the ones in between are skipped)
  let shownTab: TabId = 'chats'; // what is really on the screen
  let busy = false;
  let pending: TabId | undefined;

  const switchTo = async(from: TabId, id: TabId) => {
    // to a tab on the right the new screen comes in from the right, to one on the left from the left
    setTabSwitchDirection(TAB_ORDER.indexOf(id) > TAB_ORDER.indexOf(from) ? 1 : -1);

    const sidebar = props.sidebar;
    if(id === 'chats') {
      sidebar.closeEverythingInside();
      await pause(SLIDE_TIME);
      return;
    }

    // the screen being left stays under the new one until it has slid away, and is then dropped quietly:
    // no trip through the list of chats between two tabs
    const leaving = from === 'chats' ? undefined : sidebar.getTopTab();
    const tab = id === 'contacts' ? sidebar.createTab(AppContactsTab) :
      id === 'settings' ? sidebar.createTab(AppSettingsTab) :
        sidebar.createTab(AppEditProfileTab);
    await (id === 'profile' ? tab.open(getEditProfileInitArgs(true)) : (tab as SliderSuperTab).open());
    await pause(SLIDE_TIME);
    if(leaving) sidebar.closeTabSilently(leaving);
  };

  const pump = async() => {
    busy = true;
    try {
      while(pending !== undefined) {
        const id = pending;
        pending = undefined;
        if(id === shownTab) continue;
        const from = shownTab;
        shownTab = id;
        await switchTo(from, id);
      }
    } finally {
      busy = false;
    }
  };

  const open = (id: TabId) => {
    if(id === current()) {
      // the chats tab, pressed again, goes back to the top of the list
      if(id === 'chats') document.querySelector<HTMLElement>('#chatlist-container .scrollable')?.scrollTo({top: 0, behavior: 'smooth'});
      return;
    }

    setCurrent(id);
    chosen = id;
    chosenUntil = performance.now() + 1500;
    pending = id;
    if(!busy) pump();
  };

  return (
    <div class={classNames(styles.bar, !shown() && styles.hidden)}>
      <div ref={pill} class={styles.pill} role="tablist" onPointerDown={(e) => droplets.begin(e)}>
        <div ref={droplet} class={styles.droplet} />
        <div ref={base} class={styles.base}>
          <For each={TABS}>{(tab) => (
            <button
              class={styles.tab}
              role="tab"
              aria-selected={current() === tab.id}
              // taps and drags are handled by the droplet; this is for the keyboard
              onClick={(e) => e.detail === 0 && open(tab.id)}
            >
              <TabFace tab={tab} />
            </button>
          )}</For>
        </div>
        <div ref={glow} class={styles.glow} aria-hidden="true">
          <For each={TABS}>{(tab) => (
            <div class={styles.tab}>
              <TabFace tab={tab} lit />
            </div>
          )}</For>
        </div>
      </div>
    </div>
  );
}

/** Mounts the bar over the left column; it stays for good. */
export default function mountAndroidTabBar(sidebar: AppSidebarLeft) {
  const mount = document.createElement('div');
  document.body.append(mount);
  render(() => <AndroidTabBar sidebar={sidebar} />, mount);
}

// the bar is mounted once by the sidebar: a hot-swapped copy of this module would leave the page without it
if(import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
