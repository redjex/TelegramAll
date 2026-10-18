/**
 * Drops of glass that run into one another, as the glass of iOS 26 does (GlassEffectContainer).
 *
 * Every drop is one element with a `border-radius`, a blurred and tinted backdrop, a soft shadow and a rim of light
 * (an inset shadow). They are placed and sized in the same frame as whatever moves on them, with nothing to load:
 * a drop that touches or overlaps another (a pulled one is a chain of copies, two merged ones touch) is drawn as
 * one drop over their joint box. The bend of the backdrop at the rim (a convex "squircle" lens as in kube.io's
 * write-up of Apple's Liquid Glass: Snell's law, glass 1.5) comes from a displacement map made for each drop once
 * it stands still.
 */

import {SUPPORTS_LIQUID_GLASS, createLiquidFilter, sdRoundRect} from '@helpers/liquidGlass';

/** room around the row for what stretches out of it (a pulled drop), in px */
const PAD = 48;
/** the refraction map is drawn at this fraction of the size: it is smooth, and the per-pixel work is quartered */
const MAP_SCALE = .5;
/**
 * The bezel is the rim (px) in which the surface curves from the edge up to the flat top; the lens is HEIGHT px high
 * at the top and rests on THICKNESS px of flat glass. Light arrives straight down on the backdrop and bends at the
 * surface by Snell's law (air 1, glass 1.5).
 */
const BEZEL = 20;
const HEIGHT = 26;
const THICKNESS = 10;
const IOR = 1.5;
/** the most drops that are apart at once: the clip, the field, the record button */
const DROPS = 3;

export type GooeyShape = {
  x: number,
  y: number,
  width: number,
  height: number,
  /** corner radius, at most half of the smaller side */
  radius: number
};

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

/** the largest shift of the backdrop in px: the `scale` of the displacement filter (stronger than the physics: it is a small lens) */
const MAX_PULL = PROFILE.max * 2.2;

/** the displacement map of a rounded rectangle (the same convention as helpers/liquidGlass.ts), as a PNG data URL */
function drawMap(width: number, height: number, radius: number) {
  const w = Math.max(1, Math.round(width * MAP_SCALE)), h = Math.max(1, Math.round(height * MAP_SCALE));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const k = 1 / MAP_SCALE;
  for(let y = 0; y < h; ++y) {
    for(let x = 0; x < w; ++x) {
      const px = (x + .5) * k, py = (y + .5) * k;
      const depth = -sdRoundRect(px, py, width, height, radius);
      let dx = 0, dy = 0;
      if(depth > 0 && depth < BEZEL) {
        const nx = sdRoundRect(px + 1, py, width, height, radius) - sdRoundRect(px - 1, py, width, height, radius);
        const ny = sdRoundRect(px, py + 1, width, height, radius) - sdRoundRect(px, py - 1, width, height, radius);
        const len = Math.hypot(nx, ny) || 1;
        const magnitude = PROFILE.pull[Math.round((1 - depth / BEZEL) * (PROFILE_SIZE - 1))];
        dx = -(nx / len) * magnitude;
        dy = -(ny / len) * magnitude;
      }

      const i = (y * w + x) * 4;
      image.data[i] = Math.round(128 + dx * 127);
      image.data[i + 1] = Math.round(128 + dy * 127);
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/** shapes that overlap (or all but touch) are one drop: their joint box, with the largest radius that fits */
function cluster(shapes: GooeyShape[]) {
  const parent = shapes.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const near = (a: GooeyShape, b: GooeyShape) => a.x <= b.x + b.width + .5 && b.x <= a.x + a.width + .5 &&
    a.y <= b.y + b.height + .5 && b.y <= a.y + a.height + .5;
  for(let i = 0; i < shapes.length; ++i) {
    for(let j = i + 1; j < shapes.length; ++j) {
      if(near(shapes[i], shapes[j])) parent[find(j)] = find(i);
    }
  }

  const groups = new Map<number, GooeyShape[]>();
  shapes.forEach((s, i) => {
    const key = find(i);
    groups.set(key, (groups.get(key) || []).concat(s));
  });

  return [...groups.values()].map((group) => {
    const x = Math.min(...group.map((s) => s.x)), y = Math.min(...group.map((s) => s.y));
    const right = Math.max(...group.map((s) => s.x + s.width)), bottom = Math.max(...group.map((s) => s.y + s.height));
    const width = right - x, height = bottom - y;
    const radius = Math.min(Math.max(...group.map((s) => s.radius)), width / 2, height / 2);
    return {x, y, width, height, radius} as GooeyShape;
  });
}

export type GooeyGlassOptions = {
  /** the box the drops live in; the layer is as big as it, and PAD more on every side */
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
  host.prepend(layer);

  // The bend of the backdrop (Chromium only; elsewhere the drop stays a blur). It is off while a drop is pulled, and
  // comes back a moment after the drops have settled: the map is made for the drop that stands still.
  const drops = Array.from({length: DROPS}, () => {
    const element = document.createElement('div');
    element.className = 'gooey-glass-drop';
    layer.append(element);
    return {element, filter: SUPPORTS_LIQUID_GLASS ? createLiquidFilter() : undefined, refracting: false, box: undefined as GooeyShape, mapped: ''};
  });

  const setRefracting = (drop: typeof drops[number], on: boolean) => {
    if(!drop.filter || on === drop.refracting) return;
    drop.refracting = on;
    const value = `${on ? `url(#${drop.filter.id}) ` : ''}blur(1.5px) var(--as-glass-after)`;
    drop.element.style.setProperty('backdrop-filter', value);
    drop.element.style.setProperty('-webkit-backdrop-filter', value);
  };

  let state: GooeyState = {...REST};
  let target: GooeyState = {...REST};
  let from: GooeyState = {...REST};
  let raf = 0, start = 0, done: () => void;
  let springRaf = 0;

  let mapTimer = 0;
  const settle = () => {
    mapTimer = 0;
    if(state.stretch) return;
    for(const drop of drops) {
      if(!drop.box) continue;
      const {width, height, radius} = drop.box;
      drop.filter?.update(width, height, drawMap(width, height, radius), MAX_PULL);
      drop.mapped = `${width}x${height}`;
      setRefracting(drop, true);
    }
  };

  const render = () => {
    const width = host.offsetWidth, height = host.offsetHeight;
    if(!width || !height) return;
    const boxes = cluster(getShapes(width, height, state));
    drops.forEach((drop, i) => {
      const box = boxes[i];
      drop.box = box;
      const style = drop.element.style;
      if(!box) {
        style.setProperty('display', 'none');
        return;
      }

      style.setProperty('display', '');
      style.setProperty('left', PAD + box.x + 'px');
      style.setProperty('top', PAD + box.y + 'px');
      style.setProperty('width', box.width + 'px');
      style.setProperty('height', box.height + 'px');
      style.setProperty('border-radius', box.radius + 'px');
      // the bend was made for the size the drop had: while it has another, the drop is a plain blur
      if(state.stretch || drop.mapped !== `${box.width}x${box.height}`) setRefracting(drop, false);
    });

    if(!state.stretch && !mapTimer) mapTimer = window.setTimeout(settle, 60);
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

  /** the finger lets go: the drop springs back and settles, the neck snapping with it */
  const release = () => {
    if(!state.stretch) return;
    cancelAnimationFrame(springRaf);
    let vx = 0, vy = 0, last = performance.now();
    // critically damped: it settles with no overshoot, so it can never swell past where it was
    const STIFFNESS = 300, DAMPING = 2 * Math.sqrt(300);
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
      drops.forEach((drop) => drop.filter?.remove());
      observer.disconnect();
      layer.remove();
    }
  };
}
