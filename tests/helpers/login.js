export async function loginWithEmail(page, email, password) {
  await page.goto('/');
  await page.waitForSelector('#auth-email', { timeout: 10000 });
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', password);
  await page.click('button:has-text("ログイン")');
  await page.waitForSelector('#screen-home.active', { timeout: 15000 });
}
