/**
 * Drops of glass that run into one another, as the glass of iOS 26 does (GlassEffectContainer): the
 * shapes are drawn into an SVG, blurred and cut hard on the alpha channel (the "gooey" / metaball trick), so
 * that where two of them come close a neck grows between them. That SVG is the mask of one glass layer
 * (a blurred, tinted backdrop), so the glass has exactly the outline of the merged shapes. Two more layers
 * with the same mask give the rim (the shape grown by 1px) and the soft shadow under it.
 *
 * Browsers with no `mask-image` on a backdrop-filter element draw the layer as a plain rectangle, which is
 * why the caller only uses it on Android (Chromium).
 */

import {SUPPORTS_LIQUID_GLASS, createLiquidFilter, sdRoundRect} from '@helpers/liquidGlass';

/** room around the row for the blur of the goo filter, in px */
const PAD = 16;
/** the refraction map is drawn at this fraction of the size: it is smooth, and the per-pixel work is quartered */
const MAP_SCALE = .5;
/** how wide the refracting rim is, and how far, in px, what lies at its very edge is pulled */
const BEZEL = 14;
const STRENGTH = 18;
/** how far apart two shapes may be for their distance fields to run into one (the neck), in px */
const NECK = 10;

export type GooeyShape = {
  x: number,
  y: number,
  width: number,
  height: number,
  /** corner radius, at most half of the smaller side */
  radius: number
};

function buildMask(width: number, height: number, shapes: GooeyShape[], grow: number) {
  const w = width + PAD * 2, h = height + PAD * 2;
  const body = shapes.map((s) => {
    const r = Math.min(s.radius, s.width / 2, s.height / 2);
    return `<rect x="${s.x + PAD}" y="${s.y + PAD}" width="${s.width}" height="${s.height}" rx="${r}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<filter id="g" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
    '<feGaussianBlur stdDeviation="3"/>' +
    '<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/>' +
    (grow ? `<feMorphology operator="dilate" radius="${grow}"/>` : '') +
    `</filter><g filter="url(#g)" fill="#000">${body}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * What the drops are doing, each 0 … 1: how far the gap between the clip and the field (`left`) and between
 * the field and the record button (`right`) has closed, and how much each drop is enlarged (a held one).
 */
export type GooeyState = {
  left: number,
  right: number,
  swellClip: number,
  swellField: number,
  swellRecord: number
};

/** the signed distance to the union of the shapes, with the joints rounded (a polynomial smooth minimum) */
function sdShapes(x: number, y: number, shapes: GooeyShape[]) {
  let d = Infinity;
  for(const s of shapes) {
    const r = Math.min(s.radius, s.width / 2, s.height / 2);
    const e = sdRoundRect(x - s.x, y - s.y, s.width, s.height, r);
    if(d === Infinity) {
      d = e;
      continue;
    }

    const h = Math.max(NECK - Math.abs(d - e), 0) / NECK;
    d = Math.min(d, e) - h * h * NECK * .25;
  }

  return d;
}

/** the displacement map of the merged shapes (the same convention as helpers/liquidGlass.ts), as a PNG data URL */
function drawMap(width: number, height: number, shapes: GooeyShape[]) {
  const w = Math.round((width + PAD * 2) * MAP_SCALE), h = Math.round((height + PAD * 2) * MAP_SCALE);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const k = 1 / MAP_SCALE;
  const local = shapes.map((s) => ({...s, x: s.x + PAD, y: s.y + PAD}));
  for(let y = 0; y < h; ++y) {
    for(let x = 0; x < w; ++x) {
      const px = (x + .5) * k, py = (y + .5) * k;
      const depth = -sdShapes(px, py, local);
      let dx = 0, dy = 0;
      if(depth > 0 && depth < BEZEL) {
        const nx = sdShapes(px + 1, py, local) - sdShapes(px - 1, py, local);
        const ny = sdShapes(px, py + 1, local) - sdShapes(px, py - 1, local);
        const len = Math.hypot(nx, ny) || 1;
        // a convex lens: the pull is strongest at the very edge and dies out toward the middle
        const t = 1 - depth / BEZEL;
        const magnitude = 1 - Math.sqrt(1 - t * t * t * t);
        dx = -(nx / len) * magnitude;
        dy = -(ny / len) * magnitude;
      }

      const i = (y * w + x) * 4;
      data[i] = Math.round(128 + dx * 127);
      data[i + 1] = Math.round(128 + dy * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export type GooeyGlassOptions = {
  /** the box the drops live in; the layer is as big as it */
  host: HTMLElement,
  /** the shapes for the current state, in the host's coordinates */
  getShapes: (width: number, height: number, state: GooeyState) => GooeyShape[],
  /** how long a change takes, ms */
  duration?: number
};

const REST: GooeyState = {left: 0, right: 0, swellClip: 0, swellField: 0, swellRecord: 0};

export default function createGooeyGlass(options: GooeyGlassOptions) {
  const {host, getShapes} = options;
  const duration = options.duration ?? 140;

  const layer = document.createElement('div');
  layer.className = 'gooey-glass';
  layer.style.setProperty('--gooey-pad', PAD + 'px');
  const shadow = document.createElement('div');
  shadow.className = 'gooey-glass-shadow';
  const shadowInner = document.createElement('div');
  shadow.append(shadowInner);
  const rim = document.createElement('div');
  rim.className = 'gooey-glass-rim';
  const glass = document.createElement('div');
  glass.className = 'gooey-glass-body';
  layer.append(shadow, rim, glass);
  host.prepend(layer);

  // the glass bends what lies behind it at its rim (Chromium only; elsewhere it stays a blur)
  const refraction = SUPPORTS_LIQUID_GLASS ? createLiquidFilter() : undefined;
  if(refraction) {
    const value = `url(#${refraction.id}) blur(7px) var(--as-glass-after)`;
    glass.style.setProperty('backdrop-filter', value);
    glass.style.setProperty('-webkit-backdrop-filter', value);
  }

  let state: GooeyState = {...REST};
  let target: GooeyState = {...REST};
  let from: GooeyState = {...REST};
  let raf = 0, start = 0, done: () => void;

  // the map is not redrawn on every frame of a movement (it is the dear part): it is made when things stand still
  let mapTimer = 0;
  const drawRefraction = (width: number, height: number, shapes: GooeyShape[]) => {
    refraction.update(width + PAD * 2, height + PAD * 2, drawMap(width, height, shapes), STRENGTH);
  };

  const render = () => {
    const width = host.offsetWidth, height = host.offsetHeight;
    if(!width || !height) return;
    const shapes = getShapes(width, height, state);
    if(refraction) {
      clearTimeout(mapTimer);
      mapTimer = window.setTimeout(() => drawRefraction(width, height, shapes), raf ? 60 : 0);
    }

    const set = (el: HTMLElement, mask: string) => {
      el.style.setProperty('mask-image', mask);
      el.style.setProperty('-webkit-mask-image', mask);
    };
    const body = buildMask(width, height, shapes, 0);
    set(shadowInner, body);
    set(glass, body);
    // the rim is only the ring: the grown shape with the shape itself cut out of it
    set(rim, `${buildMask(width, height, shapes, 1)}, ${body}`);
  };

  const step = (now: number) => {
    const k = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    for(const key in state) state[key as keyof GooeyState] = from[key as keyof GooeyState] + (target[key as keyof GooeyState] - from[key as keyof GooeyState]) * eased;
    render();
    if(k < 1) {
      raf = requestAnimationFrame(step);
      return;
    }

    raf = 0;
    const cb = done;
    done = undefined;
    cb?.();
  };

  /** runs the drops to `values` (the rest of the state goes back to rest) */
  const setState = (values: Partial<GooeyState>, onDone?: () => void) => {
    done = onDone;
    target = {...REST, ...values};
    from = {...state};
    start = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  };

  const observer = new ResizeObserver(render);
  observer.observe(host);
  render();

  return {
    layer,
    setState,
    /** the drops run to `values` and part again */
    pulse: (values: Partial<GooeyState>) => setState(values, () => setState({})),
    update: render,
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(mapTimer);
      refraction?.remove();
      observer.disconnect();
      layer.remove();
    }
  };
}
