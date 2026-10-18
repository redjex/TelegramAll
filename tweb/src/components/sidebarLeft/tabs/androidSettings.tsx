import {createMemo, For, JSX, Show} from 'solid-js';

import {AvatarNewTsx} from '@components/avatarNew';
import {PeerTitleTsx} from '@components/peerTitleTsx';
import {formatPhoneNumber} from '@helpers/formatPhoneNumber';
import {User} from '@layer';
import getPeerActiveUsernames from '@appManagers/utils/peers/getPeerActiveUsernames';
import rootScope from '@lib/rootScope';
import {usePeer} from '@stores/peers';

import styles from '@/components/sidebarLeft/tabs/androidSettings.module.scss';

export type AndroidSettingsRow = {
  /** the name of an official `settings_*` icon (assets/android/vectors) */
  icon: string,
  /** the gradient of the icon's square, top to bottom (IconBackgroundColors in the Android source) */
  colors: string[],
  title: JSX.Element,
  subtitle?: JSX.Element,
  /** shown in blue at the right end of the row */
  value?: JSX.Element,
  onClick: () => void
};

export type AndroidSettingsCard = {
  header?: JSX.Element,
  rows: AndroidSettingsRow[]
};

/** "+79506472367" as the Android client writes it: "+7 (950) 647-23-67". */
function formatPhone(phone: string) {
  if(!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const formatted = formatPhoneNumber('+' + digits);
  const code = formatted.code?.country_code;
  if(!code || !digits.startsWith(code)) return '+' + digits;

  const groups = formatted.formatted.slice(code.length).trim().split(' ').filter(Boolean);
  if(groups.length < 2) return '+' + code + ' ' + groups.join('');
  return `+${code} (${groups[0]}) ${groups.slice(1).join('-')}`;
}

/**
 * Settings the way Telegram for Android draws them (SettingsActivity): the profile on top, then white
 * rounded cards of rows — a gradient square with a white glyph, a title and a grey line under it.
 */
export default function AndroidSettings(props: {
  cards: AndroidSettingsCard[]
}) {
  const user = usePeer(() => rootScope.myId);

  const subtitle = createMemo(() => {
    const me = user() as User.user;
    if(!me) return '';
    const username = getPeerActiveUsernames(me)[0];
    return [formatPhone(me.phone), username && '@' + username].filter(Boolean).join(' • ');
  });

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <div class={styles.avatar}>
          <AvatarNewTsx peerId={rootScope.myId} size={90} isDialog={false} />
        </div>
        <div class={styles.name}><PeerTitleTsx peerId={rootScope.myId} /></div>
        <div class={styles.info}>{subtitle()}</div>
      </div>

      <For each={props.cards}>{(card) => (
        <div class={styles.card}>
          <Show when={card.header}><div class={styles.cardHeader}>{card.header}</div></Show>
          <For each={card.rows}>{(row) => (
            <button class={styles.row} classList={{[styles.twoLines]: !!row.subtitle}} onClick={row.onClick}>
              <span class={styles.icon} style={{background: `linear-gradient(${row.colors[0]}, ${row.colors[1]})`}}>
                <span class={styles.glyph} style={{'--glyph': `url('/assets/android/vectors/${row.icon}.svg')`}} />
              </span>
              <span class={styles.text}>
                <span class={styles.title}>{row.title}</span>
                <Show when={row.subtitle}><span class={styles.subtitle}>{row.subtitle}</span></Show>
              </span>
              <Show when={row.value}><span class={styles.value}>{row.value}</span></Show>
            </button>
          )}</For>
        </div>
      )}</For>
    </div>
  );
}
