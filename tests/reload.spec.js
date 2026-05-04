import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('リロードでログイン状態が維持される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
});

test('ログイン後、選手切替UIが表示される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  const switcher = page.locator('#player-switcher-mount');
  await expect(switcher).not.toBeEmpty({ timeout: 10000 });
});

test('リロード後も選手切替UIが表示される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  // 初回ログイン後、Supabaseから選手リストが取れてキャッシュに保存されるまで待つ
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });
  // リロード
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
  // リロード直後（キャッシュからの即時描画）でも switcher は表示される
  const switcher = page.locator('#player-switcher-mount');
  await expect(switcher).not.toBeEmpty({ timeout: 5000 });
});

test('リロード直後でも試合カードが表示される（matchがある場合）', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  // 既存試合の数を確認
  const initialCount = await page.locator('.match-card').count();
  if (initialCount === 0) {
    test.skip(true, 'no matches in localStorage yet');
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
  // matchカードが initialCount と同じだけ表示されること
  await expect(page.locator('.match-card')).toHaveCount(initialCount, { timeout: 10000 });
});
