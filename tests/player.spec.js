import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('選手追加 → 切替UIに反映される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  const newName = `次郎-${Date.now()}`;
  await page.click('#player-switcher-mount button');
  await page.click('text=＋ 選手を追加');
  await page.fill('#player-edit-name', newName);
  await page.selectOption('#player-edit-grade', '11');
  await page.click('#player-edit-content button:has-text("登録する")');
  await expect(page.locator('#player-switcher-mount')).toContainText(newName);
});
