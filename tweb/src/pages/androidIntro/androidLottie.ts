import lottieLoader from '@lib/lottie/lottieLoader';
import type {LottieOptions} from '@lib/lottie/lottiePlayer';

const ROOT = 'assets/android/lottie/';

let instance = 0;

/**
 * Plays one of the official Telegram for Android animations (res/raw/*.json, shipped gzipped as
 * `assets/android/lottie/<name>.tgs`). The files are served without a `.tgs` content type, which
 * tells tweb's own loader to treat the bytes as plain JSON, so they are inflated here.
 */
export async function loadAndroidLottie(name: string, params: Omit<LottieOptions, 'animationData' | 'name'>) {
  const url = ROOT + name + '.tgs';
  const response = await fetch(url);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const blob = await new Response(stream).blob();
  // the loader shares one player per name: give every instance its own, so that one being torn down
  // (the switch is mounted twice while the app starts) cannot destroy another
  return lottieLoader.loadAnimationFromURLNext(new Blob([blob], {type: 'application/json'}), {...params, name: url + '#' + ++instance}, url);
}
