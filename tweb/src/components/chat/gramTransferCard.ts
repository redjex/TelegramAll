import {formatNanoton, GRAM_CURRENCY_SYMBOL} from '@helpers/paymentsWrapCurrencyAmount';
import {i18n} from '@lib/langPack';
import {createGramLottie, createWalletCardShell} from '@components/popups/walletCard';

function groupAddress(address: string) {
  const groups = address.match(/.{1,4}/g) || [];
  const lines: string[] = [];
  for(let i = 0; i < groups.length; i += 6) {
    lines.push(groups.slice(i, i + 6).join(' '));
  }
  return lines;
}

/** A Gram transfer in a chat, dressed like the wallet card (see `walletCard.ts`). Sizes follow the chat's text size. */
export default function wrapGramTransferCard(options: {
  amount: number | string,
  address: string,
  comment?: string,
  outgoing: boolean,
  failed?: boolean,
  title?: string
}) {
  const {amount, address, comment, outgoing, title} = options;
  const {wrap, card} = createWalletCardShell();
  wrap.style.cssText = 'font-size:var(--messages-text-size,16px);width:19em;max-width:100%;margin:.5em auto';
  card.style.aspectRatio = 'auto';
  card.style.cursor = 'default';

  const ribbon = document.createElement('div');
  ribbon.style.cssText = 'position:absolute;top:1.75em;right:-2.55em;width:9.5em;transform:rotate(45deg);padding:.2em 0;font-size:.8em;z-index:4;text-align:center;color:#fff;user-select:none;' +
    `background:${outgoing ? '#4ab44a' : '#5ec2ff'}`;
  ribbon.append(i18n(outgoing ? 'GramTransferSent' : 'GramTransferReceived'));

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;z-index:2;padding:1.5em 1.2em 1.4em;text-align:center';

  const {el: icon} = createGramLottie(4.8, 'em');
  icon.style.marginBottom = '.1em';

  const [whole, fraction = ''] = formatNanoton(amount, 9, false).split('.');
  const amountEl = document.createElement('div');
  amountEl.style.cssText = 'font-size:1.75em;font-weight:600;line-height:1.15;letter-spacing:-.01em;font-variant-numeric:tabular-nums';
  amountEl.append((outgoing ? '−' : '+') + whole);
  if(fraction) {
    const fr = document.createElement('span');
    fr.textContent = '.' + fraction;
    fr.style.fontSize = '.82em';
    amountEl.append(fr);
  }
  const sym = document.createElement('span');
  sym.textContent = ' ' + GRAM_CURRENCY_SYMBOL;
  sym.style.cssText = 'color:#6ddcff;margin-left:.1em';
  amountEl.append(sym);

  const addr = document.createElement('div');
  addr.style.cssText = "margin-top:.5em;user-select:text;font:400 .8em/1.4 'SF Mono',ui-monospace,Menlo,'Roboto Mono','Cascadia Mono',Consolas,monospace;color:#005dda;text-shadow:0 1px 0 rgba(255,255,255,.12)";
  groupAddress(address).forEach((line, i) => {
    if(i) addr.append(document.createElement('br'));
    addr.append(line);
  });

  inner.append(icon, amountEl);
  if(title) {
    const nameEl = document.createElement('div');
    nameEl.textContent = title;
    nameEl.style.cssText = 'margin-top:.55em;font-size:.85em;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6ddcff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    inner.append(nameEl);
  }
  inner.append(addr);

  if(comment) {
    const c = document.createElement('div');
    c.style.cssText = 'margin-top:.7em;font-size:.9em;padding-top:.6em;border-top:1px solid rgba(255,255,255,.25);word-break:break-word;user-select:text';
    c.textContent = comment;
    inner.append(c);
  }

  card.append(ribbon, inner);
  return wrap;
}
