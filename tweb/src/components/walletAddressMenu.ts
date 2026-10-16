import {ButtonMenuSync, ButtonMenuItem} from '@components/buttonMenu';
import rootScope from '@lib/rootScope';
import wrapPeerTitle from '@components/wrappers/peerTitle';
import {toastNew} from '@components/toast';
import {copyTextToClipboard} from '@helpers/clipboard';
import {getOverlayRoot} from '@helpers/appWindow';
import contextMenuController from '@helpers/contextMenuController';
import positionMenu from '@helpers/positionMenu';
import {WALLET_EXPLORER_URL} from '@lib/richTextProcessor/parseEntities';

// The client holds no keys and cannot sign a transfer, so "send" hands the address to Telegram's own Gram wallet
// (Money in the official app) through its tg://sendgrams link, which opens the send form with the recipient filled in.
const TRANSFER_URL = 'tg://sendgrams?to=';

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** What can be done with a wallet address met in a message: look it up, send to it, copy it. */
export default function showWalletAddressMenu(address: string, event: MouseEvent | TouchEvent) {
  const element = ButtonMenuSync({
    buttons: [{
      icon: 'search',
      text: 'Wallet.OpenInExplorer',
      onClick: () => openExternal(WALLET_EXPLORER_URL + address)
    }, {
      icon: 'gram',
      text: 'Wallet.SendMoney',
      onClick: () => openExternal(TRANSFER_URL + address)
    }, {
      icon: 'copy',
      text: 'Wallet.CopyAddress',
      onClick: () => {
        copyTextToClipboard(address);
        toastNew({langPackKey: 'Wallet.AddressCopied'});
      }
    }]
  });
  element.classList.add('contextmenu');

  // the owner is looked up on the server; their profile row (avatar, name, @username) is added at the top of the menu
  // as soon as it is known, and only if the address belongs to a Telegram user
  (async() => {
    const peerId = await rootScope.managers.appAccountManager.getWalletAddressOwner(address);
    if(!peerId || !element.isConnected) return;

    const [title, username] = await Promise.all([
      wrapPeerTitle({peerId}),
      rootScope.managers.appPeersManager.getPeerUsername(peerId)
    ]);
    if(!element.isConnected) return;

    const textElement = document.createElement('span');
    textElement.classList.add('wallet-owner-text');
    title.classList.add('wallet-owner-name');
    textElement.append(title);
    if(username) {
      const handle = document.createElement('span');
      handle.classList.add('wallet-owner-username');
      handle.textContent = '@' + username;
      textElement.append(handle);
    }

    const items = ButtonMenuItem({
      avatarInfo: {peerId},
      textElement,
      separatorDown: true,
      onClick: () => {
        import('@lib/appImManager').then(({default: appImManager}) => appImManager.setPeer({peerId}));
      }
    }) as HTMLElement[];
    element.prepend(...items);
  })().catch(() => {});

  getOverlayRoot().append(element);

  positionMenu(event, element);
  contextMenuController.openBtnMenu(element, () => {
    setTimeout(() => element.remove(), 300);
  });
}
