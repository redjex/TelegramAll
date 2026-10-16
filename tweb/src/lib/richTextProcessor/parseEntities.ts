/*
 * Originally from:
 * https://github.com/zhukov/webogram
 * Copyright (C) 2014 Igor Zhukov <igor.beatle@gmail.com>
 * https://github.com/zhukov/webogram/blob/master/LICENSE
 */

import {EMAIL_REG_EXP, FULL_REG_EXP} from '.';
import TLD from '@config/tld';
import {MessageEntity} from '@layer';
import checkBrackets from '@lib/richTextProcessor/checkBrackets';
import getEmojiUnified from '@lib/richTextProcessor/getEmojiUnified';

// A TON wallet address in its friendly form: 48 base64url characters, the first two being the flags and
// the workchain (EQ/UQ for the basechain, Ef/Uf for the masterchain, kQ/0Q on the testnet).
const WALLET_ADDRESS_REG_EXP = /(?<![\w-])[EUk0][Qf][\w-]{46}(?![\w-])/g;
export const WALLET_EXPLORER_URL = 'https://gram.org/address/';

/** The wallet addresses in the text that no entity of `existing` already covers, as link entities. */
export function findWalletEntities(text: string, existing: MessageEntity[]) {
  const walletEntities: MessageEntity[] = [];
  for(const match of text.matchAll(WALLET_ADDRESS_REG_EXP)) {
    const offset = match.index;
    const length = match[0].length;
    if(existing.some((entity) => offset < entity.offset + entity.length && entity.offset < offset + length)) {
      continue;
    }

    walletEntities.push({
      _: 'messageEntityTextUrl',
      offset,
      length,
      url: WALLET_EXPLORER_URL + match[0],
      walletAddress: true
    } as MessageEntity.messageEntityTextUrl);
  }

  return walletEntities;
}

export default function parseEntities(text: string, options?: {wallets?: boolean}) {
  let match: RegExpMatchArray;
  let raw = text;
  const entities: MessageEntity[] = [];
  let matchIndex;
  let rawOffset = 0;
  // var start = tsNow()
  FULL_REG_EXP.lastIndex = 0;
  while(match = raw.match(FULL_REG_EXP)) {
    matchIndex = rawOffset + match.index;

    // console.log('parseEntities match:', match);

    if(match[3]) { // mentions
      entities.push({
        _: 'messageEntityMention',
        offset: matchIndex + match[1].length,
        length: match[2].length + match[3].length
      });
    } else if(match[4]) {
      if(EMAIL_REG_EXP.test(match[4])) { // email
        entities.push({
          _: 'messageEntityEmail',
          offset: matchIndex,
          length: match[4].length
        });
      } else {
        let url: string;
        let protocol = match[5];
        const tld = match[6];
        // let excluded = '';
        if(tld) { // URL
          if(!protocol && (tld.substr(0, 4) === 'xn--' || TLD.indexOf(tld.toLowerCase()) !== -1)) {
            protocol = 'http://';
          }

          if(protocol) {
            const balanced = checkBrackets(match[4]);
            if(balanced.length !== match[4].length) {
              // excluded = match[4].substring(balanced.length);
              match[4] = balanced;
            }

            url = (match[5] ? '' : protocol) + match[4];
          }
        } else { // IP address
          url = (match[5] ? '' : 'http://') + match[4];
        }

        if(url) {
          entities.push({
            _: 'messageEntityUrl',
            offset: matchIndex,
            length: match[4].length
          });
        }
      }
    } else if(match[7]) { // New line
      entities.push({
        _: 'messageEntityLinebreak',
        offset: matchIndex,
        length: 1
      });
    } else if(match[8]) { // Emoji
      const unified = getEmojiUnified(match[8]);
      if(unified) {
        entities.push({
          _: 'messageEntityEmoji',
          offset: matchIndex,
          length: match[8].length,
          unicode: unified
        });
      }
    } else if(match[11]) { // Hashtag or cashtag
      const isCashtag = match[11][0] === '$';
      const cashtag = isCashtag ? match[11].split('@', 1)[0] : undefined;

      if(!cashtag || cashtag === cashtag.toUpperCase()) {
        entities.push({
          _: isCashtag ? 'messageEntityCashtag' : 'messageEntityHashtag',
          offset: matchIndex + (match[10] ? match[10].length : 0),
          length: match[11].length
        });
      }
    } else if(match[13]) { // Bot command
      entities.push({
        _: 'messageEntityBotCommand',
        offset: matchIndex + (match[11] ? match[11].length : 0) + (match[12] ? match[12].length : 0),
        length: 1 + match[13].length + (match[14] ? 1 + match[14].length : 0),
        unsafe: true
      });
    } else if(match[16]) { // Media timestamp
      const timestamp = match[16];
      const splitted: string[] = timestamp.split(':');
      const splittedLength = splitted.length;
      const hours = splittedLength === 3 ? +splitted[0] : 0;
      const minutes = +splitted[splittedLength === 3 ? 1 : 0];
      const seconds = +splitted[splittedLength - 1];
      entities.push({
        _: 'messageEntityTimestamp',
        offset: matchIndex + (/\D/.test(match[0][0]) ? 1 : 0),
        length: timestamp.length,
        raw: timestamp,
        time: hours * 3600 + minutes * 60 + seconds
      });
    }

    raw = raw.substr(match.index + match[0].length);
    rawOffset += match.index + match[0].length;
  }

  // Wallet addresses become a link (to a menu of what to do with one) when the text is shown. They are
  // left out of what is sent, so nobody receives a link entity the author never wrote.
  if(options?.wallets) {
    const walletEntities = findWalletEntities(text, entities);
    if(walletEntities.length) {
      entities.push(...walletEntities);
      entities.sort((a, b) => a.offset - b.offset);
    }
  }

  return entities;
}
