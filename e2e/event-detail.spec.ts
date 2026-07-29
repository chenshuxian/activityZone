import { expect, test } from '@playwright/test'
test('不存在的活動回 404', async ({ page }) => {
  const res = await page.goto('/events/00000000-0000-0000-0000-000000000000')
  expect(res?.status()).toBe(404)
})
