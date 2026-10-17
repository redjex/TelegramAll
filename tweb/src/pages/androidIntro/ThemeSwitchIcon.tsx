import {onCleanup, onMount} from 'solid-js';

import Icon from '@components/icon';
import I18n from '@lib/langPack';
import type LottiePlayer from '@lib/lottie/lottiePlayer';
import themeController from '@helpers/themeController';

import {loadAndroidLottie} from '@/pages/androidIntro/androidLottie';
import styles from '@/pages/authFlow.module.scss';

// `sun` is the official app's own animation (res/raw/sun.json): frame 0 is the moon, the last one the sun
const LAST_FRAME = 35;
const MAX_ATTEMPTS = 6;

/**
 * The day/night switch of the Android intro: the official sun/moon Lottie, tinted in the accent
 * colour, that plays to the other end when the theme changes.
 */
export default function ThemeSwitchIcon(props: {onClick: (e: MouseEvent) => void}) {
  let host!: HTMLDivElement;
  let player: LottiePlayer;
  let destroyed = false;

  function retryOrGiveUp(tries: number) {
    if(destroyed) return;
    if(tries < MAX_ATTEMPTS) {
      setTimeout(() => attempt(tries + 1), 500);
    } else {
      // the animation will not start here: a still icon instead of an empty button
      host.replaceChildren(Icon('darkmode_filled'));
    }
  }

  async function attempt(tries: number) {
    // the player destroys itself when its container is not in the document yet
    while(!host.isConnected && !destroyed) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    if(destroyed) return;

    let loaded: LottiePlayer;
    try {
      loaded = await loadAndroidLottie('sun', {
        container: host,
        loop: false,
        autoplay: false,
        width: 28,
        height: 28,
        group: 'none'
      });
    } catch(err) {
      retryOrGiveUp(tries);
      return;
    }

    if(destroyed) {
      loaded.remove();
      return;
    }

    // a slow start (the dev server is still compiling) can have the worker drop the animation: start over
    loaded.addEventListener('error', () => {
      if(player !== loaded) return;
      player = undefined;
      loaded.remove();
      host.replaceChildren();
      retryOrGiveUp(tries);
    });

    player = loaded;
    player.setColor('#229af0', false);
    if(themeController.isNight()) {
      player.curFrame = LAST_FRAME;
      player.requestFrame(LAST_FRAME);
    }
  }

  onMount(() => {
    attempt(0);
  });

  onCleanup(() => {
    destroyed = true;
    player?.remove();
  });

  const onClick = (e: MouseEvent) => {
    const toNight = !themeController.isNight();
    props.onClick(e);
    player?.playToFrame({frame: toNight ? LAST_FRAME : 0, speed: 1});
  };

  return (
    <button class={styles.themeButton} onClick={onClick} aria-label={I18n.format('DarkMode', true)}>
      <div ref={host} class={styles.themeLottie} />
    </button>
  );
}
