import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import keepHoverPreviewOpen from '@helpers/dom/keepHoverPreviewOpen';

describe('hover preview lifetime', () => {
  let source: HTMLElement, preview: HTMLElement, content: HTMLElement;
  let dispose: () => void;
  const onClose = vi.fn();
  const pointer = (target: EventTarget, type: string, relatedTarget?: EventTarget, pointerType = 'mouse') => {
    const event = new MouseEvent(type, {bubbles: true, relatedTarget});
    Object.defineProperty(event, 'pointerType', {value: pointerType});
    target.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    onClose.mockReset();
    source = document.createElement('a');
    source.innerHTML = '<span>Avatar</span><span>Title</span>';
    preview = document.createElement('div');
    content = document.createElement('div');
    preview.append(content);
    document.body.append(source, preview);
    dispose = keepHoverPreviewOpen({source, preview, onClose});
  });

  afterEach(() => {
    dispose();
    source.remove();
    preview.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the preview over any part of its source row', () => {
    pointer(source.firstChild, 'pointerout', source.lastChild);
    pointer(source.lastChild, 'pointerover', source.firstChild);
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes 200 ms after leaving the source and preview', () => {
    pointer(source, 'pointerout', document.body);
    vi.advanceTimersByTime(199);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('lets the pointer cross the gap and stay inside the preview', () => {
    pointer(source, 'pointerout', document.body);
    vi.advanceTimersByTime(100);
    pointer(content, 'pointerover', document.body);
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows returning from the preview to the source row', () => {
    pointer(content, 'pointerout', document.body);
    vi.advanceTimersByTime(100);
    pointer(source, 'pointerover', document.body);
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not reset the close timer while moving outside both regions', () => {
    pointer(source, 'pointerout', document.body);
    vi.advanceTimersByTime(150);
    pointer(document.body, 'pointerover');
    vi.advanceTimersByTime(50);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when leaving the app window', () => {
    pointer(preview, 'pointerout');
    vi.advanceTimersByTime(200);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('allows scrolling inside the preview', () => {
    content.dispatchEvent(new Event('scroll'));
    content.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: 200}));
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the source list scrolls', () => {
    source.parentElement.dispatchEvent(new Event('scroll'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps clicks inside the preview or source and closes on an outside click', () => {
    pointer(content, 'pointerdown');
    pointer(source, 'pointerdown');
    expect(onClose).not.toHaveBeenCalled();
    pointer(document.body, 'pointerdown');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes only once and removes listeners', () => {
    pointer(document.body, 'pointerdown');
    pointer(document.body, 'pointerdown');
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels pending closure and removes listeners on disposal', () => {
    pointer(source, 'pointerout', document.body);
    dispose();
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores touch pointer transitions', () => {
    pointer(source, 'pointerout', document.body, 'touch');
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });
});
