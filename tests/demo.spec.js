import { test, expect } from '@playwright/test';
import { setWheelScore } from './helpers/wheel.js';

test('デモモード: 登録なしで体験でき、記録もできる', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#auth-email', { timeout: 10000 });

  await page.click('button:has-text("登録せずに試してみる")');
  await page.waitForSelector('#screen-home.active', { timeout: 10000 });

  // バナーとサンプルデータが表示される
  await expect(page.locator('#demo-banner')).toBeVisible();
  await expect(page.locator('.match-card').first()).toBeVisible();
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty(); // 選手2人で切替UIあり

  // 分析画面に実データが出る
  await page.click('#nav-analysis');
  await expect(page.locator('#analysis-content')).toBeVisible();
  await expect(page.locator('#type-chart .type-row').first()).toBeVisible(); // 戦型別バーが出る

  // デモ中でも試合を記録できる（メモリ内）
  const before = await page.locator('.match-card').count();
  await page.click('#nav-record');
  await page.fill('#opponent-name', 'デモ対戦相手');
  await setWheelScore(page, 0, 'my', 11);
  await setWheelScore(page, 1, 'my', 11);
  await setWheelScore(page, 2, 'my', 11);
  await page.click('button.submit-btn');
  await page.waitForSelector('#screen-home.active', { timeout: 10000 });
  await page.waitForTimeout(600);
  if (await page.locator('#confirm-modal.show').isVisible().catch(() => false)) {
    await page.click('#confirm-modal button:has-text("追加しない")').catch(() => {});
  }
  await expect(page.locator('#match-list')).toContainText('デモ対戦相手');

  // 「登録して始める」でログイン画面に戻る
  await page.click('#demo-banner button');
  await page.waitForSelector('#auth-email', { timeout: 10000 });
});
