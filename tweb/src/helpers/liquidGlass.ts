/**
 * "Liquid glass": a backdrop that is not just blurred but refracted at the rim of the shape, the way a
 * thick lens bends what lies behind it. Chromium (so also Android WebView) accepts an SVG filter in
 * `backdrop-filter`; the filter here is an `feDisplacementMap` driven by a map drawn for the element's own
 * size: pixels in the bezel are pushed inward along the rim's normal, the centre is left alone. The three
 * colour channels are displaced by slightly different amounts, which gives the fringe real glass has.
 *
 * Other engines either ignore `url()` in `backdrop-filter` or render nothing, so it is applied only where
 * Chromium is detected, and the element keeps its plain blur from CSS otherwise.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

let counter = 0;
let defs: SVGDefsElement;

export function getDefs() {
  if(defs) return defs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;pointer-events:none;';
  svg.setAttribute('aria-hidden', 'true');
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

export const SUPPORTS_LIQUID_GLASS = typeof CSS !== 'undefined' &&
  CSS.supports?.('backdrop-filter', 'url(#a)') &&
  /Chrome\//.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);

/** the signed distance from (x, y) to a rounded rectangle of size w × h: negative inside */
export function sdRoundRect(x: number, y: number, w: number, h: number, r: number) {
  const qx = Math.abs(x - w / 2) - (w / 2 - r);
  const qy = Math.abs(y - h / 2) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** the displacement map as a PNG data URL, and the largest shift in it (in px) */
function drawMap(w: number, h: number, radius: number, bezel: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const data = image.data;
  for(let y = 0; y < h; ++y) {
    for(let x = 0; x < w; ++x) {
      const px = x + .5, py = y + .5;
      const depth = -sdRoundRect(px, py, w, h, radius);
      let dx = 0, dy = 0;
      if(depth > 0 && depth < bezel) {
        // the rim's outward normal
        const nx = sdRoundRect(px + 1, py, w, h, radius) - sdRoundRect(px - 1, py, w, h, radius);
        const ny = sdRoundRect(px, py + 1, w, h, radius) - sdRoundRect(px, py - 1, w, h, radius);
        const len = Math.hypot(nx, ny) || 1;
        // a convex lens: the pull is strongest at the very edge and dies out toward the middle
        const k = 1 - depth / bezel;
        const magnitude = 1 - Math.sqrt(1 - k * k * k * k);
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

function channel(matrix: string, result: string, strength: number, map: string) {
  return `
    <feDisplacementMap in="SourceGraphic" in2="${map}" scale="${strength}" xChannelSelector="R" yChannelSelector="G" result="${result}-d"/>
    <feColorMatrix in="${result}-d" type="matrix" values="${matrix}" result="${result}"/>`;
}

/** the primitives of the refraction filter: the map as an image, displaced three times (R, G, B by a hair different amounts) */
export function liquidFilterContent(w: number, h: number, map: string, strength: number) {
  // red, green and blue are refracted by a hair different amounts: the coloured fringe of real glass
  return `
      <feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
      ${channel('1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r', strength * 1.0, 'map')}
      ${channel('0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g', strength * 0.92, 'map')}
      ${channel('0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b', strength * 0.84, 'map')}
      <feBlend in="r" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="b" mode="screen"/>`;
}

/** a refraction filter of its own in the shared <defs>, for a shape that is not a rounded rectangle */
export function createLiquidFilter() {
  const id = `liquid-glass-${++counter}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  getDefs().append(filter);
  return {
    id,
    update(w: number, h: number, map: string, strength: number) {
      filter.setAttribute('x', '0');
      filter.setAttribute('y', '0');
      filter.setAttribute('width', String(w));
      filter.setAttribute('height', String(h));
      filter.innerHTML = liquidFilterContent(w, h, map, strength);
    },
    remove: () => filter.remove()
  };
}

export type LiquidGlassOptions = {
  /** corner radius in px; the default makes a pill (half the height) */
  radius?: number,
  /** how wide the refracting rim is, in px */
  bezel?: number,
  /** how far, in px, the content at the very edge is pulled */
  strength?: number,
  /** other filters applied to the backdrop after the refraction */
  after?: string
};

/**
 * Makes `element` liquid glass and keeps the filter in step with its size. Returns a function that
 * takes it all away again.
 */
export default function applyLiquidGlass(element: HTMLElement, options: LiquidGlassOptions = {}) {
  if(!SUPPORTS_LIQUID_GLASS) return () => {};

  const id = `liquid-glass-${++counter}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = id;
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  getDefs().append(filter);

  const after = options.after ?? 'blur(.6px) saturate(170%) brightness(1.06)';
  let lastKey = '';

  const update = () => {
    const w = Math.round(element.offsetWidth), h = Math.round(element.offsetHeight);
    if(!w || !h) return;
    const key = w + 'x' + h;
    if(key === lastKey) return;
    lastKey = key;

    const radius = Math.min(options.radius ?? h / 2, w / 2, h / 2);
    const bezel = Math.min(options.bezel ?? Math.min(w, h) * .4, w / 2, h / 2);
    const strength = options.strength ?? bezel * 1.3;
    const map = drawMap(w, h, radius, bezel);

    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', String(w));
    filter.setAttribute('height', String(h));
    // red, green and blue are refracted by a hair different amounts: the coloured fringe of real glass
    filter.innerHTML = liquidFilterContent(w, h, map, strength);

    const value = `url(#${id}) ${after}`;
    element.style.setProperty('backdrop-filter', value);
    element.style.setProperty('-webkit-backdrop-filter', value);
  };

  const observer = new ResizeObserver(update);
  observer.observe(element);
  update();

  return () => {
    observer.disconnect();
    filter.remove();
    element.style.removeProperty('backdrop-filter');
    element.style.removeProperty('-webkit-backdrop-filter');
  };
}
