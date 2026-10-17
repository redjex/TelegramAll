import lottieLoader from '@lib/lottie/lottieLoader';
import type LottiePlayer from '@lib/lottie/lottiePlayer';
import type {LottieOptions} from '@lib/lottie/lottiePlayer';

const ROOT = 'assets/android/lottie/';

let instance = 0;
let queue: Promise<void> = Promise.resolve();

/**
 * Plays one of the official Telegram for Android animations (res/raw/*.json, shipped gzipped as
 * `assets/android/lottie/<name>.tgs`). The files are served without a `.tgs` content type, which
 * tells tweb's own loader to treat the bytes as plain JSON, so they are inflated here.
 */
export async function loadAndroidLottie(name: string, params: Omit<LottieOptions, 'animationData' | 'name'>) {
  // The workers drop animations that start at the same moment (a bar of three icons, the switch mounted
  // twice): the next one is started only when the one before has come up.
  const turn = queue;
  let release: () => void;
  queue = new Promise<void>((resolve) => release = resolve);
  await turn;

  try {
    const url = ROOT + name + '.tgs';
    const response = await fetch(url);
    const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
    const blob = await new Response(stream).blob();
    // the loader shares one player per name: give every instance its own, so that one being torn down
    // cannot destroy another
    const player = await lottieLoader.loadAnimationFromURLNext(new Blob([blob], {type: 'application/json'}), {...params, name: url + '#' + ++instance}, url);
    for(let waited = 0; (player as any).frameCount === undefined && !player.hasFailed && waited < 3000; waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return player;
  } finally {
    release();
  }
}

// the lottie workers can be busy for a while at start-up (the first seconds of the dev server): keep asking
const MAX_ATTEMPTS = 20;

export type MountedAndroidLottie = {
  readonly player: LottiePlayer | undefined,
  destroy: () => void
};

/**
 * Puts an official animation into `host` and keeps it alive: waits for the host to be in the document
 * (the player destroys itself otherwise), starts over when the worker drops the animation (a slow start,
 * the dev server still compiling) and, when it will not start at all, calls `onFailed`. `onLoaded` gets the
 * player each time it has started.
 */
export function mountAndroidLottie(
  host: HTMLElement,
  name: string,
  options: Pick<LottieOptions, 'width' | 'height'> & {
    onLoaded: (player: LottiePlayer) => void,
    onFailed?: () => void
  }
): MountedAndroidLottie {
  let player: LottiePlayer;
  let destroyed = false;

  const retryOrGiveUp = (tries: number) => {
    if(destroyed) return;
    if(tries < MAX_ATTEMPTS) {
      setTimeout(() => attempt(tries + 1), Math.min(500 * (tries + 1), 2000));
    } else {
      options.onFailed?.();
    }
  };

  const attempt = async(tries: number) => {
    while(!host.isConnected && !destroyed) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    if(destroyed) return;

    let loaded: LottiePlayer;
    try {
      loaded = await loadAndroidLottie(name, {
        container: host,
        loop: false,
        autoplay: false,
        width: options.width,
        height: options.height,
        // small icons: without it tweb halves the resolution of a 24px animation on Android, and on a
        // phone screen it comes out soft and thin
        needUpscale: true,
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

    loaded.addEventListener('error', () => {
      if(player !== loaded) return;
      player = undefined;
      loaded.remove();
      host.replaceChildren();
      retryOrGiveUp(tries);
    });

    player = loaded;
    options.onLoaded(loaded);
  };

  attempt(0);

  return {
    get player() {
      return player;
    },
    destroy() {
      destroyed = true;
      player?.remove();
      player = undefined;
    }
  };
}
