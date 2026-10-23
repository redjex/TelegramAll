import {describe, expect, it} from 'vitest';
import type {Chat, User} from '@layer';
import getBotApiDialogId from '@appManagers/utils/peers/getBotApiDialogId';

describe('profile IDs in Bot API format', () => {
  it('keeps user and bot IDs positive', () => {
    expect(getBotApiDialogId({_: 'user', id: 8526674560, pFlags: {}} as User.user)).toBe('8526674560');
    expect(getBotApiDialogId({_: 'user', id: 777000, pFlags: {bot: true}} as User.user)).toBe('777000');
    expect(getBotApiDialogId({_: 'userEmpty', id: 42} as User.userEmpty)).toBe('42');
  });

  it('uses a negative ID for basic groups, including unavailable groups', () => {
    expect(getBotApiDialogId({_: 'chat', id: 42} as Chat.chat)).toBe('-42');
    expect(getBotApiDialogId({_: 'chatForbidden', id: 42} as Chat.chatForbidden)).toBe('-42');
  });

  it('adds the channel offset for channels and supergroups, even for short IDs', () => {
    expect(getBotApiDialogId({_: 'channel', id: 42, pFlags: {broadcast: true}} as Chat.channel)).toBe('-1000000000042');
    expect(getBotApiDialogId({_: 'channel', id: 1234567890, pFlags: {megagroup: true}} as Chat.channel)).toBe('-1001234567890');
    expect(getBotApiDialogId({_: 'channelForbidden', id: 42} as Chat.channelForbidden)).toBe('-1000000000042');
  });

  it('handles channel direct messages without changing the offset rule', () => {
    expect(getBotApiDialogId({_: 'channel', id: 3000000000000, pFlags: {monoforum: true}} as Chat.channel)).toBe('-4000000000000');
  });

  it('does not display an ID before the peer is available or for invalid IDs', () => {
    expect(getBotApiDialogId(undefined)).toBeUndefined();
    expect(getBotApiDialogId({_: 'user', id: 0} as User.user)).toBeUndefined();
    expect(getBotApiDialogId({_: 'channel', id: Number.NaN} as Chat.channel)).toBeUndefined();
  });

  it('accepts cached IDs stored as decimal strings', () => {
    expect(getBotApiDialogId({_: 'user', id: '8526674560'} as User.user)).toBe('8526674560');
    expect(getBotApiDialogId({_: 'channel', id: '1234567890'} as Chat.channel)).toBe('-1001234567890');
  });
});
