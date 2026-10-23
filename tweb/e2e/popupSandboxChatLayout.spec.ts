import {expect} from '@playwright/test';
import {test} from './workerContext';
import {closeStory, openStory, preparePopupSandbox} from './popupSandbox.helpers';

for(const direction of ['ltr', 'rtl'] as const) {
  test(`conversation fits between sidebars (${direction})`, async({page}) => {
    await page.setViewportSize({width: 1200, height: 900});
    await preparePopupSandbox(page, false);
    expect(await openStory(page, 'chatPreview')).toBeNull();
    await expect(page.locator('.popup-chat-preview .chat')).toBeVisible();
    await page.evaluate(async(direction) => {
      window.popupSandbox.setDirection(direction);
      const modulePath = '/src/helpers/updateColumnWidths.ts';
      const widths = await import(modulePath);
      (window as any).layoutWidths = widths;
      const sidebarModule = '/src/components/sidebarRight/index.ts';
      const imModule = '/src/lib/appImManager.ts';
      const sidebar = (await import(sidebarModule)).default;
      // Only tab navigation is stubbed; real sidebar state, resize and inert handling run.
      (await import(imModule)).default.selectTab = () => Promise.resolve();
      sidebar.construct({});
      (window as any).layoutSidebar = sidebar;
      const clone = document.querySelector('.popup-chat-preview .chat').cloneNode(true) as HTMLElement;
      clone.classList.remove('chat-preview');
      clone.querySelector('.topbar').classList.remove('hide');
      clone.querySelector('.chat-input-main').classList.remove('hide');
      const center = document.getElementById('column-center');
      center.innerHTML = '<div class="chats-container tabs-container"></div>';
      center.firstElementChild.append(clone);
      document.getElementById('page-chats').style.display = 'flex';
      document.getElementById('column-left').classList.add('active');
      center.classList.add('active');
      document.getElementById('column-right').classList.add('active');
      const message = document.createElement('div');
      message.textContent = 'A long test message that must wrap inside the available conversation width. '.repeat(8);
      message.style.cssText = 'background:white;color:black;border-radius:16px;padding:12px;overflow-wrap:anywhere';
      clone.querySelector('.bubbles-inner').append(message);
      widths.installColumnWidthsUpdater();
      document.body.classList.remove('is-left-column-shown');
    }, direction);
    expect(await closeStory(page, {})).toBe(true);

    for(const options of [
      {width: 1200, left: 360, right: 360, folders: true, floats: false},
      {width: 1600, left: 480, right: 480, folders: true, floats: false},
      {width: 1024, left: 0, right: 360, folders: true, floats: false},
      {width: 900, left: 360, right: 360, folders: false, floats: false},
      {width: 1100, left: 360, right: 360, folders: true, floats: true},
      {width: 480, left: 360, right: 360, folders: false, floats: true}
    ]) {
      await page.setViewportSize({width: options.width, height: 900});
      await page.waitForTimeout(100);
      await page.evaluate(({left, right, folders}) => {
        const widths = (window as any).layoutWidths;
        widths.setUserPreferredLeft(left);
        widths.setUserPreferredRight(right);
        widths.setFoldersSidebarShown(folders);
        document.body.classList.toggle('has-folders-sidebar', folders);
        if(widths.canShowRightSidebar()) document.body.classList.add('is-right-column-shown');
        else (window as any).layoutSidebar.toggleSidebar(true);
        widths.default();
      }, options);
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => document.body.classList.contains('right-column-floats'))).toBe(options.floats);
      if(options.floats && options.width > 600) {
        await expect(page.locator('#column-right')).toBeHidden();
        expect(await page.evaluate(() => document.body.classList.contains('is-right-column-shown'))).toBe(false);
        continue;
      }
      if(options.width <= 600) continue;

      const center = await page.locator('#column-center').boundingBox();
      const right = await page.locator('#column-right').boundingBox();
      expect(center.width).toBeGreaterThanOrEqual(320);
      if(direction === 'ltr') expect(center.x + center.width).toBeLessThanOrEqual(right.x - 15);
      else expect(center.x).toBeGreaterThanOrEqual(right.x + right.width + 15);
      for(const selector of ['.topbar', '.bubbles-inner', '.chat-input-main']) {
        const box = await page.locator('#column-center ' + selector).first().boundingBox();
        expect(box, selector).not.toBeNull();
        expect(box.width).toBeGreaterThan(200);
        expect(box.x).toBeGreaterThanOrEqual(center.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(center.x + center.width + 1);
      }
      if(options.width === 1200) await page.screenshot({path: `tmp/chat-adaptive-${direction}.png`});
      await page.evaluate(() => document.body.classList.remove('is-right-column-shown'));
      await page.waitForTimeout(400);
      expect((await page.locator('#column-center').boundingBox()).width).toBeGreaterThan(center.width);
      if(options.width === 1200) {
        await page.evaluate(() => {
          document.body.classList.add('is-right-column-shown');
          document.getElementById('column-right').inert = false;
        });
        await page.setViewportSize({width: 1150, height: 900});
        await expect(page.locator('#column-right')).toBeHidden();
        expect(await page.evaluate(() => document.getElementById('column-right').inert)).toBe(true);
        expect(await page.evaluate(() => document.body.classList.contains('is-right-column-shown'))).toBe(false);
        // A click cannot reopen it while the viewport remains too small.
        await page.evaluate(() => (window as any).layoutSidebar.toggleSidebar(true));
        expect(await page.evaluate(() => document.body.classList.contains('is-right-column-shown'))).toBe(false);
        await page.setViewportSize({width: 1200, height: 900});
        expect(await page.evaluate(() => document.body.classList.contains('is-right-column-shown'))).toBe(false);
      }
    }
  });
}
