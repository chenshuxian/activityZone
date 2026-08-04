import { expect, test } from 'vitest'
import { validateImageFile, MAX_IMAGE_BYTES } from '@/lib/images'

test('合法圖片回 null', () => {
  expect(validateImageFile({ type: 'image/png', size: 1000 })).toBeNull()
})
test('型別不符回錯誤', () => {
  expect(validateImageFile({ type: 'text/plain', size: 1000 })).toMatch(/JPG|PNG|WebP/)
})
test('過大回錯誤', () => {
  expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/5MB/)
})
