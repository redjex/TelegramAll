import {createIntroRenderer, IntroTextures} from '@/pages/androidIntro/introRenderer';

const BASE = 'assets/android/img/';

type BitmapKey = Exclude<keyof IntroTextures, 'telegram_sphere'>;

const FILES: Record<BitmapKey, string> = {
  fast_arrow_shadow: 'intro_fast_arrow_shadow.webp',
  fast_arrow: 'intro_fast_arrow.webp',
  fast_body: 'intro_fast_body.webp',
  fast_spiral: 'intro_fast_spiral.webp',
  ic_bubble_dot: 'intro_ic_bubble_dot.webp',
  ic_bubble: 'intro_ic_bubble.webp',
  ic_cam_lens: 'intro_ic_cam_lens.webp',
  ic_cam: 'intro_ic_cam.webp',
  ic_pencil: 'intro_ic_pencil.webp',
  ic_pin: 'intro_ic_pin.webp',
  ic_smile_eye: 'intro_ic_smile_eye.webp',
  ic_smile: 'intro_ic_smile.webp',
  ic_videocam: 'intro_ic_videocam.webp',
  knot_down: 'intro_knot_down.webp',
  knot_up: 'intro_knot_up.webp',
  powerful_infinity_white: 'intro_powerful_infinity_white.webp',
  powerful_infinity: 'intro_powerful_infinity.webp',
  powerful_mask: 'intro_powerful_mask.webp',
  powerful_star: 'intro_powerful_star.webp',
  private_door: 'intro_private_door.webp',
  private_screw: 'intro_private_screw.webp'
};

/** The blue disc with the white plane that the first slide shows: the logo drawn on a canvas. */
function createSphere() {
  const size = 432;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const d = document.getElementById('logo')?.getAttribute('d');
  if(d) {
    ctx.scale(size / 160, size / 160);
    ctx.fillStyle = '#229af0';
    ctx.fill(new Path2D(d), 'evenodd');
  }
  return canvas;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** The colour of the screen behind the intro (the intro's windows and masks are drawn in it). */
function readBackground(): number[] {
  const el = document.getElementById('auth-pages') || document.body;
  const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || ['255', '255', '255'];
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255, 1];
}

/**
 * Runs the official intro scenes (see `introRenderer.ts`) on a canvas of 200x150 CSS pixels.
 * `getScroll` returns the pager position in pages (0 = first slide, 1.5 = half way to the third).
 * Returns a function that stops it.
 */
export async function startIntro(canvas: HTMLCanvasElement, getScroll: () => number): Promise<() => void> {
  const entries = await Promise.all(
    (Object.keys(FILES) as BitmapKey[]).map(async(key) => [key, await loadImage(BASE + FILES[key])] as const)
  );
  const images = {...Object.fromEntries(entries), telegram_sphere: createSphere()} as IntroTextures;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(200 * dpr);
  canvas.height = Math.round(150 * dpr);

  const gl = canvas.getContext('webgl', {alpha: false, depth: true, antialias: true, premultipliedAlpha: true});
  if(!gl) {
    return () => {};
  }

  let background = readBackground();
  const renderer = createIntroRenderer(gl, images, background);
  renderer.onSurfaceChanged(canvas.width, canvas.height, Math.min(canvas.width / 150, canvas.height / 150), 0);

  const observer = new MutationObserver(() => {
    const next = readBackground();
    if(next.some((v, i) => Math.abs(v - background[i]) > 0.001)) {
      background = next;
      renderer.setBackgroundColor(next[0], next[1], next[2], next[3]);
    }
  });
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});

  // the original starts its clock one second in, so the first slide is already at rest
  const startedAt = performance.now() - 1000;
  let last = performance.now();
  let frame = 0;
  let stopped = false;

  const draw = () => {
    if(stopped) return;
    const now = performance.now();
    const pos = getScroll();
    const page = Math.max(0, Math.min(5, Math.round(pos)));
    renderer.setPage(page);
    renderer.setScrollOffset(pos - page);
    renderer.setDate((now - startedAt) / 1000);
    renderer.onDrawFrame(Math.min(now - last, 16));
    last = now;
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}
