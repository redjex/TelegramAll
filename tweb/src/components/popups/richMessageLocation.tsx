import {createGeoPin} from '@components/geoPin';
import InputField from '@components/inputField';
import PopupElement, {createPopup} from '@components/popups/indexTsx';
import styles from '@components/popups/richMessageLocation.module.scss';
import ListenerSetter from '@helpers/listenerSetter';
import {onCleanup} from 'solid-js';
import type {ChatInputMapOptions} from '@components/chat/inputEditor/types';
import I18n, {i18n} from '@lib/langPack';
import {
  composeRichMessageMapCaption,
  normalizeRichMessageMapCenter,
  panRichMessageMapCenter,
  splitRichMessageMapCaption
} from '@components/popups/richMessageLocationModel';

const DEFAULT_MAP_HEIGHT = 200;
const DEFAULT_MAP_WIDTH = 400;
const DEFAULT_PREVIEW_ZOOM = 13;
const MAX_ZOOM = 19; // the deepest level OpenStreetMap serves
const MIN_ZOOM = 1;

type RichMessageLocationPickerOptions = {
  editing?: boolean,
  map?: ChatInputMapOptions
};

class RichMessageLocationContent {
  public readonly body = document.createElement('div');
  private readonly listenerSetter = new ListenerSetter();
  private destroyed = false;
  private accuracyRadius: number;
  // an address the map was made with is kept as it was; the picker itself only asks for a title
  private address: string;
  private coordinates: HTMLElement;
  private latitude: number;
  private longitude: number;
  private mapHeight: number;
  private mapImage: HTMLElement;
  private mapPreview: HTMLElement;
  private mapWidth: number;
  private previewZoom: number;
  private titleInputField: InputField;

  constructor(private options: RichMessageLocationPickerOptions) {
    const map = options.map;
    this.latitude = map?.latitude ?? 20;
    this.longitude = map?.longitude ?? 0;
    this.previewZoom = map?.zoom ?? (map ? DEFAULT_PREVIEW_ZOOM : 2);
    this.mapWidth = map?.width ?? DEFAULT_MAP_WIDTH;
    this.mapHeight = map?.height ?? DEFAULT_MAP_HEIGHT;
    this.accuracyRadius = map?.accuracyRadius;

    const caption = splitRichMessageMapCaption(map?.caption);
    this.titleInputField = new InputField({
      label: 'Chat.Input.Editor.Map.CaptionTitle',
      plainText: true,
      withLinebreaks: false
    });
    if(caption.title) this.titleInputField.setValueSilently(caption.title);
    this.address = caption.address;

    const picker = document.createElement('div');
    picker.classList.add(styles.picker);
    this.mapPreview = document.createElement('div');
    // `popup-rich-map-preview` is what the e2e suite drags and keys the map by
    this.mapPreview.classList.add('popup-rich-map-preview', styles.preview);
    this.mapPreview.tabIndex = 0;
    this.mapPreview.style.aspectRatio = `${this.mapWidth} / ${this.mapHeight}`;
    this.mapPreview.setAttribute('role', 'application');
    this.mapPreview.setAttribute(
      'aria-label',
      I18n.format('Chat.Input.Editor.Map.Picker', true)
    );
    this.mapImage = document.createElement('div');
    this.mapImage.classList.add(styles.image);
    const pin = createGeoPin();
    pin.classList.add(styles.pin);
    this.coordinates = document.createElement('div');
    this.coordinates.classList.add(styles.coordinates);
    this.mapPreview.append(this.mapImage, pin, this.coordinates);

    const fields = document.createElement('div');
    fields.classList.add(styles.fields);
    fields.append(this.titleInputField.container);
    picker.append(this.mapPreview, fields);
    this.body.prepend(picker);

    this.setupMapInteraction();
    this.renderPreview();
  }

  public getMap(): ChatInputMapOptions {
    const map = this.options.map;
    const captionValue = composeRichMessageMapCaption(
      this.titleInputField.value,
      this.address
    );
    return {
      ...map,
      accuracyRadius: this.accuracyRadius,
      caption: captionValue,
      captionEntities: captionValue === map?.caption ? map.captionEntities : [],
      height: this.mapHeight,
      latitude: this.latitude,
      longitude: this.longitude,
      width: this.mapWidth,
      zoom: this.previewZoom
    };
  }

  private setZoom(zoom: number) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
    if(next === this.previewZoom) return false;
    this.previewZoom = next;
    this.renderPreview();
  }

  private setupMapInteraction() {
    // the wheel zooms the map: up brings it closer, down takes it away; a fast spin steps once per notch
    let wheelDelta = 0;
    this.listenerSetter.add(this.mapPreview)('wheel', (event) => {
      event.preventDefault();
      wheelDelta += event.deltaY;
      if(Math.abs(wheelDelta) < 40) return;
      const direction = wheelDelta < 0 ? 1 : -1;
      wheelDelta = 0;
      this.setZoom(this.previewZoom + direction);
    }, {passive: false});
    let pointer: {
      id: number,
      x: number,
      y: number
    };
    this.listenerSetter.add(this.mapPreview)('pointerdown', (event) => {
      if(event.button !== 0) return;
      event.preventDefault();
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };
      this.mapPreview.setPointerCapture(event.pointerId);
      this.mapPreview.classList.add(styles.previewDragging);
    });
    this.listenerSetter.add(this.mapPreview)('pointermove', (event) => {
      if(!pointer || pointer.id !== event.pointerId) return;
      const x = event.clientX - pointer.x;
      const y = event.clientY - pointer.y;
      this.mapImage.style.transform = `translate(${x}px, ${y}px)`;
    });
    const finishPointer = (event: PointerEvent) => {
      if(!pointer || pointer.id !== event.pointerId) return;
      const dragX = event.clientX - pointer.x;
      const dragY = event.clientY - pointer.y;
      const dragged = Math.abs(dragX) + Math.abs(dragY) > 4;
      const rect = this.mapPreview.getBoundingClientRect();
      // the preview is drawn at mapWidth x mapHeight but shown at whatever size the popup gives it
      const scale = rect.width ? this.mapWidth / rect.width : 1;
      const deltaX = (dragged ? -dragX : event.clientX - rect.left - rect.width / 2) * scale;
      const deltaY = (dragged ? -dragY : event.clientY - rect.top - rect.height / 2) * scale;
      pointer = undefined;
      this.mapImage.style.transform = '';
      this.mapPreview.classList.remove(styles.previewDragging);
      this.setCenter(panRichMessageMapCenter(
        {latitude: this.latitude, longitude: this.longitude},
        deltaX,
        deltaY,
        this.previewZoom
      ));
    };
    this.listenerSetter.add(this.mapPreview)('pointerup', finishPointer);
    this.listenerSetter.add(this.mapPreview)('pointercancel', (event) => {
      if(!pointer || pointer.id !== event.pointerId) return;
      pointer = undefined;
      this.mapImage.style.transform = '';
      this.mapPreview.classList.remove(styles.previewDragging);
    });
    this.listenerSetter.add(this.mapPreview)('keydown', (event) => {
      const step = event.shiftKey ? 80 : 32;
      const delta = event.key === 'ArrowLeft' ? [-step, 0] :
        event.key === 'ArrowRight' ? [step, 0] :
        event.key === 'ArrowUp' ? [0, -step] :
        event.key === 'ArrowDown' ? [0, step] :
        undefined;
      if(delta) {
        event.preventDefault();
        this.setCenter(panRichMessageMapCenter(
          {latitude: this.latitude, longitude: this.longitude},
          delta[0],
          delta[1],
          this.previewZoom
        ));
      } else if(event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.setZoom(this.previewZoom + 1);
      } else if(event.key === '-') {
        event.preventDefault();
        this.setZoom(this.previewZoom - 1);
      }
    });
  }

  private setCenter(center: {latitude: number, longitude: number}) {
    const normalized = normalizeRichMessageMapCenter(center);
    this.accuracyRadius = undefined;
    this.latitude = normalized.latitude;
    this.longitude = normalized.longitude;
    this.renderPreview();
  }

  private renderPreview() {
    this.coordinates.textContent = [
      this.latitude.toFixed(6),
      this.longitude.toFixed(6),
      `z ${this.previewZoom}`
    ].join(', ');
    this.mapImage.replaceChildren();
    const image = document.createElement('div');
    image.classList.add(styles.photo);
    image.style.position = 'relative';
    image.style.overflow = 'hidden';
    image.append(...this.createTiles(), this.createAttribution());
    this.mapImage.append(image);
  }

  /**
   * The preview is cut from OpenStreetMap tiles rather than Telegram's web file: the server only
   * serves a map for a point it already knows (a real `access_hash`), so a freshly picked one would
   * never load. Tiles are laid out in percents of the preview box, so it scales with the popup.
   */
  private createTiles() {
    const tileSize = 256;
    const zoom = this.previewZoom;
    const tilesPerSide = 2 ** zoom;
    const worldSize = tileSize * tilesPerSide;
    const normalized = normalizeRichMessageMapCenter({latitude: this.latitude, longitude: this.longitude});
    const sine = Math.sin(normalized.latitude * Math.PI / 180);
    const centerX = (normalized.longitude + 180) / 360 * worldSize;
    const centerY = (.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize;
    const left = centerX - this.mapWidth / 2;
    const top = centerY - this.mapHeight / 2;

    const tiles: HTMLElement[] = [];
    for(let tileY = Math.floor(top / tileSize); tileY <= Math.floor((top + this.mapHeight) / tileSize); ++tileY) {
      if(tileY < 0 || tileY >= tilesPerSide) continue;
      for(let tileX = Math.floor(left / tileSize); tileX <= Math.floor((left + this.mapWidth) / tileSize); ++tileX) {
        const tile = document.createElement('img');
        tile.draggable = false;
        tile.alt = '';
        tile.referrerPolicy = 'origin';
        tile.src = `https://tile.openstreetmap.org/${zoom}/${((tileX % tilesPerSide) + tilesPerSide) % tilesPerSide}/${tileY}.png`;
        tile.style.cssText = [
          'position:absolute',
          'display:block',
          'user-select:none',
          `left:${(tileX * tileSize - left) / this.mapWidth * 100}%`,
          `top:${(tileY * tileSize - top) / this.mapHeight * 100}%`,
          `width:${tileSize / this.mapWidth * 100}%`,
          `height:${tileSize / this.mapHeight * 100}%`
        ].join(';');
        tiles.push(tile);
      }
    }

    return tiles;
  }

  private createAttribution() {
    const attribution = document.createElement('a');
    attribution.href = 'https://www.openstreetmap.org/copyright';
    attribution.target = '_blank';
    attribution.rel = 'noopener noreferrer';
    attribution.textContent = '© OpenStreetMap';
    attribution.style.cssText = 'position:absolute;inset-inline-end:.25rem;bottom:.125rem;font-size:.625rem;' +
      'color:#333;background:rgba(255,255,255,.7);padding:0 .25rem;border-radius:.25rem;text-decoration:none;pointer-events:auto';
    return attribution;
  }

  public destroy() {
    this.destroyed = true;
    this.listenerSetter.removeAll();
  }
}

export default function showRichMessageLocationPicker(
  options: RichMessageLocationPickerOptions = {}
): Promise<ChatInputMapOptions> {
  return new Promise((resolve, reject) => {
    let settled = false;
    createPopup(() => {
      const content = new RichMessageLocationContent(options);
      onCleanup(() => content.destroy());
      return (
        // `popup-rich-map` is what the e2e suite finds the box by; the look is the module's
        <PopupElement class={`popup-rich-map ${styles.popup}`} closable onClose={() => {
          content.destroy();
          if(!settled) reject();
        }}>
          <PopupElement.Header>
            <PopupElement.CloseButton />
            <PopupElement.Title>{i18n(options.editing ? 'Chat.Input.Editor.Map.EditTitle' : 'Chat.Input.Editor.Map.Title')}</PopupElement.Title>
          </PopupElement.Header>
          <PopupElement.Body>{content.body}</PopupElement.Body>
          <PopupElement.Footer>
            <PopupElement.FooterButton confirm langKey={options.editing ? 'Save' : 'Create'} callback={() => {
              settled = true;
              resolve(content.getMap());
            }} />
          </PopupElement.Footer>
        </PopupElement>
      );
    });
  });
}
