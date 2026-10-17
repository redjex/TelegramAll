import type {Chat, User} from '@layer';

/** A display/copy ID compatible with Telegram Bot API; tweb's internal IDs stay unchanged. */
export default function getBotApiDialogId(peer: User | Chat): string | undefined {
  const id = Number(peer?.id);
  if(!Number.isSafeInteger(id) || id <= 0) return;

  switch(peer._) {
    case 'user':
    case 'userEmpty':
      return String(id);
    case 'chat':
    case 'chatEmpty':
    case 'chatForbidden':
      return String(-id);
    case 'channel':
    case 'channelForbidden':
      return String(-1_000_000_000_000 - id);
  }
}
