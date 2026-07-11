import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';
import { setWheelScore } from './helpers/wheel.js';

test('試合編集フロー: 更新ボタンのデバッグ', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));
  page.on('dialog', async d => {
    errors.push(`[dialog] ${d.message()}`);
    await d.accept();
  });

  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  // 試合を1件記録しておく
  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  const opponentName = `編集デバッグ-${Date.now()}`;
  await page.fill('#opponent-name', opponentName);
  await setWheelScore(page, 0, 'my', 11);
  await setWheelScore(page, 1, 'my', 11);
  await setWheelScore(page, 2, 'my', 11);
  await page.click('button.submit-btn');
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });

  // アドレス帳確認ポップアップが出たら閉じる
  await page.waitForTimeout(800);
  if (await page.locator('#confirm-modal.show').isVisible().catch(() => false)) {
    await page.click('#confirm-modal button:has-text("追加しない")').catch(() => {});
    await page.waitForTimeout(300);
  }

  // 詳細モーダルを開いて「編集する」
  await page.click(`.match-card:has-text("${opponentName}")`);
  await page.waitForSelector('#modal.show');
  await page.click('button:has-text("編集する")');
  await page.waitForSelector('#screen-record.active', { timeout: 10000 });

  const nameVal = await page.inputValue('#opponent-name');
  console.log('編集フォームの相手名:', nameVal);

  await page.fill('#match-memo', '編集後のメモ');
  const btnText = await page.textContent('button.submit-btn');
  console.log('ボタン表示:', btnText);
  await page.click('button.submit-btn');

  const backHome = await page.waitForSelector('#screen-home.active', { timeout: 10000 })
    .then(() => true).catch(() => false);
  console.log('ホームに戻った:', backHome);
  console.log('捕捉したエラー:', JSON.stringify(errors, null, 2));

  expect(backHome, `エラー: ${errors.join(' / ')}`).toBe(true);
});
