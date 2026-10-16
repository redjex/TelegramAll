import '@lib/wallet/bufferPolyfill';
import {TonConnect, type SendTransactionRequest} from '@tonconnect/sdk';
import {beginCell} from '@ton/core';
import {toNano} from '@ton/core';

// The wallet is Telegram's own, and the keys stay in it, on the device that holds them (a phone, or the official
// desktop app): this client only connects to it over TON Connect (the standard dApp-to-wallet protocol, through
// Telegram's own bridge) and asks it to send a transfer. The wallet shows the transfer and the owner confirms it there.

// The manifest names this app to the wallet; the wallet fetches it itself, so it has to be reachable over https.
const MANIFEST_URL = 'https://raw.githubusercontent.com/redjex/TelegramAll/main/tonconnect-manifest.json';

// "Telegram" in the TON Connect wallets list (ton-blockchain/wallets-list).
const TELEGRAM_WALLET = {
  universalLink: 'https://t.me/sendgrams',
  bridgeUrl: 'https://tonbridge.telegram.org'
};

const TRANSFER_TTL = 5 * 60;

let connector: TonConnect;

export function getTonConnect() {
  return connector ||= new TonConnect({manifestUrl: MANIFEST_URL});
}

/**
 * Brings back a connection made earlier, so a wallet connected once stays connected (the session keys live in this
 * profile's storage, so a rebuild of the app does not drop them). The wallet answers through the bridge, so give it a
 * few seconds before deciding there is no connection.
 */
export async function restoreTonConnect() {
  const connector = getTonConnect();
  if(connector.connected) return;

  await Promise.race([
    connector.restoreConnection(),
    new Promise((resolve) => setTimeout(resolve, 8000))
  ]).catch(() => {});

  if(!connector.connected) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve();
      }, 3000);
      const unsubscribe = connector.onStatusChange((wallet) => {
        if(wallet) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
}

export function isTonConnected() {
  return getTonConnect().connected;
}

/** The link that, opened in the Telegram app that holds the wallet (or scanned as a QR code), asks it to connect. */
export function createConnectLink() {
  return getTonConnect().connect(TELEGRAM_WALLET) as string;
}

/** Resolves when the wallet accepts the connection; rejects if it is declined or the connection fails. */
export function waitForConnection() {
  return new Promise<void>((resolve, reject) => {
    const unsubscribe = getTonConnect().onStatusChange((wallet) => {
      if(wallet) {
        unsubscribe();
        resolve();
      }
    }, (error) => {
      unsubscribe();
      reject(error);
    });
  });
}

export function disconnectTonConnect() {
  return getTonConnect().disconnect();
}

/** Asks the connected wallet to send `amount` GRAM (a decimal string with a dot) to `to`. The wallet's owner confirms it there. */
export function requestTransfer(options: {to: string, amount: string, comment?: string}) {
  const message: SendTransactionRequest['messages'][number] = {
    address: options.to,
    amount: toNano(options.amount).toString()
  };

  if(options.comment) {
    message.payload = beginCell().storeUint(0, 32).storeStringTail(options.comment).endCell().toBoc().toString('base64');
  }

  return getTonConnect().sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + TRANSFER_TTL,
    messages: [message]
  });
}
