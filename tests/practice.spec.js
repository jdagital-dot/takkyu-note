import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/login.js';

// 体験モードで練習ノートを操作する（DB不要）
async function enterDemo(page) {
  await page.goto('/');
  await page.waitForSelector('#auth-email', { timeout: 10000 });
  await page.click('button:has-text("登録せずに試してみる")');
  await page.waitForSelector('#screen-home.active', { timeout: 10000 });
}

const pick = (page, kind, label) => page.locator(`#pn-${kind} button[data-label="${label}"]`);
const rateBtn = (page, label, r) => page.locator(`.pn-rate-btn[data-label="${label}"][data-rating="${r}"]`);

async function clearTodayIfSaved(page) {
  if (await page.locator('.pn-delete-link').isVisible().catch(() => false)) {
    page.once('dialog', d => d.accept());
    await page.click('.pn-delete-link');
    await expect(page.locator('.pn-saved-badge')).toHaveCount(0, { timeout: 15000 });
  }
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

test('練習ノート: 練習内容・意識することを選び、出来栄えを付けて保存・上書き・削除できる', async ({ page }) => {
  await enterDemo(page);
  await page.click('#nav-practice');
  await clearTodayIfSaved(page);

  await page.click('#pn-time button:has-text("2h")');
  await expect(page.locator('#pn-time button:has-text("2h")')).toHaveClass(/selected/);

  // 選ぶと出来栄えの行が出る
  await expect(page.locator('.pn-rate-row')).toHaveCount(0);
  await pick(page, 'menu', 'フォア打ち').click();
  await expect(pick(page, 'menu', 'フォア打ち')).toHaveClass(/selected/);
  await expect(page.locator('.pn-rate-row')).toHaveCount(1);
  await rateBtn(page, 'フォア打ち', 4).click();
  await expect(rateBtn(page, 'フォア打ち', 4)).toHaveClass(/on/);
  await rateBtn(page, 'フォア打ち', 4).click();           // 同じ値でもう一度押すと未評価
  await expect(rateBtn(page, 'フォア打ち', 4)).not.toHaveClass(/on/);
  await rateBtn(page, 'フォア打ち', 5).click();

  await pick(page, 'focus', '打点').click();
  await rateBtn(page, '打点', 2).click();
  await pick(page, 'menu', 'ツッツキ').click();
  await expect(page.locator('.pn-rate-row')).toHaveCount(3);
  await pick(page, 'menu', 'ツッツキ').click();            // もう一度押すと外れる
  await expect(page.locator('.pn-rate-row')).toHaveCount(2);

  await page.fill('#pn-memo', 'テストの一言');
  await page.click('#pn-save');
  await expect(page.locator('.pn-saved-badge')).toBeVisible();
  const card = page.locator('.pn-card-current');
  await expect(card).toContainText('2h');
  await expect(card).toContainText('フォア打ち5');
  await expect(card).toContainText('打点2');
  await expect(card).not.toContainText('ツッツキ');
  await expect(card).toContainText('テストの一言');

  // 同じ日を上書き（1日1件）
  await page.click('#pn-time button:has-text("3h〜")');
  await page.click('#pn-save');
  await expect(page.locator('.pn-card-current')).toContainText('3h〜');
  expect(await page.locator('.pn-card-current').count()).toBe(1);

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
  await expect(pick(page, 'menu', 'サーブ')).toHaveClass(/selected/);
  await expect(rateBtn(page, 'サーブ', 4)).toHaveClass(/on/);
  await expect(page.locator('#pn-memo')).toHaveValue('下回転サーブが切れるようになってきた');
  await page.click('.pn-today-link');
  await expect(page.locator('.pn-today-link')).toHaveCount(0);
});

test('練習ノート: 項目を編集して、自分の項目を足し、用意された項目を非表示にできる', async ({ page }) => {
  await enterDemo(page);
  await page.click('#nav-practice');
  // 体験 太郎は「チキータ」を自分の項目に持ち、「体力・筋トレ」を非表示にしている
  await expect(pick(page, 'menu', 'チキータ')).toBeVisible();
  await expect(pick(page, 'menu', '体力・筋トレ')).toHaveCount(0);

  await page.click('[data-action="edit-items"][data-kind="menu"]');
  await expect(page.locator('.pn-modal')).toBeVisible();
  await page.fill('#pn-new-item', '三球目の回り込み');
  await page.click('[data-action="editor-add"]');
  await expect(page.locator('.pn-edit-row')).toContainText(['チキータ', '三球目の回り込み']);
  await page.click('.pn-modal [data-action="editor-toggle"][data-label="フォア打ち"]'); // 非表示
  await page.click('[data-action="editor-save"]');
  await expect(page.locator('.pn-modal')).toHaveCount(0);

  await expect(pick(page, 'menu', '三球目の回り込み')).toBeVisible();
  await expect(pick(page, 'menu', 'フォア打ち')).toHaveCount(0);

  // 意識することのタブでも足せる
  await page.click('[data-action="edit-items"][data-kind="focus"]');
  await page.fill('#pn-new-item', '肘を上げない');
  await page.press('#pn-new-item', 'Enter');
  await page.click('[data-action="editor-save"]');
  await expect(pick(page, 'focus', '肘を上げない')).toBeVisible();

  // やめる を押すと変更は残らない
  await page.click('[data-action="edit-items"][data-kind="menu"]');
  await page.fill('#pn-new-item', '保存しない項目');
  await page.click('[data-action="editor-add"]');
  await page.click('.pn-cancel-btn');
  await expect(pick(page, 'menu', '保存しない項目')).toHaveCount(0);
});

test('練習ノート: 同じ選手が設定し直されても、開いている日付と入力中の内容は消えない', async ({ page }) => {
  await enterDemo(page);
  await page.click('#nav-practice');
  await page.click('[data-action="prev-day"]');
  await page.click('[data-action="prev-day"]');
  const date = await page.locator('#pn-date').textContent();
  await pick(page, 'focus', '集中').click();
  // ログイン直後の読み込みと同じく、同じ選手IDが設定し直される
  await page.evaluate(() => window.playerState.setCurrentPlayerId(window.playerState.getCurrentPlayerId()));
  await expect(page.locator('#pn-date')).toHaveText(date);
  await expect(pick(page, 'focus', '集中')).toHaveClass(/selected/);
});

// ---- ログインして実際のDBに保存する（practice_notes と sql/06 の列が必要） ----

test('練習ノート: ログイン中は保存した内容が再読み込み後も残り、削除もできる', async ({ page }) => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL が未設定');
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await page.click('#nav-practice');
  // 他のテストデータと重ならないよう 3日前の日付で試す
  for (let i = 0; i < 3; i++) await page.click('[data-action="prev-day"]');
  await clearTodayIfSaved(page);
  const date = await page.locator('#pn-date').textContent();

  await page.click('#pn-time button:has-text("1.5h")');
  await pick(page, 'menu', 'ドライブ').click();
  await rateBtn(page, 'ドライブ', 3).click();
  await pick(page, 'focus', '体重移動').click();
  await page.fill('#pn-memo', 'E2Eテスト');
  await page.click('#pn-save');
  await expect(page.locator('.pn-saved-badge')).toBeVisible({ timeout: 15000 });

  // 再読み込みしても残っている（DBから取り直す）
  await page.reload();
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
  await page.click('#nav-practice');
  const card = page.locator('.pn-card', { hasText: date });
  await expect(card).toContainText('ドライブ3', { timeout: 15000 });
  await expect(card).toContainText('体重移動');
  await expect(card).toContainText('1.5h');
  await expect(card).toContainText('E2Eテスト');

  // 後片付け
  await card.click();
  page.once('dialog', d => d.accept());
  await page.click('.pn-delete-link');
  await expect(page.locator('.pn-card', { hasText: date })).toHaveCount(0, { timeout: 15000 });
});

test('練習ノート: ログイン中は自分の項目が選手に保存され、再読み込み後も残る', async ({ page }) => {
  test.skip(!process.env.TEST_EMAIL, 'TEST_EMAIL が未設定');
  await loginWithEmail(page, process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
  await page.waitForTimeout(2000); // 選手一覧の読み込みを待つ
  await page.click('#nav-practice');

  await page.click('[data-action="edit-items"][data-kind="menu"]');
  await page.fill('#pn-new-item', 'E2E項目');
  await page.click('[data-action="editor-add"]');
  await page.click('[data-action="editor-save"]');
  await expect(pick(page, 'menu', 'E2E項目')).toBeVisible({ timeout: 15000 });

  await page.reload();
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.click('#nav-practice');
  await expect(pick(page, 'menu', 'E2E項目')).toBeVisible({ timeout: 15000 });

  // 後片付け
  await page.click('[data-action="edit-items"][data-kind="menu"]');
  await page.click('.pn-modal [data-action="editor-remove"][data-label="E2E項目"]');
  await page.click('[data-action="editor-save"]');
  await expect(pick(page, 'menu', 'E2E項目')).toHaveCount(0, { timeout: 15000 });
});
