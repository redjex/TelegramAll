import {For, createSignal, onCleanup, onMount} from 'solid-js';

import I18n, {i18n} from '@lib/langPack';

import {startIntro} from '@/pages/androidIntro/startIntro';
import {CardSpec, markWelcomeSeen, useAuthFlow} from '@/pages/authFlow';
import styles from '@/pages/authFlow.module.scss';

if(import.meta.hot) import.meta.hot.accept();

type Spec = Extract<CardSpec, {name: 'welcome'}>;

const PAGES = [1, 2, 3, 4, 5, 6];

/**
 * Android-style intro: the official app's own intro scenes on a canvas (see `androidIntro/`),
 * swipeable slides with a title and a line each, page dots and a "Start Messaging" button that
 * opens the phone-number form.
 */
export default function WelcomeCard(_props: {spec: Spec}) {
  const {navigate} = useAuthFlow();
  const [page, setPage] = createSignal(0);

  let slidesEl!: HTMLDivElement;
  let canvasEl!: HTMLCanvasElement;

  const getPos = () => slidesEl.clientWidth ? Math.abs(slidesEl.scrollLeft) / slidesEl.clientWidth : 0;

  const onScroll = () => {
    setPage(Math.round(getPos()));
  };

  let stop: () => void;
  let disposed = false;
  onMount(() => {
    startIntro(canvasEl, getPos).then((dispose) => {
      if(disposed) dispose();
      else stop = dispose;
    });
  });
  onCleanup(() => {
    disposed = true;
    stop?.();
  });

  const start = () => {
    markWelcomeSeen();
    navigate({name: 'signIn'});
  };

  return (
    <div class={styles.welcome}>
      <canvas ref={canvasEl} class={styles.introCanvas} />
      <div ref={slidesEl} class={styles.welcomeSlides} onScroll={onScroll}>
        <For each={PAGES}>{(n) => (
          <div class={styles.welcomeSlide}>
            <h1 class={styles.welcomeTitle}>{I18n.format(('Login.Welcome.Title' + n) as any, true)}</h1>
            <p class={styles.welcomeText}>{i18n(('Login.Welcome.Text' + n) as any)}</p>
          </div>
        )}</For>
      </div>
      <div class={styles.welcomeDots}>
        <For each={PAGES}>{(n) => <span classList={{[styles.welcomeDotActive]: page() === n - 1}} />}</For>
      </div>
      <button class={styles.welcomeStart} onClick={start}>
        {I18n.format('Login.Welcome.Start', true)}
      </button>
    </div>
  );
}
