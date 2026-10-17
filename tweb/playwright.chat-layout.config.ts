import {defineConfig, devices} from '@playwright/test';
import path from 'node:path';
import {playwrightWorkers} from './scripts/testQueue';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'chatLeftLayout.spec.ts',
  workers: playwrightWorkers(1),
  globalSetup: path.join(__dirname, 'scripts/testQueue.ts'),
  use: {headless: true, viewport: {width: 1920, height: 850}},
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}]
});
