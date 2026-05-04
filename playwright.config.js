import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default {
  testDir: './tests',
  use: {
    baseURL: 'https://pingpong-app-one.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  timeout: 60000,
  expect: { timeout: 10000 },
};
