import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';
import { setWheelScore } from './helpers/wheel.js';

test('試合を記録するとホーム画面に表示される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');

  const opponentName = `テスト相手-${Date.now()}`;
  await page.fill('#opponent-name', opponentName);
  await setWheelScore(page, 0, 'my', 11);
  await setWheelScore(page, 1, 'my', 11);
  await setWheelScore(page, 2, 'my', 11);

  await page.click('button.submit-btn');

  await page.waitForSelector('#screen-home.active', { timeout: 10000 });
  await expect(page.locator('#match-list')).toContainText(opponentName, { timeout: 10000 });
});

test('リロード後も試合が表示される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });
  await page.waitForTimeout(2000); // データ取得待ち
  const initialCount = await page.locator('.match-card').count();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active');
  await expect(page.locator('.match-card')).toHaveCount(initialCount, { timeout: 10000 });
});
