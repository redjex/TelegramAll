import {beforeEach, describe, expect, it, vi} from 'vitest';

const state = vi.hoisted(() => ({available: true, listener: undefined as (available: boolean) => void}));
const mocks = vi.hoisted(() => ({selectTab: vi.fn(), pauseVideos: vi.fn(), dispatch: vi.fn()}));
vi.mock('@lib/appImManager', () => ({default: {selectTab: mocks.selectTab}, APP_TABS: {CHAT: 1, PROFILE: 2}}));
vi.mock('@components/slider', () => ({default: class {
  sidebarEl: HTMLElement;
  historyTabIds: number[] = [];
  constructor({sidebarEl}: {sidebarEl: HTMLElement}) {this.sidebarEl = sidebarEl;}
  pushNavigationItem() {}
}}));
vi.mock('@helpers/mediaSizes', () => ({default: {addEventListener: vi.fn()}, ScreenSize: {medium: 1, mobile: 0}}));
vi.mock('@components/sidebarRight/tabs/sharedMediaTab', () => ({default: class {}}));
vi.mock('@config/debug', () => ({MOUNT_CLASS_TO: {}}));
vi.mock('@components/appNavigationController', () => ({default: {removeByType: vi.fn(), findItemByType: vi.fn()}}));
vi.mock('@lib/rootScope', () => ({default: {dispatchEventSingle: mocks.dispatch}}));
vi.mock('@helpers/installColumnResize', () => ({default: vi.fn()}));
vi.mock('@components/animationIntersector', () => ({default: {toggleVideosUnder: mocks.pauseVideos}}));
vi.mock('@helpers/updateColumnWidths', () => ({
  canShowRightSidebar: () => state.available,
  installColumnWidthsUpdater: vi.fn(),
  onRightSidebarAvailabilityChange: (callback: typeof state.listener) => {
    state.listener = callback;
    callback(state.available);
    return vi.fn();
  }
}));

describe('right sidebar in a small window', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.available = true;
    state.listener = undefined;
    document.body.className = '';
    document.body.innerHTML = '<div id="column-right"></div>';
    mocks.selectTab.mockResolvedValue(undefined);
  });

  it('closes an open panel through the normal navigation and visibility lifecycle', async() => {
    const {default: sidebar} = await import('@components/sidebarRight');
    sidebar.construct({} as any);
    document.body.classList.add('is-right-column-shown');
    state.available = false;
    state.listener(false);
    expect(document.body.classList.contains('is-right-column-shown')).toBe(false);
    expect(sidebar.sidebarEl.inert).toBe(true);
    expect(mocks.selectTab).toHaveBeenCalledWith(1, false);
    expect(mocks.pauseVideos).toHaveBeenCalledWith(sidebar.sidebarEl, true);
    expect(mocks.dispatch).toHaveBeenCalledWith('right_sidebar_toggle', false);
  });

  it('does not open or load the panel while there is insufficient room', async() => {
    const {default: sidebar} = await import('@components/sidebarRight');
    state.available = false;
    await sidebar.toggleSidebar(true);
    expect(mocks.selectTab).not.toHaveBeenCalled();
    expect(document.body.classList.contains('is-right-column-shown')).toBe(false);
  });

  it('allows opening again after the user enlarges the window', async() => {
    const {default: sidebar} = await import('@components/sidebarRight');
    sidebar.sharedMediaTab = {open: vi.fn()} as any;
    state.available = false;
    await sidebar.toggleSidebar(true);
    state.available = true;
    await sidebar.toggleSidebar(true);
    expect(sidebar.sharedMediaTab.open).toHaveBeenCalledOnce();
    expect(document.body.classList.contains('is-right-column-shown')).toBe(true);
  });
});
