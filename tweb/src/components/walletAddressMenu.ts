import {ButtonMenuSync} from '@components/buttonMenu';
import {toastNew} from '@components/toast';
import {copyTextToClipboard} from '@helpers/clipboard';
import {getOverlayRoot} from '@helpers/appWindow';
import contextMenuController from '@helpers/contextMenuController';
import positionMenu from '@helpers/positionMenu';
import {WALLET_EXPLORER_URL} from '@lib/richTextProcessor/parseEntities';

// The client holds no keys and cannot sign a transfer, so "send" hands the address to a wallet's own
// transfer page instead of pretending to.
const TRANSFER_URL = 'https://app.tonkeeper.com/transfer/';

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
  getOverlayRoot().append(element);

  positionMenu(event, element);
  contextMenuController.openBtnMenu(element, () => {
    setTimeout(() => element.remove(), 300);
  });
}
