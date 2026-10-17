import {For, Show} from 'solid-js';

import styles from '@/pages/androidPhone/androidPhone.module.scss';

const KEYS: {digit: string, letters: string}[] = [
  {digit: '1', letters: ''},
  {digit: '2', letters: 'ABC'},
  {digit: '3', letters: 'DEF'},
  {digit: '4', letters: 'GHI'},
  {digit: '5', letters: 'JKL'},
  {digit: '6', letters: 'MNO'},
  {digit: '7', letters: 'PQRS'},
  {digit: '8', letters: 'TUV'},
  {digit: '9', letters: 'WXYZ'},
  // the cell under 7 is empty
  undefined,
  {digit: '0', letters: '+'}
];

/**
 * The number pad of the official Android login screen (CustomPhoneKeyboardView): 3x4 keys with the
 * letters of a phone keypad, an empty cell bottom left and a backspace that repeats while held.
 */
export default function PhoneKeyboard(props: {onDigit: (digit: string) => void, onBackspace: () => void}) {
  let holdTimer: number;
  let repeatTimer: number;

  const stopRepeat = () => {
    clearTimeout(holdTimer);
    clearInterval(repeatTimer);
  };

  const startBackspace = (e: PointerEvent) => {
    e.preventDefault();
    props.onBackspace();
    stopRepeat();
    // like the original: after 200 ms it repeats every 50 ms
    holdTimer = window.setTimeout(() => {
      repeatTimer = window.setInterval(props.onBackspace, 50);
    }, 200);
  };

  return (
    <div class={styles.keyboard} onContextMenu={(e) => e.preventDefault()}>
      <For each={KEYS}>{(key) => (
        <Show when={key} fallback={<div />}>
          <button class={styles.key} onPointerDown={(e) => { e.preventDefault(); props.onDigit(key.digit); }}>
            <span class={styles.keyDigit}>{key.digit}</span>
            <span class={styles.keyLetters}>{key.letters}</span>
          </button>
        </Show>
      )}</For>
      <button
        class={`${styles.key} ${styles.keyBackspace}`}
        aria-label="Backspace"
        onPointerDown={startBackspace}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        <span class={styles.backspaceIcon} />
      </button>
    </div>
  );
}
