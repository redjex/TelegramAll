import {beforeEach, describe, expect, it, vi} from 'vitest';

const state = vi.hoisted(() => ({media: {isMobile: false, isLessThanFloatingLeftSidebar: false}}));
vi.mock('@helpers/mediaSizes', () => ({default: state.media}));
vi.mock('@lib/rootScope', () => ({default: {addEventListener: vi.fn()}}));
vi.mock('@helpers/appWindow', () => ({getAppWindow: () => window}));
vi.mock('@helpers/schedulers/throttle', () => ({default: (fn: () => void) => fn}));

describe('adaptive information sidebar', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    state.media.isMobile = false;
    state.media.isLessThanFloatingLeftSidebar = false;
  });

  it.each([
    {width: 1200, left: 360, right: 360, folders: true, floats: false, threshold: 1184},
    {width: 1183, left: 360, right: 360, folders: true, floats: true, threshold: 1184},
    {width: 1024, left: 0, right: 360, folders: true, floats: false, threshold: 904},
    {width: 1200, left: 480, right: 480, folders: true, floats: true, threshold: 1424},
    {width: 900, left: 360, right: 360, folders: false, floats: false, threshold: 744},
    {width: 700, left: 360, right: 360, folders: false, floats: true, threshold: 744},
    {width: 480, left: 360, right: 360, folders: false, floats: true, threshold: 1344}
  ])('reserves usable message space at $width px ($left / $right)', async({width, left, right, folders, floats, threshold}) => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: width});
    state.media.isMobile = width <= 600;
    state.media.isLessThanFloatingLeftSidebar = width <= 925;
    const columns = await import('@helpers/updateColumnWidths');
    columns.setUserPreferredLeft(left);
    columns.setUserPreferredRight(right);
    columns.setFoldersSidebarShown(folders);
    expect(document.body.classList.contains('right-column-floats')).toBe(floats);
    expect(columns.canShowRightSidebar()).toBe(state.media.isMobile || !floats);
    expect(document.documentElement.style.getPropertyValue('--right-sidebar-fits')).toBe(threshold + 'px');
  });

  it('notifies when resizing or changing sidebar widths makes the panel unavailable', async() => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1200});
    const columns = await import('@helpers/updateColumnWidths');
    columns.setFoldersSidebarShown(true);
    const listener = vi.fn();
    const dispose = columns.onRightSidebarAvailabilityChange(listener);
    expect(listener).toHaveBeenLastCalledWith(true);
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1150});
    columns.default();
    expect(listener).toHaveBeenLastCalledWith(false);
    columns.default();
    expect(listener).toHaveBeenCalledTimes(2);
    columns.setUserPreferredLeft(0);
    expect(listener).toHaveBeenLastCalledWith(true);
    dispose();
    columns.setUserPreferredRight(480);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('hides a desktop overlay after growing out of the mobile profile screen', async() => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 480});
    state.media.isMobile = true;
    state.media.isLessThanFloatingLeftSidebar = true;
    const columns = await import('@helpers/updateColumnWidths');
    const listener = vi.fn();
    columns.onRightSidebarAvailabilityChange(listener);
    expect(listener).toHaveBeenLastCalledWith(true);
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 700});
    state.media.isMobile = false;
    columns.default();
    expect(document.body.classList.contains('right-column-floats')).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(false);
  });
});
