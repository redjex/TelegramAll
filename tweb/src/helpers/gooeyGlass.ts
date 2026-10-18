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
  radius: number,
  /** for a joint box: the shapes that run together in it (they are drawn as one drop with soft edges) */
  members?: GooeyShape[],
  /** a drop pulled by a finger is a rounded bar turned by this angle (rad) about its middle */
  angle?: number,
  /** which drop the shape belongs to: the copies of one pulled drop are one source, and need no soft edges among them */
  source?: number
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
  dragY: number,
  /** 0 … 1: text is being typed, the record button is gone and the field has taken its place (its own tween) */
  typing: number
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
function drawMap(width: number, height: number, radius: number, bezel: number) {
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
      if(depth > 0 && depth < bezel) {
        const nx = sdRoundRect(px + 1, py, width, height, radius) - sdRoundRect(px - 1, py, width, height, radius);
        const ny = sdRoundRect(px, py + 1, width, height, radius) - sdRoundRect(px, py - 1, width, height, radius);
        const len = Math.hypot(nx, ny) || 1;
        const magnitude = PROFILE.pull[Math.round((1 - depth / bezel) * (PROFILE_SIZE - 1))];
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
/** the box a shape fills (a turned bar fills the box that holds it) */
function bounds(s: GooeyShape) {
  if(!s.angle) return s;
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  const hw = (Math.abs(Math.cos(s.angle)) * s.width + Math.abs(Math.sin(s.angle)) * s.height) / 2;
  const hh = (Math.abs(Math.sin(s.angle)) * s.width + Math.abs(Math.cos(s.angle)) * s.height) / 2;
  return {x: cx - hw, y: cy - hh, width: hw * 2, height: hh * 2, radius: s.radius};
}

function cluster(shapes: GooeyShape[]) {
  const parent = shapes.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const near = (p: GooeyShape, q: GooeyShape) => {
    const a = bounds(p), b = bounds(q);
    return a.x <= b.x + b.width + .5 && b.x <= a.x + a.width + .5 && a.y <= b.y + b.height + .5 && b.y <= a.y + a.height + .5;
  };
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
    // one turned bar is a drop of its own: it is drawn turned, in its own box
    if(group.length === 1 && group[0].angle) return {...group[0], members: group} as GooeyShape;
    const rects = group.map(bounds);
    const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
    const right = Math.max(...rects.map((r) => r.x + r.width)), bottom = Math.max(...rects.map((r) => r.y + r.height));
    const width = right - x, height = bottom - y;
    const radius = Math.min(Math.max(...group.map((s) => s.radius)), width / 2, height / 2);
    return {x, y, width, height, radius, members: group} as GooeyShape;
  });
}

/** room around a joint box for the soft edges of the merged drops, in px */
const SOFT = 6;

/**
 * The mask of drops that have run together: their shapes blurred and cut hard on the alpha channel (the "gooey" /
 * metaball trick), so that where they touch the edges flow into one another like two drops of liquid. It is made
 * only for the moment they are joined, and the drop is a plain blur meanwhile.
 */
function softMask(box: GooeyShape, grow = 0) {
  const w = box.width + SOFT * 2, h = box.height + SOFT * 2;
  const body = box.members.map((m) => {
    const r = Math.max(0, Math.min(m.radius + grow, (m.width + grow * 2) / 2, (m.height + grow * 2) / 2));
    const turn = m.angle ? ` transform="rotate(${m.angle * 180 / Math.PI} ${m.x - box.x + SOFT + m.width / 2} ${m.y - box.y + SOFT + m.height / 2})"` : '';
    return `<rect x="${m.x - box.x + SOFT - grow}" y="${m.y - box.y + SOFT - grow}" width="${m.width + grow * 2}" height="${m.height + grow * 2}" rx="${r}"${turn}/>`;
  }).join('');
  // the soft edges (the filter) are only for different drops that run into one another; the copies of one drop overlap
  // into a smooth body by themselves, and are cheap to draw
  const soft = new Set(box.members.map((m) => m.source)).size > 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (soft ? `<filter id="g" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
      '<feGaussianBlur stdDeviation="3"/>' +
      '<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/>' +
      `</filter><g filter="url(#g)" fill="#000">${body}</g>` : `<g fill="#000">${body}</g>`) + '</svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
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

const REST: GooeyState = {left: 0, right: 0, swellClip: 0, swellField: 0, swellRecord: 0, stretch: 0, dragX: 0, dragY: 0, typing: 0};
/** what the tween leaves alone: the drag has a spring of its own */
const NOT_TWEENED = new Set<keyof GooeyState>(['stretch', 'dragX', 'dragY', 'typing']);

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
    // the rim of drops that have run together: a ring along the outer edge only, not the contour of each shape
    const rim = document.createElement('div');
    rim.className = 'gooey-glass-rim';
    // The glow (dark theme): the colour of what lies under the drop, run along its edge. It is a strongly blurred, saturated
    // backdrop of its own under the drop, shown at the edge only, so it is the real picture under the drop, frame by frame.
    const glow = document.createElement('div');
    glow.className = 'gooey-glass-glow';
    layer.append(glow, element, rim);
    return {element, rim, glow, filter: SUPPORTS_LIQUID_GLASS ? createLiquidFilter() : undefined, refracting: false, box: undefined as GooeyShape, mapped: ''};
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
      // the rim is a third of the smaller side at most, so a small drop keeps a flat middle; the pull goes with it
      const bezel = Math.max(6, Math.min(BEZEL, Math.min(width, height) * .3));
      drop.filter?.update(width, height, drawMap(width, height, radius, bezel), MAX_PULL * bezel / BEZEL);
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
        drop.rim.style.setProperty('display', 'none');
        drop.glow.style.setProperty('display', 'none');
        return;
      }

      style.setProperty('display', '');
      const joined = box.members.length > 1;
      // drops that have run together are one drop with soft edges: the box grows a little for them, and a mask cuts it
      const grow = joined ? SOFT : 0;
      const place = (el: HTMLElement) => {
        el.style.setProperty('left', PAD + box.x - grow + 'px');
        el.style.setProperty('top', PAD + box.y - grow + 'px');
        el.style.setProperty('width', box.width + grow * 2 + 'px');
        el.style.setProperty('height', box.height + grow * 2 + 'px');
      };
      place(drop.element);
      place(drop.glow);
      drop.glow.style.setProperty('display', '');
      const masks = (el: HTMLElement, value: string) => {
        el.style.setProperty('mask-image', value);
        el.style.setProperty('-webkit-mask-image', value);
        el.style.setProperty('mask-size', '100% 100%');
        el.style.setProperty('-webkit-mask-size', '100% 100%');
      };
      if(joined) {
        style.removeProperty('transform');
        const exact = softMask(box);
        style.setProperty('border-radius', '0');
        style.setProperty('box-shadow', 'none');
        masks(drop.element, exact);
        drop.glow.style.setProperty('border-radius', '0');
        drop.glow.style.setProperty('transform', 'none');
        // the edge of the body, cut to its shape
        const edge = 'radial-gradient(ellipse 50% 50% at 50% 50%, transparent 30%, #000 100%)';
        masks(drop.glow, `${exact}, ${edge}`);
        drop.glow.style.setProperty('mask-composite', 'intersect');
        drop.glow.style.setProperty('-webkit-mask-composite', 'source-in');
        // the ring: the shapes a little grown, with the shapes themselves cut out of them
        place(drop.rim);
        drop.rim.style.setProperty('display', '');
        masks(drop.rim, `${softMask(box, 1.2)}, ${exact}`);
        drop.mapped = '';
      } else {
        if(box.angle) style.setProperty('transform', `rotate(${box.angle}rad)`);
        else style.removeProperty('transform');
        style.setProperty('border-radius', box.radius + 'px');
        style.removeProperty('box-shadow');
        style.removeProperty('mask-image');
        style.removeProperty('-webkit-mask-image');
        drop.rim.style.setProperty('display', 'none');
        drop.glow.style.setProperty('border-radius', box.radius + 'px');
        if(box.angle) drop.glow.style.setProperty('transform', `rotate(${box.angle}rad)`);
        else drop.glow.style.removeProperty('transform');
        for(const prop of ['mask-image', '-webkit-mask-image', 'mask-composite', '-webkit-mask-composite']) drop.glow.style.removeProperty(prop);
      }

      // the bend was made for the size the drop had: while it has another (or it is joined), the drop is a plain blur
      if(state.stretch || joined || drop.mapped !== `${box.width}x${box.height}`) setRefracting(drop, false);
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

  /** text is being typed (or not any more): the record drop goes, the field stretches over its place, and back */
  let typingRaf = 0;
  const setTyping = (on: boolean) => {
    cancelAnimationFrame(typingRaf);
    const fromValue = state.typing, toValue = on ? 1 : 0, startedAt = performance.now();
    if(fromValue === toValue) return;
    const tick = (now: number) => {
      const k = Math.min(1, (now - startedAt) / 220);
      state.typing = fromValue + (toValue - fromValue) * (1 - Math.pow(1 - k, 3));
      render();
      typingRaf = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    typingRaf = requestAnimationFrame(tick);
  };

  /** every press and merge is gone at once (a pull has begun: the drops must not run together on the way) */
  const rest = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    done = undefined;
    for(const key in state) {
      if(!NOT_TWEENED.has(key as keyof GooeyState)) state[key as keyof GooeyState] = 0;
    }

    render();
  };

  const observer = new ResizeObserver(render);
  observer.observe(host);
  render();

  return {
    layer,
    setState,
    drag,
    release,
    setTyping,
    rest,
    /** the drops run to `values` and part again */
    pulse: (values: Partial<GooeyState>) => setState(values, () => setState({})),
    update: render,
    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(springRaf);
      cancelAnimationFrame(typingRaf);
      clearTimeout(mapTimer);
      drops.forEach((drop) => drop.filter?.remove());
      observer.disconnect();
      layer.remove();
    }
  };
}
