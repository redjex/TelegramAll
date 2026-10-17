import {expect, test, type Page} from '@playwright/test';
import {compile} from 'sass';
import path from 'node:path';

// Real application styles, isolated from Telegram sessions and network writes.
let css: string;
test.beforeAll(() => {
  css = compile(path.resolve('src/scss/style.scss'), {logger: {warn() {}, debug() {}}}).css;
});

function bubble(text: string, out = false, extra = '') {
  return `<div class="bubble ${out ? 'is-out' : 'is-in'} is-group-first is-group-last can-have-tail ${extra}">
    <div class="bubble-content-wrapper"><div class="bubble-content"><div class="message" dir="auto">${text}</div>
      <svg class="bubble-tail"><path d="M11 0v20H0z" /></svg>
      <button class="bubble-beside-button">↗</button>
    </div></div></div>`;
}

function group(content: string, name: string) {
  return `<div class="bubbles-group has-avatar">${content}<div class="bubbles-group-avatar-container">
    <div class="avatar avatar-like user-avatar bubbles-group-avatar" style="--size:40px;background:#5288c1;border-radius:50%">${name}</div>
  </div></div>`;
}

async function openFixture(page: Page, direction: 'ltr' | 'rtl', width: number, right = false) {
  await page.setViewportSize({width, height: 850});
  await page.setContent(`<!doctype html><html dir="${direction}" class="no-touch ${direction === 'rtl' ? 'is-rtl' : ''}">
    <head><style>${css}</style></head>
    <body class="night animation-level-0 ${right ? 'is-right-column-shown' : ''}" style="
      --page-chats-padding:16px;--left-column-width:360px;--left-column-visual-width:360px;--folders-sidebar-offset:80px;
      --right-column-width:360px;--chat-width:696px;--primary-color:#5288c1;--primary-text-color:#fff;--secondary-text-color:#8798a5;
      --surface-color:#17212b;--message-background-color:#1e2c38;--message-out-background-color:#2b5278;
      --message-time-color:#91a3b5;--message-status-color:#91a3b5;--message-out-time-color:#91a3b5;--message-out-status-color:#91a3b5;
      background:#0e1621;color:#fff;margin:0">
    <div class="page-chats" style="height:100vh;width:100%"><div id="main-columns">
      <div id="column-left" class="main-column" style="background:#17212b"><div style="padding:24px">Список чатов</div></div>
      <div id="column-center" class="main-column"><div class="chats-container tabs-container"><div class="chat tabs-tab active">
        <div class="topbar sidebar-header has-avatar"><div class="chat-info-container">
          <div class="avatar avatar-like" style="--size:40px;background:#5288c1;border-radius:50%">M</div>
          <div class="chat-info"><div class="user-title">Mars</div><div class="info">был(а) недавно</div></div>
          <div class="chat-utils"><button class="btn-icon">⋮</button></div>
        </div></div>
        <div class="bubbles"><div class="bubbles-scrollable scrollable scrollable-y" style="height:100%;overflow:auto">
          <div class="bubbles-inner has-rights" style="padding-block:64px">
            <div class="bubbles-date-group">
              ${group(bubble('Входящее сообщение') + bubble('Ещё одно сообщение'), 'M')}
              ${group(bubble('Мой ответ', true) + bubble('Продолжение ответа', true), 'Я')}
              ${group(bubble('Длинное сообщение '.repeat(40)), 'M')}
              ${group(bubble('<div class="attachment" style="width:400px;max-width:100%;height:90px;background:#34495e">Фото</div>', true, 'photo'), 'Я')}
            </div>
          </div>
        </div></div>
        <div class="chat-input chat-input-main"><div class="chat-input-container"><div class="chat-input-wrapper">
          <div class="rows-wrapper-wrapper"><div class="chat-rows-wrapper"><div class="message-input-field" contenteditable="true" style="padding:12px">Сообщение…</div></div></div>
        </div></div></div>
      </div></div></div>
    </div></div></body></html>`);
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width};
    };
    const rects = [...document.querySelectorAll('.bubble-content-wrapper')].map((node) => {
      const box = node.getBoundingClientRect();
      return {left: box.left, right: box.right, width: box.width};
    });
    return {center: rect('#column-center'), header: rect('.topbar'), input: rect('.chat-input-main'),
      sidebar: rect('#column-left'), avatar: rect('.bubbles-group-avatar'), messages: rects,
      overflow: document.documentElement.scrollWidth > innerWidth};
  });
}

for(const direction of ['ltr', 'rtl'] as const) {
  for(const right of [false, true]) {
    test(`full-width desktop chat, shared author edge (${direction}, right=${right})`, async({page}, testInfo) => {
      await openFixture(page, direction, 1920, right);
      const boxes = await geometry(page);
      const edge = direction === 'ltr' ? 'left' : 'right';
      expect(boxes.center[edge]).toBeCloseTo(boxes.sidebar[direction === 'ltr' ? 'right' : 'left'], 0);
      expect(boxes.header.left).toBeCloseTo(boxes.center.left, 0);
      expect(boxes.header.right).toBeCloseTo(boxes.center.right, 0);
      expect(boxes.input.left).toBeCloseTo(boxes.center.left, 0);
      expect(boxes.input.right).toBeCloseTo(boxes.center.right, 0);
      expect(boxes.input.bottom).toBeCloseTo(850, 0);
      for(const message of boxes.messages) {
        expect(message[edge]).toBeCloseTo(boxes.messages[0][edge], 0);
        expect(message.left).toBeGreaterThanOrEqual(boxes.center.left);
        expect(message.right).toBeLessThanOrEqual(boxes.center.right);
      }
      expect(Math.abs(boxes.avatar[edge] - boxes.center[edge])).toBeLessThan(20);
      expect(boxes.overflow).toBe(false);
      await page.screenshot({path: testInfo.outputPath('chat.png')});
    });
  }
}

test('narrow desktop and mobile keep message avatars clear of text', async({page}) => {
  for(const width of [900, 390]) {
    await openFixture(page, 'ltr', width);
    const boxes = await geometry(page);
    expect(boxes.messages[0].left).toBeGreaterThanOrEqual(boxes.avatar.right + 4);
    for(const message of boxes.messages) {
      expect(message.left).toBeCloseTo(boxes.messages[0].left, 0);
      expect(message.right).toBeLessThanOrEqual(boxes.center.right);
    }
    expect(boxes.overflow).toBe(false);
  }
});

test('selection shifts both authors together and batch text updates do not thrash layout', async({page}) => {
  await openFixture(page, 'ltr', 1920);
  const before = await geometry(page);
  await page.evaluate(() => {
    document.body.classList.replace('animation-level-0', 'animation-level-1');
    document.querySelector('.bubbles').classList.add('is-selecting', 'forwards');
  });
  await expect.poll(async() => (await geometry(page)).messages[0].left).toBeCloseTo(before.messages[0].left + 40, 0);
  const selected = await geometry(page);
  expect(selected.messages[2].left).toBeCloseTo(selected.messages[0].left, 0);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const read = async() => (await cdp.send('Performance.getMetrics')).metrics.find(({name}) => name === 'LayoutCount').value;
  const initial = await read();
  await page.evaluate(async() => {
    for(let i = 0; i < 100; ++i) document.querySelector('.message').textContent = 'Сообщение ' + i;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  expect(await read() - initial).toBeLessThanOrEqual(2);
});
