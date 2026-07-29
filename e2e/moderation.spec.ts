import { expect, test } from '@playwright/test'
test('未登入訪問審核頁被導回首頁', async ({ page }) => {
  await page.goto('/admin/moderation')
  await expect(page).toHaveURL('/')
})
