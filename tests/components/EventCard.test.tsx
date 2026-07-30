import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EventCard } from '@/components/EventCard'

const ev = {
  id: 'e1', title: '晨跑', coverImage: null, city: '台北市', district: '大安區',
  startAt: '2026-07-29T23:00:00Z', isFree: true, capacity: 10, registeredCount: 3,
  categories: [{ id: 'c1', name: '體育', slug: 'sports', icon: '🏃' }],
}

test('顯示標題、地區與類別', () => {
  render(<EventCard event={ev} />)
  expect(screen.getByText('晨跑')).toBeInTheDocument()
  expect(screen.getByText(/大安區/)).toBeInTheDocument()
  expect(screen.getByText(/體育/)).toBeInTheDocument()
})

test('顯示剩餘名額', () => {
  render(<EventCard event={ev} />)
  expect(screen.getByText('剩 7 位')).toBeInTheDocument()
})
