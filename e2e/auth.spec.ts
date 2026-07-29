import { expect, test } from '@playwright/test'
test('首頁顯示 Google 登入按鈕', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Google 登入')).toBeVisible()
})
