import {onCleanup, onMount} from 'solid-js';

import Icon from '@components/icon';
import I18n from '@lib/langPack';
import themeController from '@helpers/themeController';

import {mountAndroidLottie, MountedAndroidLottie} from '@/pages/androidIntro/androidLottie';
import styles from '@/pages/authFlow.module.scss';

// `sun` is the official app's own animation (res/raw/sun.json): frame 0 is the moon, the last one the sun
const LAST_FRAME = 35;

/**
 * The day/night switch of the Android intro: the official sun/moon Lottie, tinted in the accent
 * colour, that plays to the other end when the theme changes.
 */
export default function ThemeSwitchIcon(props: {onClick: (e: MouseEvent) => void}) {
  let host!: HTMLDivElement;
  let mounted: MountedAndroidLottie;

  onMount(() => {
    mounted = mountAndroidLottie(host, 'sun', {
      width: 28,
      height: 28,
      onLoaded: (player) => {
        player.setColor('#229af0', false);
        if(themeController.isNight()) {
          player.curFrame = LAST_FRAME;
          player.requestFrame(LAST_FRAME);
        }
      },
      // the animation will not start here: a still icon instead of an empty button
      onFailed: () => host.replaceChildren(Icon('darkmode_filled'))
    });
  });

  onCleanup(() => mounted?.destroy());

  const onClick = (e: MouseEvent) => {
    const toNight = !themeController.isNight();
    props.onClick(e);
    mounted?.player?.playToFrame({frame: toNight ? LAST_FRAME : 0, speed: 1});
  };

  return (
    <button class={styles.themeButton} onClick={onClick} aria-label={I18n.format('DarkMode', true)}>
      <div ref={host} class={styles.themeLottie} />
    </button>
  );
}
