import {createSignal, onCleanup, onMount, Show} from 'solid-js';
import {Portal} from 'solid-js/web';

import {HelpCountry} from '@layer';
import {i18n} from '@lib/langPack';

import CountryPicker from '@/pages/androidPhone/CountryPicker';
import PhoneKeyboard from '@/pages/androidPhone/PhoneKeyboard';
import type {PhoneModel} from '@/pages/androidPhone/phoneModel';
import styles from '@/pages/androidPhone/androidPhone.module.scss';

/**
 * The fields of the official Android phone-number screen: an outlined "Country" box that opens the
 * country list, and a "Phone number" box holding "+", the country code and the number. The digits
 * come from the number pad below (or a hardware keyboard).
 */
export default function PhoneForm(props: {
  model: PhoneModel,
  onSubmit: () => void,
  canSubmit: () => boolean
}) {
  const model = props.model;
  const [picking, setPicking] = createSignal(false);

  const onKeyDown = (e: KeyboardEvent) => {
    if(picking() || e.ctrlKey || e.metaKey || e.altKey) return;

    if(/^\d$/.test(e.key)) {
      model.typeDigit(e.key);
    } else if(e.key === 'Backspace') {
      model.backspace();
    } else if(e.key === 'Enter' && props.canSubmit()) {
      props.onSubmit();
    } else {
      return;
    }

    e.preventDefault();
  };

  onMount(() => window.addEventListener('keydown', onKeyDown));
  onCleanup(() => window.removeEventListener('keydown', onKeyDown));

  const onPick = (country: HelpCountry.helpCountry) => model.pickCountry(country);

  return (
    <>
      <div class={styles.form}>
        <div class={styles.box} classList={{[styles.boxFilled]: !!model.country()}} onClick={() => setPicking(true)}>
          <span class={styles.boxLabel}>{i18n('Country')}</span>
          <Show when={model.country()}>
            <span class={styles.countryFlag}>{model.country().emoji}</span>
            <span class={styles.countryName}>{model.country().name}</span>
          </Show>
          <span class={styles.chevron} />
        </div>

        <div
          class={styles.box}
          classList={{
            [styles.boxFilled]: true,
            [styles.boxFocused]: !model.error(),
            [styles.boxError]: model.error()
          }}
        >
          <span class={styles.boxLabel}>{i18n(model.error() ? 'Login.AndroidPhoneInvalid' : 'Login.AndroidPhoneLabel')}</span>
          <span class={styles.plus}>+</span>
          <div class={styles.codeField} onClick={() => model.setActive('code')}>
            <span>{model.code()}</span>
            <Show when={model.active() === 'code'}><i class={styles.caret} /></Show>
          </div>
          <span class={styles.divider} />
          <div class={styles.numberField} onClick={() => model.setActive('number')}>
            <span>{model.national()}</span>
            <Show when={model.active() === 'number'}><i class={styles.caret} /></Show>
            <span class={styles.numberHint}>{model.national() ? model.hint() : model.hint().trimStart()}</span>
          </div>
        </div>
      </div>

      <Portal mount={document.getElementById('auth-pages') || document.body}>
        <PhoneKeyboard onDigit={model.typeDigit} onBackspace={model.backspace} />
      </Portal>

      <Show when={picking()}>
        <CountryPicker onSelect={onPick} onClose={() => setPicking(false)} />
      </Show>
    </>
  );
}
