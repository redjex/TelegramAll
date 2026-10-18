import getStream from '@lib/calls/helpers/getStream';
import appImManager from '@lib/appImManager';
import {toastNew} from '@components/toast';
import applyLiquidGlass from '@helpers/liquidGlass';
import makeIcon from '@components/icon';

/**
 * "Scan QR Code": the camera over the whole screen, and the first Telegram link (t.me/..., tg://...) the
 * system's barcode detector finds in it is opened. The detector is what Chrome gives the page (Android
 * WebView has it where Google's barcode module is there); without it the button says it cannot.
 */
export default async function openAndroidQrScanner() {
  const Detector = (window as any).BarcodeDetector;
  if(!Detector) {
    toastNew({langPackKey: 'Error.AnError'});
    return;
  }

  let stream: MediaStream;
  try {
    stream = await getStream({video: {facingMode: 'environment'}});
  } catch{
    toastNew({langPackKey: 'Error.AnError'});
    return;
  }

  const detector = new Detector({formats: ['qr_code']});
  const root = document.createElement('div');
  root.className = 'android-qr-scanner';
  root.innerHTML = '<video playsinline muted autoplay></video><div class="android-qr-scanner-frame"></div>' +
    '<button class="android-qr-scanner-close" aria-label="Close"></button>' +
    '<div class="android-qr-scanner-hint">Point your camera at a Telegram QR code</div>';
  const video = root.querySelector('video');
  const close = root.querySelector<HTMLElement>('.android-qr-scanner-close');
  video.srcObject = stream;
  document.body.append(root);
  const stopGlass = applyLiquidGlass(close);
  close.append(makeIcon('close'));

  let stopped = false;
  const stop = () => {
    if(stopped) return;
    stopped = true;
    stopGlass();
    stream.getTracks().forEach((track) => track.stop());
    root.remove();
  };

  close.addEventListener('click', stop);

  const scan = async() => {
    if(stopped) return;
    try {
      const codes = await detector.detect(video);
      const link = codes.map((code: any) => String(code.rawValue)).find((value: string) => /^(https?:\/\/(t|telegram)\.me\/|tg:)/i.test(value));
      if(link) {
        stop();
        appImManager.openUrl(link);
        return;
      }
    } catch{}

    setTimeout(scan, 250);
  };

  video.addEventListener('playing', scan, {once: true});
}
