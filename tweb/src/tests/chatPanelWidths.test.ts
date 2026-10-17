const media = vi.hoisted(() => ({
  isMobile: false,
  isLessThanFloatingLeftSidebar: false,
  addEventListener: vi.fn()
}));

vi.mock('@helpers/mediaSizes', () => ({default: media}));
vi.mock('@lib/rootScope', () => ({default: {addEventListener: vi.fn()}}));
vi.mock('@helpers/appWindow', () => ({getAppWindow: () => window}));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="column-center"></div>';
  document.documentElement.removeAttribute('style');
});

it.each([
  {width: 1280, folders: true, mobile: false, floats: false},
  {width: 1200, folders: true, mobile: false, floats: false},
  {width: 1100, folders: true, mobile: false, floats: true},
  {width: 900, folders: false, mobile: false, floats: false},
  {width: 650, folders: false, mobile: false, floats: true},
  {width: 390, folders: false, mobile: true, floats: true}
])('reserves information-panel space only when the chat can fit ($width px)', async({width, folders, mobile, floats}) => {
  Object.defineProperty(window, 'innerWidth', {configurable: true, value: width});
  media.isMobile = mobile;
  media.isLessThanFloatingLeftSidebar = width <= 925;
  const {default: updateColumnWidths, setFoldersSidebarShown} = await import('@helpers/updateColumnWidths');
  setFoldersSidebarShown(folders);
  updateColumnWidths();
  expect(document.body.classList.contains('right-column-floats')).toBe(floats);
});
