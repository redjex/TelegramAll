/**
 * What a finger does to drops of liquid glass (helpers/gooeyGlass.ts), shared by every bar made of them:
 * - held and let lie, a drop swells where it stands;
 * - pulled, it does not swell: it is stretched by its edge (the far edge stays, the near one goes after the finger),
 *   it gives only a little of what the finger moves, runs into another drop if it reaches it, and springs back.
 */

import createGooeyGlass, {GooeyGlassOptions, GooeyShape, GooeyState} from '@helpers/gooeyGlass';

/** how much a pulled drop gets thinner (the volume stays), and for a wide one how much narrower */
export function stretchScales(state: GooeyState, height: number, wide: boolean) {
  const length = Math.hypot(state.dragX, state.dragY);
  const scale = 1 / Math.sqrt(1 + length / height * .3);
  return {scale, scaleX: wide ? Math.pow(scale, 1.1) : scale};
}

/**
 * The shapes a pulled drop is made of, in place of `home`: a round one is a bar with round ends turned towards the
 * finger; a wide one is a chain of copies from where it lies to where it is pulled (one body for the soft edges).
 */
export function pullShapes(home: GooeyShape, state: GooeyState, wide: boolean): GooeyShape[] {
  const length = Math.hypot(state.dragX, state.dragY);
  const {scale, scaleX} = stretchScales(state, home.height, wide);
  const ux = length ? state.dragX / length : 0, uy = length ? state.dragY / length : 0;
  if(!wide) {
    const thick = home.height * scale;
    const cx = home.x + home.width / 2, cy = home.y + home.height / 2;
    const far = {x: cx - ux * home.height / 2, y: cy - uy * home.height / 2};
    const near = {x: cx + state.dragX + ux * thick / 2, y: cy + state.dragY + uy * thick / 2};
    const long = Math.hypot(near.x - far.x, near.y - far.y);
    const mid = {x: (far.x + near.x) / 2, y: (far.y + near.y) / 2};
    return [{x: mid.x - long / 2, y: mid.y - thick / 2, width: long, height: thick, radius: thick / 2, angle: Math.atan2(uy, ux), source: state.stretch}];
  }

  // how far the far edge would move in, were the copies simply thinner: they are shifted back by that
  const anchor = Math.abs(ux) * home.width / 2 * (1 - scaleX) + Math.abs(uy) * home.height / 2 * (1 - scale);
  const steps = Math.max(1, Math.ceil(length / (home.height / 4)));
  const copies: GooeyShape[] = [];
  for(let i = 0; i <= steps; ++i) {
    const t = i / steps;
    copies.push({
      x: home.x + state.dragX * t + ux * anchor + home.width * (1 - scaleX) / 2,
      y: home.y + state.dragY * t + uy * anchor + home.height * (1 - scale) / 2,
      width: home.width * scaleX,
      height: home.height * scale,
      radius: home.radius * scale,
      source: state.stretch
    });
  }

  return copies;
}

export type DropGesturesOptions = {
  /** the box the drops lie in (the glass layer is made in it) */
  host: HTMLElement,
  /** where the touches are caught (the host, or something that holds it) */
  root: HTMLElement,
  /** the drops where they lie, in the host's coordinates: the first, the second ... (what `pick` numbers 1, 2 ...) */
  base: (host: HTMLElement) => GooeyShape[],
  /** which drop a touch is on: 1, 2 ..., or 0 for none */
  pick: (target: HTMLElement) => number,
  /** what lies on a drop and goes with it */
  carried: (which: number) => HTMLElement[],
  /** a wide drop is stretched as a chain of copies, a round one as a turned bar */
  wide?: (which: number) => boolean,
  /** the size of a round drop: what its thickness is measured by */
  unit: () => number,
  /** how much a drop gives to a pull: the share of the finger's way, and the most it can be stretched (px) */
  pull?: {share: number, limit: number},
  onRender?: GooeyGlassOptions['onRender']
};

const HOLD_DELAY = 110, MIN_HOLD = 140, DRAG_START = 6;

export default function createDropGestures(options: DropGesturesOptions) {
  const {host, root} = options;
  const wideOf = options.wide || (() => false);
  const {share, limit} = options.pull || {share: .05, limit: 28};

  const swells = (state: GooeyState) => [state.swellClip, state.swellField, state.swellRecord].map((value) => value * 3);

  const gooey = createGooeyGlass({
    host,
    getShapes: (width, height, state) => {
      const swell = swells(state);
      let shapes = options.base(host).map((shape, i) => ({
        ...shape,
        x: shape.x - swell[i],
        y: shape.y - swell[i],
        width: shape.width + swell[i] * 2,
        height: shape.height + swell[i] * 2,
        radius: shape.radius + swell[i],
        source: i + 1
      }));
      if(state.stretch && shapes[state.stretch - 1]) {
        const home = shapes[state.stretch - 1];
        shapes = shapes.filter((_, i) => i !== state.stretch - 1).concat(pullShapes(home, state, wideOf(state.stretch)));
      }

      return shapes;
    },
    onRender: (state) => {
      carry(state);
      options.onRender?.(state);
    }
  });

  // what lies on a pulled drop goes with it, in the middle of the body: it narrows and thins as the body does
  let carrying = 0;
  let origins: string[] = [];
  const carry = (state: GooeyState) => {
    if(carrying && carrying !== state.stretch) options.carried(carrying).forEach((el) => el.style.removeProperty('transform'));
    if(state.stretch && carrying !== state.stretch) {
      const home = options.base(host)[state.stretch - 1];
      const box = host.getBoundingClientRect();
      const center = {x: box.left + home.x + home.width / 2, y: box.top + home.y + home.height / 2};
      origins = options.carried(state.stretch).map((el) => {
        const rect = el.getBoundingClientRect();
        return `${center.x - rect.left}px ${center.y - rect.top}px`;
      });
    }

    carrying = state.stretch;
    if(!carrying) return;
    const {scale, scaleX} = stretchScales(state, options.unit(), wideOf(carrying));
    const value = `translate(${state.dragX / 2}px, ${state.dragY / 2}px) scale(${scaleX}, ${scale})`;
    options.carried(carrying).forEach((el, i) => {
      el.style.setProperty('transform-origin', origins[i]);
      el.style.setProperty('transform', value);
    });
  };

  let held = false, dragged = false, pulling = 0;
  let origin = {x: 0, y: 0};
  let pressedAt = 0;
  let release = 0, holdTimer = 0;
  let hold: (() => void) | undefined;

  const playHold = () => {
    clearTimeout(holdTimer);
    holdTimer = 0;
    hold?.();
    hold = undefined;
  };

  const swellKey = (which: number) => (['swellClip', 'swellField', 'swellRecord'] as const)[which - 1];

  const onDown = (e: PointerEvent) => {
    const which = options.pick(e.target as HTMLElement);
    if(!which) return;
    pulling = which;
    hold = () => gooey.setState({[swellKey(which)]: 1});
    held = true;
    dragged = false;
    origin = {x: e.clientX, y: e.clientY};
    pressedAt = performance.now();
    clearTimeout(release);
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(playHold, HOLD_DELAY);
  };

  const onUp = () => {
    if(!held) return;
    // a tap shorter than the delay still plays the press
    if(hold) {
      playHold();
      pressedAt = performance.now();
    }

    clearTimeout(release);
    gooey.release();
    release = window.setTimeout(() => {
      held = false;
      gooey.setState({});
    }, Math.max(0, MIN_HOLD - (performance.now() - pressedAt)));
  };

  const onMove = (e: PointerEvent) => {
    if(!held || !pulling) return;
    // the button was let go outside the page, where no pointerup comes
    if(e.pointerType === 'mouse' && !e.buttons) {
      onUp();
      return;
    }

    const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const distance = Math.hypot(dx, dy);
    if(!dragged && distance < DRAG_START) return;
    if(!dragged) {
      clearTimeout(holdTimer);
      hold = undefined;
      gooey.rest();
    }

    dragged = true;
    // it takes effort: the drop gives a part of what the finger moves, and the further it goes the harder it gets
    const stretched = limit * Math.tanh(distance * share / limit);
    gooey.drag(pulling, dx / distance * stretched, dy / distance * stretched);
  };

  // a pull that ended on a button is not a press of it
  const onClick = (e: Event) => {
    if(dragged) {
      e.stopPropagation();
      e.preventDefault();
      dragged = false;
    }
  };

  const doc = root.ownerDocument;
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('click', onClick, true);
  doc.addEventListener('pointermove', onMove);
  doc.addEventListener('pointerup', onUp);
  doc.addEventListener('pointercancel', onUp);

  return {
    gooey,
    update: gooey.update,
    destroy() {
      clearTimeout(release);
      clearTimeout(holdTimer);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('click', onClick, true);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onUp);
      gooey.destroy();
    }
  };
}
