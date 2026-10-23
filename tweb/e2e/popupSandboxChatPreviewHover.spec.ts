import {expect} from '@playwright/test';
import {test} from './workerContext';
import {closeStory, openStory, preparePopupSandbox} from './popupSandbox.helpers';

for(const direction of ['ltr', 'rtl'] as const) {
  test(`chat avatar receives mouse hover and opens an unread preview (${direction})`, async({page}) => {
    await page.setViewportSize({width: 1280, height: 900});
    await preparePopupSandbox(page, false, {a11y: true});
    expect(await openStory(page, 'chatPreview')).toBeNull();
    expect(await closeStory(page, {})).toBe(true);

    await page.evaluate(async(direction) => {
      window.popupSandbox.setDirection(direction);
      const dialogsModule = '/src/lib/appDialogsManager.ts';
      const fixturesModule = '/src/components/popupSandbox/fixtures.ts';
      const [{DialogElement, default: manager}, {CONTACT_PEER_ID, PREMIUM_PEER_ID}] = await Promise.all([
        import(dialogsModule), import(fixturesModule)
      ]);
      const list = manager.createChatList();
      list.id = 'hover-preview-list';
      list.classList.add('sidebar-left');
      list.style.cssText = 'position:fixed;inset-block-start:100px;inset-inline-start:0;width:300px;height:150px;z-index:10';
      const dialog = new DialogElement({peerId: CONTACT_PEER_ID, controlled: true, isMainList: true});
      const other = new DialogElement({peerId: PREMIUM_PEER_ID, controlled: true, isMainList: true});
      list.append(dialog.container, other.container);
      document.body.append(list);
      manager.setListClickListener({list, selection: {isSelecting: false}});
    }, direction);

    const avatar = page.locator('#hover-preview-list .dialog-avatar').first();
    await expect(avatar).toBeVisible();
    const bounds = await avatar.boundingBox();
    const point = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
    // Dispatching pointerover straight to the element bypasses CSS hit testing and
    // misses pointer-events:none. The actual styled DialogElement must receive it.
    expect(await page.evaluate(({x, y}) => !!document.elementFromPoint(x, y)?.closest('#hover-preview-list .dialog-avatar'), point)).toBe(true);

    const popup = page.locator('.popup-chat-preview.active');
    const callsStart = await page.evaluate(() => window.popupSandbox.calls().length);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(300);
    await expect(popup).toHaveCount(0);
    await expect(popup).toBeVisible();
    const previewBounds = await popup.locator('.popup-container').boundingBox();
    expect(previewBounds.x).toBeGreaterThanOrEqual(0);
    expect(previewBounds.x + previewBounds.width).toBeLessThanOrEqual(1280);
    const readWrites = await page.evaluate((start) => window.popupSandbox.calls().slice(start)
    .filter(({method}) => /^(readHistory|markDialogUnread|readMessages|readMessageContents)$/.test(method)), callsStart);
    expect(readWrites).toEqual([]);

    // Moving from the avatar across the rest of the contact's card keeps it open.
    const rowBounds = await page.locator('#hover-preview-list a').first().boundingBox();
    await page.mouse.move(rowBounds.x + rowBounds.width / 2, point.y, {steps: 5});
    await page.waitForTimeout(350);
    await expect(popup).toBeVisible();
    // Cross the actual 8px gap, then hover the preview long enough to expose a stale timer.
    const edge = direction === 'ltr' ? rowBounds.x + rowBounds.width : rowBounds.x;
    const popupEdge = direction === 'ltr' ? previewBounds.x : previewBounds.x + previewBounds.width;
    await page.mouse.move((edge + popupEdge) / 2, point.y);
    await page.waitForTimeout(80);
    await page.mouse.move(popupEdge + (direction === 'ltr' ? 20 : -20), point.y);
    await page.waitForTimeout(350);
    await expect(popup).toBeVisible();

    // Use the real chat's scrolling element, with enough fixture content to scroll.
    const scroller = popup.locator('.bubbles-scrollable');
    await scroller.evaluate((element) => {
      const filler = document.createElement('div');
      filler.style.height = '1800px';
      element.querySelector('.bubbles-inner').append(filler);
      element.scrollTop = 0;
    });
    const scrollBounds = await scroller.boundingBox();
    await page.mouse.move(scrollBounds.x + scrollBounds.width / 2, scrollBounds.y + scrollBounds.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.waitForTimeout(350);
    await expect(popup).toBeVisible();

    await page.mouse.move(640, 850);
    await expect(page.locator('.popup-chat-preview')).toHaveCount(0);
    // Keyboard/context-menu previews keep their existing explicit-close lifecycle.
    await page.locator('#hover-preview-list a').first().click({modifiers: ['Shift']});
    await expect(popup).toBeVisible();
    await page.mouse.move(640, 850);
    await page.waitForTimeout(350);
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.popup-chat-preview')).toHaveCount(0);

    // Reset the cursor, then leave the avatar before the delay expires.
    await page.mouse.move(640, 20);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(200);
    await page.mouse.move(640, 20);
    await page.waitForTimeout(550);
    await expect(popup).toHaveCount(0);

    // Switch directly to another avatar and keep still: no leave/re-enter is required.
    await avatar.hover();
    await expect(popup).toBeVisible();
    const previewContent = popup.locator('.popup-container');
    await expect(previewContent).toHaveAttribute('data-peer-id', '777002');
    await page.locator('#hover-preview-list .dialog-avatar').nth(1).hover();
    await expect(popup).toBeVisible();
    await expect(previewContent).toHaveAttribute('data-peer-id', '777003');
    await expect(popup).toHaveCount(1);
    // Returning directly to the first avatar must work too.
    await avatar.hover();
    await expect(previewContent).toHaveAttribute('data-peer-id', '777002');
    await page.waitForTimeout(600);
    await expect(popup).toHaveCount(1);
    await page.mouse.move(640, 850);
    await expect(page.locator('.popup-chat-preview')).toHaveCount(0);
  });
}
