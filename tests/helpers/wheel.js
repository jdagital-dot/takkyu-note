// ドラムロール式スコア入力の操作ヘルパー
// 実ユーザーのスワイプと同じ scroll イベント経路（scrollTop 変更 → debounce → commit）を通す
export async function setWheelScore(page, setIdx, side, val) {
  await page.evaluate(([i, s, v]) => {
    const el = document.querySelector(`.score-wheel[data-set-idx="${i}"][data-side="${s}"]`);
    if (!el) throw new Error(`wheel not found: set=${i} side=${s}`);
    el.scrollTop = v * 40; // WHEEL_ITEM_H
    el.dispatchEvent(new Event('scroll'));
  }, [setIdx, side, val]);
  // debounce(170ms) + 自動計算の反映を待つ
  await page.waitForTimeout(450);
}
