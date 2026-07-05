import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

test('分析画面に実データが反映される', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await expect(page.locator('#player-switcher-mount')).not.toBeEmpty({ timeout: 10000 });

  // 戦型・タグ付きの試合を記録（分析の材料）
  await page.click('#fab');
  await page.waitForSelector('#screen-record.active');
  await page.fill('#opponent-name', `分析テスト-${Date.now()}`);
  await page.selectOption('#opponent-grade', '13');
  await page.click('.type-btn[data-type="シェークハンド裏裏"]');
  await page.click('.tag-btn:has-text("サーブ")');
  const inputs = page.locator('input.score-input[data-side="my"]');
  await inputs.nth(0).fill('11');
  await inputs.nth(1).fill('11');
  await inputs.nth(2).fill('11');
  await page.click('button.submit-btn');
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
  await page.waitForTimeout(500);
  if (await page.locator('#confirm-modal.show').isVisible().catch(() => false)) {
    await page.click('#confirm-modal button:has-text("追加しない")').catch(() => {});
  }

  // 分析タブへ
  await page.click('#nav-analysis');
  await page.waitForSelector('#screen-analysis.active');

  // 空状態ではなくコンテンツが表示されている
  await expect(page.locator('#analysis-content')).toBeVisible();
  await expect(page.locator('#analysis-empty')).toBeHidden();

  // 総合勝率に実数が入っている（全N試合、N >= 1）
  const totalText = await page.textContent('#analysis-total');
  expect(totalText).toMatch(/全[1-9]\d*試合/);

  // 年齢カテゴリ別に3カテゴリが描画されている
  await expect(page.locator('#age-grid .age-box')).toHaveCount(3);

  // 戦型別: バー行または案内メッセージのどちらかが描画されている
  const typeChartText = await page.textContent('#type-chart');
  expect(typeChartText.length).toBeGreaterThan(0);

  // 傾向: 行または案内メッセージが描画されている
  const insightsText = await page.textContent('#tag-insights');
  expect(insightsText.length).toBeGreaterThan(0);
});
