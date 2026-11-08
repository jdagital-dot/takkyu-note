import { test, expect } from '@playwright/test';

// 体験モードで練習ノートを操作する（DB不要）
async function enterDemo(page) {
  await page.goto('/');
  await page.waitForSelector('#auth-email', { timeout: 10000 });
  await page.click('button:has-text("登録せずに試してみる")');
  await page.waitForSelector('#screen-home.active', { timeout: 10000 });
}

test('練習ノート: ナビから開き、サンプルと今週の集計が出る', async ({ page }) => {
  await enterDemo(page);
  await page.click('#nav-practice');
  await expect(page.locator('#screen-practice.active')).toBeVisible();
  await expect(page.locator('#practice-root h1')).toHaveText('練習ノート');
  await expect(page.locator('#pn-list .pn-card').first()).toBeVisible();
  // 既存のナビ3項目はそのまま残っている
  await expect(page.locator('#nav-home')).toBeVisible();
  await expect(page.locator('#nav-record')).toBeVisible();
  await expect(page.locator('#nav-analysis')).toBeVisible();
});

test('練習ノート: タップで技術の状態が回り、保存・上書き・削除できる', async ({ page }) => {
  await enterDemo(page);
  await page.click('#nav-practice');

  // サンプルの無い日（今日）を開いている前提。今日にサンプルがあれば削除してから始める
  if (await page.locator('.pn-delete-link').isVisible().catch(() => false)) {
    page.once('dialog', d => d.accept());
    await page.click('.pn-delete-link');
  }

  await page.click('#pn-time button:has-text("2h")');
  await expect(page.locator('#pn-time button:has-text("2h")')).toHaveClass(/selected/);

  const serve = page.locator('#pn-tags button[data-tag="サーブ"]');
  await serve.click();                       // 練習した
  await expect(serve).toHaveClass(/pn-st-practiced/);
  await serve.click();                       // ◎できた
  await expect(serve).toHaveClass(/pn-st-good/);
  await expect(serve).toHaveText('◎サーブ');
  const recv = page.locator('#pn-tags button[data-tag="レシーブ"]');
  await recv.click(); await recv.click(); await recv.click(); // △課題
  await expect(recv).toHaveClass(/pn-st-issue/);
  const rally = page.locator('#pn-tags button[data-tag="ラリー"]');
  await rally.click(); await rally.click(); await rally.click(); await rally.click(); // 一周してなし
  await expect(rally).not.toHaveClass(/pn-st-/);

  await page.fill('#pn-memo', 'テストの一言');
  await page.click('#pn-save');
  await expect(page.locator('.pn-saved-badge')).toBeVisible();
  const card = page.locator('.pn-card-current');
  await expect(card).toContainText('2h');
  await expect(card).toContainText('◎サーブ');
  await expect(card).toContainText('△レシーブ');
  await expect(card).toContainText('テストの一言');

  // 同じ日を上書き（1日1件）
  await page.click('#pn-time button:has-text("3h〜")');
  await page.click('#pn-save');
  await expect(page.locator('.pn-card-current')).toContainText('3h〜');
  const todayCards = await page.locator('.pn-card-current').count();
  expect(todayCards).toBe(1);

  // 削除
  page.once('dialog', d => d.accept());
  await page.click('.pn-delete-link');
  await expect(page.locator('.pn-saved-badge')).toHaveCount(0);
  await expect(page.locator('.pn-card-current')).toHaveCount(0);
});

test('練習ノート: 前の日に移動して過去のノートを開ける', async ({ page }) => {
  await enterDemo(page);
  await page.click('#nav-practice');
  await page.click('[data-action="prev-day"]');   // 昨日（サンプルあり）
  await expect(page.locator('.pn-saved-badge')).toBeVisible();
  await expect(page.locator('#pn-tags button[data-tag="サーブ"]')).toHaveClass(/pn-st-good/);
  await expect(page.locator('#pn-memo')).toHaveValue('下回転サーブが切れるようになってきた');
  await page.click('.pn-today-link');
  await expect(page.locator('.pn-today-link')).toHaveCount(0);
});
