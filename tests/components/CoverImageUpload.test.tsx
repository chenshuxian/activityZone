import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const uploadMock = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: () => ({ data: { publicUrl: 'http://x/cover.png' } }) }) },
  }),
}))

import { CoverImageUpload } from '@/components/CoverImageUpload'

test('選到非圖片檔顯示錯誤、不上傳', () => {
  const onChange = vi.fn()
  render(<CoverImageUpload onChange={onChange} />)
  const input = screen.getByLabelText(/選擇封面圖/) as HTMLInputElement
  const bad = new File(['x'], 'a.txt', { type: 'text/plain' })
  fireEvent.change(input, { target: { files: [bad] } })
  expect(screen.getByText(/JPG|PNG|WebP/)).toBeInTheDocument()
  expect(uploadMock).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})
