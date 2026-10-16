import {onMount, untrack, useContext} from 'solid-js';
import PopupElement, {createPopup, PopupContext} from '@components/popups/indexTsx';
import InputField from '@components/inputField';
import wrapSticker from '@components/wrappers/sticker';
import type ChatInput from '@components/chat/input';
import type {MyDocument} from '@appManagers/appDocsManager';

import css from '@components/stickerTextPopup.module.scss';

const PREVIEW_SIZE = 192;
const CAPTION_MAX_LENGTH = 1024;

/** A sticker with a line of text: both go out as one message, the text under the sticker in its bubble. */
export default function showStickerTextPopup(chatInput: ChatInput, doc: MyDocument): void {
  function Inner() {
    const context = useContext(PopupContext);
    const middleware = untrack(() => context.middlewareHelper).get();

    const inputField = new InputField({
      placeholder: 'StickerText.Placeholder',
      plainText: true,
      withLinebreaks: false,
      maxLength: CAPTION_MAX_LENGTH
    });

    const send = async() => {
      const sent = await chatInput.sendMessageWithDocument({
        document: doc,
        caption: inputField.value.trim() || undefined
      });
      // a refused send (no rights, slow mode) keeps the popup and the text where they are
      if(sent !== false) context.hide();
    };

    const preview = document.createElement('div');
    preview.classList.add(css.preview);
    wrapSticker({
      doc,
      div: preview,
      middleware,
      group: 'none',
      play: true,
      loop: true,
      withThumb: true,
      width: PREVIEW_SIZE,
      height: PREVIEW_SIZE,
      liteModeKey: false
    });

    onMount(() => {
      inputField.input.addEventListener('keydown', (event: KeyboardEvent) => {
        if(event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          send();
        }
      });
      inputField.input.focus();
    });

    return (
      <>
        <PopupElement.Header>
          <PopupElement.CloseButton />
          <PopupElement.Title title="StickerText.Title" />
        </PopupElement.Header>
        <PopupElement.Body>
          {preview}
          <div class={css.field}>{inputField.container}</div>
        </PopupElement.Body>
        <PopupElement.Footer>
          <PopupElement.FooterButton langKey="Send" callback={() => (send(), false)} />
        </PopupElement.Footer>
      </>
    );
  }

  createPopup(() => (
    <PopupElement class={css.popup}>
      <Inner />
    </PopupElement>
  ));
}
