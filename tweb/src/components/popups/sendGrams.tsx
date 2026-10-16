import PopupElement, {createPopup, usePopupContext} from '@components/popups/indexTsx';
import rootScope from '@lib/rootScope';
import {createMemo, createSignal, For, onMount, Show} from 'solid-js';
import {toastNew} from '@components/toast';
import showLinkQrCodePopup from '@components/popups/linkQrCode';
import {AvatarNewTsx} from '@components/avatarNew';
import {PeerTitleTsx} from '@components/peerTitleTsx';
import {i18n, I18n} from '@lib/langPack';
import {formatNanoton} from '@helpers/paymentsWrapCurrencyAmount';
const AMOUNT_REGEXP = /^\d+([.,]\d{1,9})?$/;
const USD_REGEXP = /^\d+([.,]\d{1,2})?$/;

/**
 * Sends Grams from the Telegram wallet that sits on another device (a phone, or the official app): this client never
 * touches a key. It connects to that wallet over TON Connect — the owner scans a QR code once — and then asks it for the
 * transfer, which the owner confirms in the wallet itself.
 */
async function sendThroughWallet(address: string, amount: string) {
  const {isTonConnected, restoreTonConnect, createConnectLink, waitForConnection, requestTransfer} = await import('@lib/wallet/tonConnect');
  await restoreTonConnect().catch(() => {});

  if(!isTonConnected()) {
    let close: () => void;
    const link = createConnectLink();
    showLinkQrCodePopup({
      url: link,
      titleLangKey: 'Wallet.ConnectTitle',
      aboutLangKey: 'Wallet.ConnectQrAbout',
      onClose: (callback) => close = callback
    });

    try {
      await waitForConnection();
    } catch{
      toastNew({langPackKey: 'Wallet.ConnectFailed'});
      return;
    } finally {
      close?.();
    }
  }

  toastNew({langPackKey: 'Wallet.ConfirmInWallet'});
  try {
    await requestTransfer({to: address, amount});
    toastNew({langPackKey: 'Wallet.Sent'});
  } catch{
    toastNew({langPackKey: 'Wallet.SendFailed'});
  }
}

const SWAP_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 4v16M7 4L3 8M7 4l4 4" /><path d="M17 20V4m0 16l-4-4m4 4l4-4" />
  </svg>
);

/** The address in groups of four, the groups taking turns between bright and dim, over two lines like Telegram Desktop's. */
function AddressLines(props: {address: string}) {
  const lines = createMemo(() => {
    const groups = props.address.match(/.{1,4}/g) || [];
    const half = Math.ceil(groups.length / 2);
    return [groups.slice(0, half), groups.slice(half)];
  });

  return (
    <div style="font:600 13px/1.45 ui-monospace,'SF Mono',Consolas,monospace;letter-spacing:.2px;user-select:text">
      <For each={lines()}>{(groups, row) => (
        <div>
          <For each={groups}>{(group, index) => (
            <span style={{opacity: (index() + (row() ? lines()[0].length : 0)) % 2 ? '.38' : '1'}}>{group}{' '}</span>
          )}</For>
        </div>
      )}</For>
    </div>
  );
}

function SendGramsContent(props: {peerId: PeerId, address: string}) {
  const popup = usePopupContext();
  const [text, setText] = createSignal('');
  const [inUsd, setInUsd] = createSignal(false);
  const [rate, setRate] = createSignal(0);
  const [balance, setBalance] = createSignal<string>();
  const [username, setUsername] = createSignal('');
  let input: HTMLInputElement;

  onMount(() => {
    input?.focus();
    const managers = rootScope.managers;
    managers.apiManager.getAppConfig().then((config: any) => setRate(+config?.ton_usd_rate || 0)).catch(() => {});
    managers.appAccountManager.getWalletBalance().then(setBalance).catch(() => {});
    Promise.resolve(managers.appPeersManager.getPeerUsername(props.peerId)).then((value: string) => setUsername(value || ''));
  });

  const normalized = () => text().trim().replace(',', '.');
  /** The amount in GRAM, whatever it was typed in, as a string a transfer can carry. */
  const gram = createMemo(() => {
    const value = normalized();
    if(!value) return '';
    if(!inUsd()) return AMOUNT_REGEXP.test(value) ? value : '';
    if(!USD_REGEXP.test(value) || !rate()) return '';
    return (+value / rate()).toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
  });
  const valid = createMemo(() => !!gram() && +gram() > 0);
  const enough = createMemo(() => {
    if(!valid() || balance() === undefined) return true;
    return +gram() <= +formatNanoton(balance(), 9, false);
  });

  const secondary = createMemo(() => {
    const value = +normalized();
    if(!rate()) return '';
    if(inUsd()) return valid() ? '~' + gram() + ' GRAM' : '~0 GRAM';
    return '~' + ((Number.isFinite(value) ? value : 0) * rate()).toFixed(2) + ' USD';
  });

  const swap = () => {
    // keep what is typed meaningful across the switch: convert it to the other unit
    const value = +normalized();
    if(valid() && rate()) {
      setText(inUsd() ? gram() : (value * rate()).toFixed(2));
    }

    setInUsd(!inUsd());
    input?.focus();
  };

  const submit = () => {
    if(!valid() || !enough()) return;
    popup.hide();
    sendThroughWallet(props.address, gram());
  };

  return (
    <div style="padding:6px 22px 24px;color:var(--primary-text-color)">
      <div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:var(--surface-color);box-shadow:inset 0 0 0 1px var(--border-color)">
        <AvatarNewTsx peerId={props.peerId} size={44} />
        <div style="min-width:0;flex:1">
          <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px">
            <span style="font-weight:600;font-size:16px"><PeerTitleTsx peerId={props.peerId} onlyFirstName /></span>
            <Show when={username()}><span style="color:var(--secondary-text-color);font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">@{username()}</span></Show>
          </div>
          <AddressLines address={props.address} />
        </div>
        <button
          title={I18n.format('Wallet.FeeInfo', true)}
          onClick={() => toastNew({langPackKey: 'Wallet.FeeInfo'})}
          style="flex:none;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--secondary-text-color);background:transparent;color:var(--secondary-text-color);font-weight:600;cursor:pointer"
        >?</button>
      </div>

      <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin:34px 0 12px">
        <Show when={!inUsd()}>
          <img src="assets/gram/gram.png" width="34" height="34" style="object-fit:contain" draggable={false} />
        </Show>
        <input
          ref={input}
          inputmode="decimal"
          autocomplete="off"
          value={text()}
          placeholder="0"
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={`width:${Math.max(1, (text() || '0').length)}ch;min-width:1ch;max-width:9ch;border:0;outline:none;background:transparent;color:inherit;font:700 44px/1.1 inherit;text-align:center;padding:0`}
        />
        <span style="font-size:22px;font-weight:600;color:var(--secondary-text-color);align-self:flex-end;padding-bottom:6px">{inUsd() ? 'USD' : 'GRAM'}</span>
      </div>

      <div style="display:flex;justify-content:center">
        <button
          onClick={swap}
          disabled={!rate()}
          style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:14px;border:0;background:var(--surface-color);color:var(--secondary-text-color);font:inherit;font-size:14px;cursor:pointer"
        >
          {secondary() || '~0.00 USD'}{SWAP_ICON}
        </button>
      </div>

      <div style="text-align:center;margin:14px 0 22px;font-size:15px;color:var(--secondary-text-color)">
        <Show when={balance() !== undefined}>{i18n('Wallet.BalanceLine', [formatNanoton(balance(), 9, false)])}</Show>
        <Show when={!enough()}><div style="color:var(--danger-color);margin-top:4px">{i18n('Wallet.NotEnough')}</div></Show>
      </div>

      <button
        onClick={submit}
        disabled={!valid() || !enough()}
        style="width:100%;height:50px;border:0;border-radius:14px;font:600 17px inherit;color:#fff;background:var(--primary-color);cursor:pointer"
        classList={{'is-disabled': !valid() || !enough()}}
      >
        {i18n('Wallet.SendNow')}
      </button>
    </div>
  );
}

/** Asks how much to send to a user, the way Telegram Desktop's own wallet does, and sends it from the connected wallet. */
export default async function showSendGramsPopup(peerId: PeerId) {
  if(!peerId.isUser()) return;

  const address = await rootScope.managers.appAccountManager.getUserWalletAddress(peerId.toUserId()).catch((): undefined => undefined);
  if(!address) {
    toastNew({langPackKey: 'Wallet.NoWallet'});
    return;
  }

  createPopup(() => (
    <PopupElement class="popup-send-grams" closable>
      <PopupElement.Header>
        <PopupElement.Title title="Wallet.SendMoney" />
        <PopupElement.CloseButton />
      </PopupElement.Header>
      <SendGramsContent peerId={peerId} address={address} />
    </PopupElement>
  ));
}
