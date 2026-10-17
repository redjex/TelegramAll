import {createMemo, createSignal, For, onCleanup, onMount, Show} from 'solid-js';
import {Portal} from 'solid-js/web';

import {filterCountries, sortCountries} from '@components/countryInputField';
import {HelpCountry} from '@layer';
import I18n, {i18n} from '@lib/langPack';
import {getCountryEmoji} from '@vendor/emoji';

import {fullCountryCode} from '@/pages/androidPhone/phoneModel';
import styles from '@/pages/androidPhone/androidPhone.module.scss';

const nameOf = (country: HelpCountry.helpCountry) => country.name || country.default_name;

/**
 * The "Choose a country" screen of the official Android app (CountrySelectActivity): a toolbar with
 * a back arrow, the title and a search button, and the countries in alphabetical order with a thin
 * line between letters. It slides in from the right, like a fragment.
 */
export default function CountryPicker(props: {
  onSelect: (country: HelpCountry.helpCountry) => void,
  onClose: () => void
}) {
  const [shown, setShown] = createSignal(false);
  const [searching, setSearching] = createSignal(false);
  const [query, setQuery] = createSignal('');

  let searchEl: HTMLInputElement;
  let closed = false;

  // "Anonymous Numbers" (Fragment) is tweb's own entry, the official list has none
const all = createMemo(() => sortCountries(I18n.countriesList.filter((country) => !country.pFlags?.hidden && country.iso2 !== 'FT')));

  const rows = createMemo(() => {
    const list = query() ? filterCountries(query(), true) : all();
    let lastLetter = '';
    return sortCountries([...list]).map((country) => {
      const letter = nameOf(country).charAt(0).toUpperCase();
      const newGroup = !!lastLetter && letter !== lastLetter;
      lastLetter = letter;
      return {country, newGroup};
    });
  });

  const close = () => {
    if(closed) return;
    closed = true;
    setShown(false);
    setTimeout(props.onClose, 220);
  };

  const onPop = () => {
    // the system back button
    if(searching()) {
      history.pushState({countryPicker: true}, '');
      stopSearch();
      return;
    }
    close();
  };

  /** Closes the list on our own and drops the history entry it pushed (the system back button pops it itself). */
  const dismiss = () => {
    close();
    if(history.state?.countryPicker) {
      history.back();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if(e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    }
  };

  onMount(() => {
    history.pushState({countryPicker: true}, '');
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  });

  onCleanup(() => {
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('keydown', onKeyDown);
  });

  const startSearch = () => {
    setSearching(true);
    setTimeout(() => searchEl?.focus(), 0);
  };

  const stopSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const choose = (country: HelpCountry.helpCountry) => {
    props.onSelect(country);
    setSearching(false);
    dismiss();
  };

  return (
    <Portal>
      <div class={styles.picker} classList={{[styles.pickerShown]: shown()}}>
        <div class={styles.pickerBar}>
          <button class={styles.pickerBack} aria-label="Back" onClick={() => searching() ? stopSearch() : dismiss()}>
            <span class={styles.backArrow} />
          </button>
          <Show when={searching()} fallback={
            <>
              <div class={styles.pickerTitle}>{i18n('Login.AndroidChooseCountry')}</div>
              <button class={styles.pickerSearch} aria-label={I18n.format('Login.AndroidSearch', true)} onClick={startSearch}>
                <span class={styles.searchIcon} />
              </button>
            </>
          }>
            <input
              ref={searchEl}
              class={styles.pickerInput}
              placeholder={I18n.format('Login.AndroidSearch', true)}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
            />
          </Show>
        </div>
        <div class={styles.pickerList}>
          <For each={rows()}>{(row) => (
            <>
              <Show when={row.newGroup}><div class={styles.pickerSeparator}><i /></div></Show>
              <button class={styles.pickerRow} onClick={() => choose(row.country)}>
                <span class={styles.pickerFlag}>{getCountryEmoji(row.country.iso2)}</span>
                <span class={styles.pickerName}>{nameOf(row.country)}</span>
                <span class={styles.pickerCode} dir="ltr">+{fullCountryCode(row.country)}</span>
              </button>
            </>
          )}</For>
        </div>
      </div>
    </Portal>
  );
}
