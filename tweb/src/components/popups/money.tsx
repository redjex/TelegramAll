import PopupElement, {createPopup, usePopupContext} from '@components/popups/indexTsx';
import rootScope from '@lib/rootScope';
import {createEffect, createSignal, For, Show, onMount} from 'solid-js';
import {formatNanoton, GRAM_CURRENCY_SYMBOL} from '@helpers/paymentsWrapCurrencyAmount';
import type {WalletState, WalletTransaction} from '@layer';
import {i18n, LangPackKey, I18n} from '@lib/langPack';
import createWalletCard from '@components/popups/walletCard';
import {AvatarNewTsx} from '@components/avatarNew';
import {PeerTitleTsx} from '@components/peerTitleTsx';

const BLUE = '#2a9bff';

function decimalSeparator() {
  try {
    return new Intl.NumberFormat(I18n.getLastRequestedLangCode() || undefined).formatToParts(1.1).find((part) => part.type === 'decimal')?.value || '.';
  } catch{
    return '.';
  }
}

function shortAddress(address: string) {
  return address.length > 14 ? address.slice(0, 6) + '…' + address.slice(-6) : address;
}

function userPeerId(tx: WalletTransaction) {
  return String((tx.peer as any).user_id).toPeerId(false);
}

function peerLabel(tx: WalletTransaction) {
  const peer = tx.peer;
  switch(peer._) {
    case 'walletTransactionPeerUser': return shortAddress(peer.address);
    case 'walletTransactionPeerAddress': return peer.domain || shortAddress(peer.address);
    case 'walletTransactionPeerOnramp': return peer.provider_name;
    default: return '—';
  }
}

const GramIcon = (props: {size: number, white?: boolean}) => (
  <img src={props.white ? 'assets/gram/gram_white.png' : 'assets/gram/gram.png'} width={props.size} height={props.size} style="flex:none;object-fit:contain" draggable={false} />
);

const FEATURES: {title: LangPackKey, text: LangPackKey, icon: any}[] = [
  {
    title: 'Money.Feature1Title',
    text: 'Money.Feature1Text',
    icon: <path d="M13 2 L5 13 h6 l-1 9 8-12 h-6 z" />
  },
  {
    title: 'Money.Feature2Title',
    text: 'Money.Feature2Text',
    icon: <><circle cx="8" cy="8" r="2.2" /><circle cx="16" cy="16" r="2.2" /><path d="M17 6 L7 18" /></>
  },
  {
    title: 'Money.Feature3Title',
    text: 'Money.Feature3Text',
    icon: <><path d="M12 3 L19 6 V12 c0 4-3 7-7 9 c-4-2-7-5-7-9 V6 z" /><path d="M8.5 12 L11 14.5 L15.5 9.5" /></>
  }
];

function termsLink() {
  const a = document.createElement('a');
  a.href = 'https://telegram.org/tos';
  a.target = '_blank';
  a.style.color = 'var(--link-color)';
  a.append(i18n('Money.TermsLink'));
  return a;
}

function MoneyContent() {
  const popup = usePopupContext();
  const [state, setState] = createSignal<WalletState>();
  const [txs, setTxs] = createSignal<WalletTransaction[]>([]);
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);
  const [txLoading, setTxLoading] = createSignal(true);
  const [handle, setHandle] = createSignal('');
  const [hint, setHint] = createSignal('');
  const CACHE_KEY = 'money-cache-' + rootScope.myId;
  const s = () => state() as WalletState.walletState;
  const [rate, setRate] = createSignal(0);
  const balanceParts = () => {
    const sep = decimalSeparator();
    const [whole, frac] = (state()?._ === 'walletState' ? formatNanoton(s().balance, 9) : '0').split('.');
    return {whole, frac: frac ? sep + frac : ''};
  };
  const fiat = () => {
    if(!rate() || state()?._ !== 'walletState') return '';
    const usd = Number(String(s().balance)) / 1e9 * rate();
    return usd.toFixed(4).replace('.', decimalSeparator()) + ' $';
  };

  const flash = (text: string) => {
    setHint(text);
    setTimeout(() => setHint(''), 2200);
  };
  const copy = () => {
    try {
      navigator.clipboard.writeText(s().address);
      flash(I18n.format('Money.AddressCopied', true));
    } catch{}
  };

  onMount(async() => {
    rootScope.managers.apiManager.getAppConfig().then((config: any) => setRate(+config?.ton_usd_rate || 0)).catch(() => {});
    rootScope.managers.appUsersManager.getSelf().then((u: any) => {
      const name = u?.username || u?.usernames?.[0]?.username;
      setHandle(name ? '@' + name : (u?.first_name || ''));
    }).catch(() => {});

    // wallet.getTransactions is slow server-side (queries the blockchain, 8-20s), so show the last known data right away
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if(cached?.state) {
        setState(cached.state);
        setTxs(cached.txs || []);
        setLoading(false);
      }
    } catch{}

    const api = rootScope.managers.apiManager;
    const save = () => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({state: state(), txs: txs()}));
      } catch{}
    };
    try {
      const st = await api.invokeApi('wallet.getState') as WalletState;
      setState(st);
      setLoading(false);
      save();
      if(st._ === 'walletState') {
        const r = await api.invokeApi('wallet.getTransactions', {offset: '', limit: 30}) as any;
        try {
          await rootScope.managers.appUsersManager.saveApiUsers(r.users || []);
        } catch{}
        setTxs(r.transactions || []);
        save();
      }
    } catch(err) {
      if(!state()) setError((err as any)?.type || 'Error');
    }
    setLoading(false);
    setTxLoading(false);
  });

  const roundBtn = 'width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:var(--surface-color);color:var(--primary-text-color);box-shadow:0 1px 4px rgba(0,0,0,.18);flex:none';
  const actionBtn = `flex:1;height:48px;border:0;border-radius:24px;font-size:16px;font-weight:600;color:#fff;background:${BLUE};opacity:.55;cursor:default`;

  return (
    <div style="padding:14px 16px 18px;color:var(--primary-text-color)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <button style={roundBtn} onClick={() => popup.hide()} aria-label={I18n.format('Money.Close', true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 2 L12 12 M12 2 L2 12" /></svg>
        </button>
        <div style="font-size:17px;font-weight:600">{i18n('Money.Wallet')}</div>
        <div style="width:34px" />
      </div>

      {(() => {
        const walletCard = createWalletCard({onChipClick: copy, chipTitle: I18n.format('Money.CopyAddress', true)});
        createEffect(() => walletCard.update({
          whole: balanceParts().whole,
          frac: balanceParts().frac,
          ticker: GRAM_CURRENCY_SYMBOL,
          fiat: fiat(),
          name: handle() || I18n.format('Money.CardName', true),
          address: state()?._ === 'walletState' ? s().address : undefined
        }));
        return walletCard.el;
      })()}

      <div style="display:flex;gap:12px;margin:14px 0 4px">
        <button style={actionBtn} title={I18n.format('Money.OnlyOfficial', true)} onClick={() => flash(I18n.format('Money.OnlyOfficial', true))}>{i18n('Money.AddFunds')}</button>
        <button style={actionBtn} title={I18n.format('Money.OnlyOfficial', true)} onClick={() => flash(I18n.format('Money.OnlyOfficial', true))}>{i18n('Money.Send')}</button>
      </div>
      <div style="text-align:center;font-size:12.5px;min-height:18px;color:var(--secondary-text-color)">
        {hint() || (loading() ? i18n('Money.Setup') : state()?._ === 'walletStateEmpty' ? i18n('Money.CreateInOfficial') : error() || '')}
      </div>

      <Show when={state()?._ === 'walletState' && (txs().length || txLoading())} fallback={
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:18px">
          <For each={FEATURES}>{(f) => (
            <div style="display:flex;gap:14px;align-items:flex-start;padding:0 6px">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={BLUE} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" style="flex:none;margin-top:2px">{f.icon}</svg>
              <div>
                <div style="font-size:16px;font-weight:600">{i18n(f.title)}</div>
                <div style="font-size:14.5px;color:var(--secondary-text-color);margin-top:2px">{i18n(f.text)}</div>
              </div>
            </div>
          )}</For>
        </div>
      }>
        <div style="margin:14px 6px 6px;font-weight:600;font-size:14px;color:var(--secondary-text-color)">
          {i18n('Money.Transactions')}<Show when={txLoading() && txs().length}><span style="font-weight:400"> · {i18n('Money.Updating')}</span></Show>
        </div>
        <div style="max-height:260px;overflow-y:auto">
          <For each={txs()} fallback={<div style="padding:16px;text-align:center;color:var(--secondary-text-color)">{i18n('Money.LoadingTx')}</div>}>{(tx) => (
            <div style="display:flex;align-items:center;gap:12px;padding:9px 6px">
              <Show when={tx.peer._ === 'walletTransactionPeerUser'} fallback={
                <div style={`width:40px;height:40px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;background:${tx.pFlags.incoming ? 'linear-gradient(135deg,#5ed96b,#2fa84a)' : 'linear-gradient(135deg,#2a9bff,#0a62f0)'}`}>
                  {tx.pFlags.incoming ? '↓' : '↑'}
                </div>
              }>
                <AvatarNewTsx peerId={userPeerId(tx)} size={40} />
              </Show>
              <div style="min-width:0;flex:1">
                <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  <Show when={tx.peer._ === 'walletTransactionPeerUser'} fallback={peerLabel(tx)}>
                    <PeerTitleTsx peerId={userPeerId(tx)} />
                  </Show>
                </div>
                <div style="font-size:12.5px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  {tx.pFlags.incoming ? i18n('Money.Received') : i18n('Money.Sent')}
                  {' · ' + new Date(tx.date * 1000).toLocaleString()}
                  {tx.comment && !tx.pFlags.comment_encrypted ? ' · ' + tx.comment : ''}
                  {tx.pFlags.failed ? ' · ' + I18n.format('Money.Failed', true) : ''}
                </div>
              </div>
              <div style={`white-space:nowrap;font-weight:600;color:${tx.pFlags.incoming ? '#34c759' : 'inherit'}`}>
                <span style="display:inline-flex;align-items:center;gap:4px">{tx.pFlags.incoming ? '+' : '−'}{formatNanoton(String(tx.amount).replace('-', ''), 9)}<GramIcon size={18} /></span>
              </div>
            </div>
          )}</For>
        </div>
      </Show>

      <div style="margin-top:20px;text-align:center;font-size:13px;color:var(--secondary-text-color)">
        {i18n('Money.Terms', [termsLink()])}
      </div>
    </div>
  );
}

let styled = false;
export default function showMoneyPopup() {
  if(!styled) {
    styled = true;
    const st = document.createElement('style');
    st.textContent = '.popup-money .popup-container{width:min(420px,calc(100vw - 24px));max-width:none;border-radius:26px;padding:0;overflow:hidden}';
    document.head.append(st);
  }
  createPopup(() => (
    <PopupElement class="popup-money" closable>
      <MoneyContent />
    </PopupElement>
  ));
}
