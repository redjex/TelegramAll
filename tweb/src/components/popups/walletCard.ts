import lottieLoader from '@lib/lottie/lottieLoader';

// A copy of the wallet card from the Gram explorer (gram.org), laid out on its own 370 x 220 grid:
// every size is a multiple of --u, one unit being 1/370 of the card's width.

const STYLE_ID = 'gram-wallet-card-style';
const STAR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4.05 -4.05 8.1 8.1'%3E%3Cpath fill='%23fff' d='M0-4.05.86-.86 4.05 0 .86.86 0 4.05-.86.86-4.05 0-.86-.86Z'/%3E%3C/svg%3E")`;
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.55 .9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const CSS = `
.gwc {
  --u: calc(100cqw / 370); --tx: 0; --ty: 0;
  position: relative; display: block; width: 100%; aspect-ratio: 370 / 220; overflow: hidden; isolation: isolate;
  border-radius: calc(21 * var(--u)); background: #0088ff; color: #fff; line-height: 1; user-select: none;
  font-family: ui-rounded, 'SF Pro Rounded', -apple-system, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 calc(10 * var(--u)) calc(26 * var(--u)) calc(-14 * var(--u)) #0060e699;
  transform: perspective(800px) rotateX(calc(var(--ty) * -6.5deg)) rotateY(calc(var(--tx) * 6.5deg));
  transition: transform .2s ease-out, box-shadow .25s;
}
.gwc-wrap { container-type: inline-size; width: 100%; }
.gwc * { box-sizing: border-box; }
.gwc::after {
  content: ''; position: absolute; inset: 0; z-index: 3; border-radius: inherit; pointer-events: none;
  box-shadow: inset calc(.5 * var(--u)) calc(.85 * var(--u)) calc(1 * var(--u)) #00000029, inset 0 1px #78d6ff59, inset 1px 0 #78d6ff2e;
}
.gwc .shine {
  position: absolute; top: 50%; left: 50%; z-index: -1; width: calc(440 * var(--u)); height: calc(440 * var(--u));
  margin: calc(-220 * var(--u)) 0 0 calc(-220 * var(--u)); opacity: .8; pointer-events: none;
  background: conic-gradient(#00a8ff, rgba(0,168,255,0) 40deg, rgba(0,168,255,0) 140deg, #00a8ff 180deg, rgba(0,168,255,0) 220deg, rgba(0,168,255,0) 320deg, #00a8ff 360deg);
  transform: scaleY(1.65) rotate(calc(-58deg + var(--tx) * 60deg));
  mask-image: radial-gradient(circle closest-side, rgba(0,0,0,.2), #000 34%);
  -webkit-mask-image: radial-gradient(circle closest-side, rgba(0,0,0,.2), #000 34%);
}
.gwc .stars {
  position: absolute; inset: 0; z-index: -1; pointer-events: none;
  mask-image: conic-gradient(from calc(-58deg + var(--tx) * 60deg), #000 0deg, transparent 58deg 122deg, #000 180deg, transparent 238deg 302deg, #000 360deg);
  -webkit-mask-image: conic-gradient(from calc(-58deg + var(--tx) * 60deg), #000 0deg, transparent 58deg 122deg, #000 180deg, transparent 238deg 302deg, #000 360deg);
}
.gwc .stars i {
  position: absolute; width: calc(8.1 * var(--u)); height: calc(8.1 * var(--u)); margin: calc(-4.05 * var(--u)) 0 0 calc(-4.05 * var(--u));
  background: ${STAR} center / contain no-repeat; opacity: .5; animation: gwc-twinkle 3s ease-in-out infinite alternate;
}
.gwc .grain { position: absolute; inset: 0; z-index: -1; pointer-events: none; mix-blend-mode: overlay; opacity: .09; background: ${GRAIN}; }
.gwc .sweep {
  position: absolute; inset: 0; z-index: 1; pointer-events: none; transform: translateX(-110%);
  background: linear-gradient(105deg, transparent 30%, rgba(160,230,255,.32) 50%, transparent 70%);
  animation: gwc-sweep 7s ease-in-out infinite;
}
.gwc .layer { translate: calc(var(--tx) * var(--p, 3) * 1px) calc(var(--ty) * var(--p, 3) * 1px); }
.gwc .balance { --p: 4; position: absolute; top: calc(76 * var(--u)); left: calc(19 * var(--u)); width: calc(244 * var(--u)); height: calc(30 * var(--u)); display: flex; align-items: center; gap: calc(3.25 * var(--u)); }
.gwc .gem { display: grid; flex: 0 0 auto; place-items: center; width: calc(30 * var(--u)); height: calc(30 * var(--u)); position: relative; filter: drop-shadow(0 calc(1 * var(--u)) calc(2 * var(--u)) rgba(0,60,160,.35)); }
.gwc .gem > div { position: relative; width: 100%; height: 100%; margin: 0 !important; }
.gwc .figure { display: flex; flex: 1 1 auto; align-items: baseline; min-width: 0; overflow: hidden; font-size: calc(22 * var(--u)); font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.01em; white-space: nowrap; }
.gwc .frac { margin-left: .045em; font-size: .818em; }
.gwc .ticker { margin-left: .22em; color: #6ddcff; }
.gwc .fiat { --p: 3.5; position: absolute; top: calc(114 * var(--u)); left: calc(24 * var(--u)); color: #6ddcff; font-size: calc(14 * var(--u)); font-weight: 600; font-variant-numeric: tabular-nums; }
.gwc .name { --p: 3; position: absolute; bottom: calc(19 * var(--u)); left: calc(24 * var(--u)); max-width: calc(100% - 96 * var(--u)); overflow: hidden; font: 600 calc(14 * var(--u)) / 1.2 'SF Mono', ui-monospace, Menlo, 'Roboto Mono', 'Cascadia Mono', Consolas, monospace; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.gwc .chip {
  position: absolute; top: calc(82 * var(--u)); left: calc(273 * var(--u)); z-index: 2; display: block; width: calc(50 * var(--u)); height: calc(38 * var(--u));
  overflow: hidden; padding: 0; border: 0; border-radius: calc(9 * var(--u)); cursor: pointer;
  background: linear-gradient(172deg, #f4f9ff 27%, #a8c7ed 97%);
  box-shadow: inset 0 0 0 calc(1 * var(--u)) #0c73d5, inset 0 calc(1.5 * var(--u)) calc(4 * var(--u)) #ffffffd9, 0 0 0 calc(1.2 * var(--u)) #0000001a, 0 calc(2 * var(--u)) calc(6 * var(--u)) #00328c40;
  transition: transform .15s;
}
.gwc .chip:active { transform: scale(.94); }
.gwc .chip::before {
  content: ''; position: absolute; inset: -40% -60%;
  background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.5) 47%, rgba(255,255,255,.85) 50%, rgba(255,255,255,.4) 53%, transparent 62%);
  animation: gwc-glint 7s ease-in-out infinite alternate;
}
.gwc .chip svg { position: relative; display: block; width: 100%; height: 100%; }
.gwc .addr {
  --p: 2; position: absolute; top: 50%; right: calc(8.7 * var(--u)); margin-top: calc(-100 * var(--u)); inline-size: calc(200 * var(--u));
  color: #005dda; text-align: center; font: 400 calc(11 * var(--u)) / 1.02 'SF Mono', ui-monospace, Menlo, 'Roboto Mono', 'Cascadia Mono', Consolas, monospace;
  letter-spacing: 0; text-shadow: rgba(255,255,255,.12) 0 1px 0; white-space: pre; writing-mode: vertical-rl;
}
.gwc .addr > span { display: block; }
@keyframes gwc-twinkle { 0% { opacity: .18; transform: scale(.85); } 100% { opacity: .62; transform: scale(1.08); } }
@keyframes gwc-glint { 0% { transform: translateX(-28%); } 100% { transform: translateX(28%); } }
@keyframes gwc-sweep { 0%, 55% { transform: translateX(-110%); } 100% { transform: translateX(110%); } }
@media (prefers-reduced-motion: reduce) { .gwc .stars i, .gwc .chip::before, .gwc .sweep { animation: none; } }
`;

const QR_RECTS = (fill: string, stroke: string, offsetY = 0) => `
<g fill="${fill}" stroke="${stroke}"${offsetY ? ` transform="translate(0 ${offsetY})"` : ''}>
<rect x="16.44" y="10.44" width="6.87" height="6.87" rx="1.75" fill="none" stroke-width="1.375"/>
<rect x="26.69" y="10.44" width="6.87" height="6.87" rx="1.75" fill="none" stroke-width="1.375"/>
<rect x="16.44" y="20.69" width="6.87" height="6.87" rx="1.75" fill="none" stroke-width="1.375"/>
<rect x="26.5" y="21" width="2.12" height="2.1" rx=".45" stroke="none"/>
<rect x="31.62" y="21" width="2.12" height="2.1" rx=".45" stroke="none"/>
<rect x="29.1" y="23.3" width="2.12" height="2.1" rx=".45" stroke="none"/>
<rect x="26.5" y="26.15" width="2.12" height="2.1" rx=".45" stroke="none"/>
<rect x="31.62" y="26.15" width="2.12" height="2.1" rx=".45" stroke="none"/>
</g>`;

function ensureStyle() {
  if(document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

function div(className: string, parent?: HTMLElement) {
  const el = document.createElement('div');
  el.className = className;
  parent?.append(el);
  return el;
}

export type WalletCardData = {
  whole: string,
  frac: string,
  ticker: string,
  fiat?: string,
  name: string,
  address?: string
};

/** The official animated diamond (gram_white.tgs), looping on its own. A size in `em` is rendered at 32 px per unit for sharpness. */
export function createGramLottie(size: number, unit?: 'em') {
  const el = document.createElement('div');
  el.style.cssText = unit ?
    `position:relative;width:${size}em;height:${size}em;flex:none;margin:0 auto` :
    `position:relative;width:${size}px;height:${size}px;flex:none;margin:0 auto`;
  lottieLoader.loadAnimationFromURL({
    container: el,
    loop: true,
    autoplay: true,
    width: unit ? Math.round(size * 32) : size,
    height: unit ? Math.round(size * 32) : size,
    group: 'none'
  }, 'assets/gram/gram_white.tgs').catch((): undefined => undefined);
  return {el};
}

/** The blue card itself: shine, stars, grain, sweep, tilt and pointer tracking, with nothing on it yet. */
export function createWalletCardShell() {
  ensureStyle();
  const wrap = div('gwc-wrap');
  const card = div('gwc', wrap);
  div('shine', card);
  const stars = div('stars', card);
  for(let i = 0; i < 18; ++i) {
    const star = document.createElement('i');
    star.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;animation-duration:${(2 + Math.random() * 1.4).toFixed(2)}s;animation-delay:-${(Math.random() * 2).toFixed(2)}s`;
    stars.append(star);
  }
  div('grain', card);
  div('sweep', card);

  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = Math.min(1, Math.max(-1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.min(1, Math.max(-1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
    card.style.setProperty('--tx', x.toFixed(3));
    card.style.setProperty('--ty', y.toFixed(3));
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--tx', '0');
    card.style.setProperty('--ty', '0');
  });

  return {wrap, card};
}

export default function createWalletCard(options: {onChipClick?: () => void, chipTitle?: string} = {}) {
  const {wrap, card} = createWalletCardShell();

  const balance = div('balance layer', card);
  const gem = div('gem', balance);
  gem.append(createGramLottie(2, 'em').el);
  const figure = div('figure', balance);
  const whole = document.createElement('span');
  const frac = document.createElement('span');
  frac.className = 'frac';
  const ticker = document.createElement('span');
  ticker.className = 'ticker';
  figure.append(whole, frac, ticker);

  const fiat = div('fiat layer', card);
  const name = div('name layer', card);

  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.type = 'button';
  chip.title = options.chipTitle || '';
  chip.innerHTML = `<svg viewBox="0 0 50 38" aria-hidden="true">${QR_RECTS('#e6edf5', '#e6edf5', 1)}${QR_RECTS('#757c83', '#757c83')}</svg>`;
  options.onChipClick && chip.addEventListener('click', options.onChipClick);
  card.append(chip);

  const addr = div('addr layer', card);

  const update = (data: WalletCardData) => {
    whole.textContent = data.whole;
    frac.textContent = data.frac;
    ticker.textContent = data.ticker;
    fiat.textContent = data.fiat || '';
    name.textContent = data.name;
    chip.style.display = data.address ? '' : 'none';
    addr.replaceChildren();
    if(data.address) {
      const groups = data.address.match(/.{1,4}/g) || [];
      for(let i = 0; i < groups.length; i += 6) {
        const line = document.createElement('span');
        line.textContent = groups.slice(i, i + 6).join(' ');
        addr.append(line);
      }
    }
  };

  return {el: wrap, update};
}
