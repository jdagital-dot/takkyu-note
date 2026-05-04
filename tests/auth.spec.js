import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test.describe('Auth', () => {
  test('メール+パスワードでログインしてホームに遷移', async ({ page }) => {
    page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('[browser-error]', err.message));
    await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('ログアウトでログイン画面に戻る', async ({ page }) => {
    await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
    await page.click('button:has-text("ログアウト")');
    // 即時にログイン画面に戻ることを確認（5秒以内）
    await expect(page.locator('#screen-auth')).toBeVisible({ timeout: 5000 });
    // 再ログインできることも確認
    await page.fill('#auth-email', process.env.TEST_EMAIL);
    await page.fill('#auth-password', process.env.TEST_PASSWORD);
    await page.click('button:has-text("ログイン")');
    await expect(page.locator('#screen-home')).toHaveClass(/active/, { timeout: 15000 });
  });
});
