import {For} from 'solid-js';
import PopupElement, {createPopup} from '@components/popups/indexTsx';
import {toastNew} from '@components/toast';
import {i18n} from '@lib/langPack';
import {copyTextToClipboard} from '@helpers/clipboard';

import css from '@components/tlSchemaPopup.module.scss';

const MTCUTE_URL = 'https://mtcute.dev/';
const MTCUTE_TL_DOCS_URL = 'https://jsr.io/@mtcute/tl/doc/~/tl.';

/** `messageMediaDocument` → `RawMessageMediaDocument`, `messages.getHistory` → `RawMessagesGetHistory`. */
function getMtcuteTypeName(constructor: string) {
  return 'Raw' + constructor.split('.').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
}

function toJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if(typeof item === 'bigint') return item.toString();
    if(item instanceof Uint8Array) return `<${item.length} bytes>`;
    if(item instanceof Set) return [...item];
    if(item instanceof Map) return Object.fromEntries(item);
    return item;
  }, 2);
}

/** Every TL constructor (`_`) found in the object, in order of appearance. */
function collectConstructors(value: unknown, found = new Set<string>()) {
  if(Array.isArray(value)) {
    value.forEach((item) => collectConstructors(item, found));
  } else if(value && typeof value === 'object') {
    const constructor = (value as {_?: unknown})._;
    if(typeof constructor === 'string' && constructor) {
      found.add(constructor);
    }

    Object.values(value).forEach((item) => collectConstructors(item, found));
  }

  return found;
}

/**
 * Shows the TL object of a message as the client holds it, with every constructor in it linked to
 * mtcute's documentation of that type. mtcute has no endpoint that takes a message, so the lookup
 * is by type.
 */
export default function showTlSchemaPopup(message: unknown): void {
  const json = toJson(message);
  const constructors = [...collectConstructors(message)];

  createPopup(() => (
    <PopupElement class={css.popup}>
      <PopupElement.Header>
        <PopupElement.CloseButton />
        <PopupElement.Title title="TlSchema.Title" />
      </PopupElement.Header>
      <PopupElement.Body class={css.body}>
        <PopupElement.Scrollable>
          <div class={css.types}>
            <For each={constructors}>
              {(constructor) => (
                <a
                  class={css.type}
                  href={MTCUTE_TL_DOCS_URL + getMtcuteTypeName(constructor)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {constructor}
                </a>
              )}
            </For>
          </div>
          <pre class={css.json} dir="ltr">{json}</pre>
        </PopupElement.Scrollable>
      </PopupElement.Body>
      <PopupElement.Footer>
        <PopupElement.FooterButton
          langKey="TlSchema.Copy"
          callback={() => {
            copyTextToClipboard(json);
            toastNew({langPackKey: 'TlSchema.Copied'});
            return false;
          }}
        />
        <PopupElement.FooterButton
          color="secondary"
          langKey="TlSchema.OpenMtcute"
          callback={() => {
            window.open(MTCUTE_URL, '_blank', 'noopener,noreferrer');
            return false;
          }}
        />
      </PopupElement.Footer>
    </PopupElement>
  ));
}
