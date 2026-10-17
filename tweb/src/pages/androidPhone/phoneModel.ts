import {createSignal} from 'solid-js';

import {formatPhoneNumber} from '@helpers/formatPhoneNumber';
import {HelpCountry} from '@layer';
import I18n from '@lib/langPack';
import {getCountryEmoji} from '@vendor/emoji';

import type TelInputField from '@components/telInputField';

const MAX_CODE = 4;
const MAX_DIGITS = 4 + 32;

export type CountryView = {iso2: string, emoji: string, name: string};

/** The dialling code a country is listed under: the code itself plus the first prefix ("1" + "684"). */
export function fullCountryCode(country: HelpCountry.helpCountry) {
  const code = country.country_codes[0];
  return code.country_code + (code.prefixes?.[0] || '');
}

/** The longest prefix of `code` that the typed `digits` start with (after the code itself), or ''. */
function matchedPrefix(code: {country_code: string, prefixes?: string[]}, digits: string) {
  return (code.prefixes || [])
  .filter((prefix) => digits.startsWith(code.country_code + prefix))
  .sort((a, b) => b.length - a.length)[0] || '';
}

/** All the dialling codes (code + prefix) there are, to tell whether more digits could still extend one. */
let allCodes: string[];
function getAllCodes() {
  return allCodes ||= I18n.countriesList.flatMap((country) => country.country_codes.flatMap((code) => {
    return code.prefixes?.length ? code.prefixes.map((prefix) => code.country_code + prefix) : [code.country_code];
  }));
}

/**
 * The state of the phone-number form of the Android login screen: the country code and the number
 * live in two fields, while the logic that detects the country, formats the number and decides
 * whether it can be sent stays in the (never shown) `TelInputField` of `SignInCard`.
 */
export function createPhoneModel(tel: TelInputField) {
  const [code, setCode] = createSignal('');
  const [national, setNational] = createSignal('');
  const [hint, setHint] = createSignal('');
  const [country, setCountry] = createSignal<CountryView>();
  const [active, setActive] = createSignal<'code' | 'number'>('code');
  const [error, setError] = createSignal(false);

  function show(digits: string) {
    if(!digits) {
      setCode('');
      setNational('');
      setHint('');
      setCountry(undefined);
      return;
    }

    const formatted = formatPhoneNumber('+' + digits);
    const matched = formatted.code;
    let shownCode = digits.slice(0, MAX_CODE);
    let rest = '';
    let nationalText = '';
    let left = '';

    if(matched && digits.startsWith(matched.country_code)) {
      shownCode = matched.country_code;
      const longest = matchedPrefix(matched, digits);
      shownCode += longest;

      rest = digits.slice(shownCode.length);
      // "93 252 000": drop the code from the grouped text
      nationalText = formatted.formatted.slice(matched.country_code.length).trim();
      if(longest) nationalText = nationalText.slice(longest.length).trim();
      left = (formatted.leftPattern || '').replace(/‒/g, '0');
    }

    setCode(shownCode);
    setNational(rest ? nationalText : '');
    setHint(rest ? left : left.trimStart());
    setCountry(formatted.country ? {
      iso2: formatted.country.iso2,
      emoji: getCountryEmoji(formatted.country.iso2),
      name: formatted.country.name || formatted.country.default_name
    } : undefined);
  }

  /** Writes the digits to the logic field (so it detects the country and validates) and redraws. */
  function setDigits(digits: string) {
    digits = digits.slice(0, MAX_DIGITS);
    setError(false);
    tel.value = digits ? '+' + digits : '';
    tel.simulateInputEvent();
    show(digits);
  }

  const digits = () => tel.value.replace(/\D/g, '');

  function codeIsComplete(value: string) {
    const formatted = formatPhoneNumber('+' + value);
    if(!formatted.code) return false;
    const full = formatted.code.country_code + matchedPrefix(formatted.code, value);
    return full === value && !getAllCodes().some((c) => c.length > value.length && c.startsWith(value));
  }

  function typeDigit(digit: string) {
    const all = digits();
    if(active() === 'code') {
      const head = code();
      if(head.length >= MAX_CODE) {
        return;
      }

      const next = head + digit;
      setDigits(next + all.slice(head.length));
      // the digit may already belong to the number (the code before it is complete), or end the code
      if(code().length < next.length || codeIsComplete(next)) {
        setActive('number');
      }
    } else {
      setDigits(all + digit);
    }
  }

  function backspace() {
    const all = digits();
    if(active() === 'number') {
      if(national().replace(/\D/g, '').length) {
        setDigits(all.slice(0, -1));
        return;
      }

      setActive('code');
    }

    const head = code();
    if(head) setDigits(head.slice(0, -1) + all.slice(head.length));
  }

  /** Chooses a country in the picker: its code is filled in and the number is next. */
  function pickCountry(picked: HelpCountry.helpCountry) {
    setDigits(fullCountryCode(picked));
    setActive('number');
  }

  return {
    code,
    national,
    hint,
    country,
    active,
    setActive,
    error,
    setError,
    typeDigit,
    backspace,
    pickCountry,
    refresh: () => show(digits())
  };
}

export type PhoneModel = ReturnType<typeof createPhoneModel>;
