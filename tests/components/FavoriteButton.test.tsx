import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('@/lib/favorites', () => ({
  toggleFavorite: vi.fn().mockResolvedValue({ ok: true, favorited: true }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }))

import { FavoriteButton } from '@/components/FavoriteButton'
import { toggleFavorite } from '@/lib/favorites'

test('未收藏顯示空心、已收藏顯示實心', () => {
  const { rerender } = render(<FavoriteButton eventId="e1" initialFavorited={false} />)
  expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  rerender(<FavoriteButton eventId="e1" initialFavorited={true} />)
  expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
})

test('點擊呼叫 toggleFavorite 並更新狀態', async () => {
  render(<FavoriteButton eventId="e1" initialFavorited={false} />)
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('e1'))
  await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true'))
})
