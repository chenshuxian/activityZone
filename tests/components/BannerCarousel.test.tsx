import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BannerCarousel } from '@/components/BannerCarousel'
import type { BannerItem } from '@/lib/types'

const items: BannerItem[] = [
  { eventId: 'e1', title: '第一場', city: '台北市', district: '大安區', startAt: '2026-08-01T00:00:00Z' },
  { eventId: 'e2', title: '第二場', city: '台北市', district: '內湖區', startAt: '2026-08-02T00:00:00Z' },
]

test('空清單不渲染', () => {
  const { container } = render(<BannerCarousel banners={[]} />)
  expect(container.firstChild).toBeNull()
})
test('顯示第一張與小點；點第二點切到第二張', () => {
  render(<BannerCarousel banners={items} />)
  expect(screen.getByText('第一場')).toBeInTheDocument()
  const dots = screen.getAllByRole('button')
  expect(dots.length).toBe(2)
  fireEvent.click(dots[1])
  expect(screen.getByText('第二場')).toBeInTheDocument()
})
