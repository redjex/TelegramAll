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
const PAD = 48;
/** the refraction map is drawn at this fraction of the size: it is smooth, and the per-pixel work is quartered */
const MAP_SCALE = .5;
/**
 * The glass of the drops: a convex "squircle" lens as in kube.io's write-up of Apple's Liquid Glass. The bezel
 * is the rim (px) in which the surface curves from the edge up to the flat top; the lens is HEIGHT px high at
 * the top and rests on THICKNESS px of flat glass. Light arrives straight down on the backdrop and bends at the
 * surface by Snell's law (air 1, glass 1.5).
 */
const BEZEL = 16;
const HEIGHT = 20;
const THICKNESS = 8;
const IOR = 1.5;
/** the light for the highlight comes from this side (a unit vector: up and to the left) */
const LIGHT_X = -.6, LIGHT_Y = -.8;
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
  swellRecord: number,
  /** a drop pulled by a finger: which one (0 none, 1 clip, 2 field, 3 record), and by how much (px) */
  stretch: number,
  dragX: number,
  dragY: number
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

const PROFILE_SIZE = 128;

/**
 * How far the backdrop under the rim is pulled, by the distance from the edge (0 at the edge … 1 at the end of
 * the bezel), 0 … 1 of the largest pull, and that largest pull in px. 127 samples, as the map has 8 bits.
 */
const PROFILE = (() => {
  // the surface of the bezel: a convex squircle, y = (1 - (1 - x)^4)^(1/4)
  const surface = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), .25);
  const pull = new Float32Array(PROFILE_SIZE);
  let max = 0;
  for(let i = 0; i < PROFILE_SIZE; ++i) {
    const x = Math.min(.995, Math.max(.002, i / (PROFILE_SIZE - 1)));
    const delta = .001;
    // the slope of the surface in px per px (the height is HEIGHT px over a bezel of BEZEL px)
    const slope = (surface(x + delta) - surface(x - delta)) / (2 * delta) * (HEIGHT / BEZEL);
    const incidence = Math.atan(slope);
    const refracted = Math.asin(Math.sin(incidence) / IOR);
    // the ray leaves the surface bent by (incidence - refracted) and travels down through what is left of the glass
    const lateral = (surface(x) * HEIGHT + THICKNESS) * Math.tan(incidence - refracted);
    pull[i] = lateral;
    max = Math.max(max, lateral);
  }

  for(let i = 0; i < PROFILE_SIZE; ++i) pull[i] /= max;
  return {pull, max};
})();

/** the largest shift of the backdrop in px: the `scale` of the displacement filter */
const MAX_PULL = PROFILE.max;

/** the displacement map of the merged shapes and the highlight on its rim, both as PNG data URLs */
function drawMaps(width: number, height: number, shapes: GooeyShape[]) {
  const w = Math.round((width + PAD * 2) * MAP_SCALE), h = Math.round((height + PAD * 2) * MAP_SCALE);
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    return {canvas, ctx, image: ctx.createImageData(w, h)};
  };
  const map = make(), spec = make();
  const k = 1 / MAP_SCALE;
  const local = shapes.map((s) => ({...s, x: s.x + PAD, y: s.y + PAD}));
  for(let y = 0; y < h; ++y) {
    for(let x = 0; x < w; ++x) {
      const px = (x + .5) * k, py = (y + .5) * k;
      const depth = -sdShapes(px, py, local);
      let dx = 0, dy = 0, light = 0;
      if(depth > 0 && depth < BEZEL) {
        const nx = sdShapes(px + 1, py, local) - sdShapes(px - 1, py, local);
        const ny = sdShapes(px, py + 1, local) - sdShapes(px, py - 1, local);
        const len = Math.hypot(nx, ny) || 1;
        const ox = nx / len, oy = ny / len;
        const magnitude = PROFILE.pull[Math.round((1 - depth / BEZEL) * (PROFILE_SIZE - 1))];
        dx = -ox * magnitude;
        dy = -oy * magnitude;
        if(depth < 5) {
          // the rim catches the light on the side it comes from, and a little on the opposite one
          const facing = ox * LIGHT_X + oy * LIGHT_Y;
          const fall = Math.exp(-Math.pow(depth / 1.8, 2));
          light = (Math.pow(Math.max(0, facing), 3) + .35 * Math.pow(Math.max(0, -facing), 3)) * fall;
        }
      }

      const i = (y * w + x) * 4;
      map.image.data[i] = Math.round(128 + dx * 127);
      map.image.data[i + 1] = Math.round(128 + dy * 127);
      map.image.data[i + 2] = 128;
      map.image.data[i + 3] = 255;
      spec.image.data[i] = spec.image.data[i + 1] = spec.image.data[i + 2] = 255;
      spec.image.data[i + 3] = Math.round(Math.min(1, light) * 255);
    }
  }

  map.ctx.putImageData(map.image, 0, 0);
  spec.ctx.putImageData(spec.image, 0, 0);
  return {map: map.canvas.toDataURL(), spec: spec.canvas.toDataURL()};
}

export type GooeyGlassOptions = {
  /** the box the drops live in; the layer is as big as it */
  host: HTMLElement,
  /** the shapes for the current state, in the host's coordinates */
  getShapes: (width: number, height: number, state: GooeyState) => GooeyShape[],
  /** how long a change takes, ms */
  duration?: number,
  /** called after every redraw, so what lies on the drops (icons, text) can follow them */
  onRender?: (state: GooeyState) => void
};

const REST: GooeyState = {left: 0, right: 0, swellClip: 0, swellField: 0, swellRecord: 0, stretch: 0, dragX: 0, dragY: 0};
/** what the tween leaves alone: the drag has a spring of its own */
const NOT_TWEENED = new Set<keyof GooeyState>(['stretch', 'dragX', 'dragY']);

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
  // the light on the rim, over the glass (masked to the shape like the glass itself)
  const highlight = document.createElement('div');
  highlight.className = 'gooey-glass-highlight';
  layer.append(shadow, rim, glass, highlight);
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
  let springRaf = 0;

  // the maps are the dear part, so while things move they are made a few times a second, and once more when they stop
  let mapTimer = 0;
  let latest: {width: number, height: number, shapes: GooeyShape[]};
  const scheduleMaps = (width: number, height: number, shapes: GooeyShape[]) => {
    latest = {width, height, shapes};
    if(mapTimer) return;
    const moving = raf || springRaf || state.stretch;
    mapTimer = window.setTimeout(() => {
      mapTimer = 0;
      const maps = drawMaps(latest.width, latest.height, latest.shapes);
      refraction?.update(latest.width + PAD * 2, latest.height + PAD * 2, maps.map, MAX_PULL);
      highlight.style.setProperty('background-image', `url("${maps.spec}")`);
    }, moving ? 50 : 0);
  };

  const render = () => {
    const width = host.offsetWidth, height = host.offsetHeight;
    if(!width || !height) return;
    const shapes = getShapes(width, height, state);
    scheduleMaps(width, height, shapes);

    const set = (el: HTMLElement, mask: string) => {
      el.style.setProperty('mask-image', mask);
      el.style.setProperty('-webkit-mask-image', mask);
    };
    const body = buildMask(width, height, shapes, 0);
    set(shadowInner, body);
    set(glass, body);
    set(highlight, body);
    // the rim is only the ring: the grown shape with the shape itself cut out of it
    set(rim, `${buildMask(width, height, shapes, 1)}, ${body}`);
    options.onRender?.(state);
  };

  const step = (now: number) => {
    const k = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    for(const key in state) {
      if(NOT_TWEENED.has(key as keyof GooeyState)) continue;
      state[key as keyof GooeyState] = from[key as keyof GooeyState] + (target[key as keyof GooeyState] - from[key as keyof GooeyState]) * eased;
    }

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

  /** runs the drops to `values` (the rest of the state goes back to rest; a pull is left to its own spring) */
  const setState = (values: Partial<GooeyState>, onDone?: () => void) => {
    done = onDone;
    target = {...REST, ...values};
    from = {...state};
    start = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  };

  /** a finger pulls the drop `which` (1 clip, 2 field, 3 record) by (x, y) px from where it lies */
  const drag = (which: number, x: number, y: number) => {
    cancelAnimationFrame(springRaf);
    springRaf = 0;
    state.stretch = which;
    state.dragX = x;
    state.dragY = y;
    render();
  };

  /** the finger lets go: the drop springs back, overshoots a little and settles, the neck snapping with it */
  const release = () => {
    if(!state.stretch) return;
    cancelAnimationFrame(springRaf);
    let vx = 0, vy = 0, last = performance.now();
    const STIFFNESS = 280, DAMPING = 14;
    const spring = (now: number) => {
      const dt = Math.min(.032, (now - last) / 1000);
      last = now;
      vx += (-STIFFNESS * state.dragX - DAMPING * vx) * dt;
      vy += (-STIFFNESS * state.dragY - DAMPING * vy) * dt;
      state.dragX += vx * dt;
      state.dragY += vy * dt;
      if(Math.hypot(state.dragX, state.dragY) < .4 && Math.hypot(vx, vy) < 8) {
        state.dragX = state.dragY = state.stretch = 0;
        springRaf = 0;
        render();
        return;
      }

      render();
      springRaf = requestAnimationFrame(spring);
    };
    springRaf = requestAnimationFrame(spring);
  };

  const observer = new ResizeObserver(render);
  observer.observe(host);
  render();

  return {
    layer,
    setState,
    drag,
    release,
    /** the drops run to `values` and part again */
    pulse: (values: Partial<GooeyState>) => setState(values, () => setState({})),
    update: render,
    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(springRaf);
      clearTimeout(mapTimer);
      refraction?.remove();
      observer.disconnect();
      layer.remove();
    }
  };
}
