export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return '只接受 JPG / PNG / WebP 圖片'
  if (file.size > MAX_IMAGE_BYTES) return '圖片不能超過 5MB'
  return null
}
