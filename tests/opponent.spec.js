import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('アドレス帳に追加 → リロード後も残る', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  await page.click('text=📋 アドレス帳');
  await page.click('button:has-text("＋ 選手を登録")');

  const newName = `テスト選手-${Date.now()}`;
  await page.fill('#ab-name', newName);
  await page.fill('#ab-team', 'テストチーム');
  await page.click('button:has-text("登録する")');
  // 保存後は一覧モードに戻り、登録した選手が表示される
  await expect(page.locator('#ab-content')).toContainText(newName, { timeout: 5000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active');
  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  await page.click('text=📋 アドレス帳');
  await expect(page.locator('#ab-content')).toContainText(newName, { timeout: 5000 });
});
