import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MobileNav } from '@/components/MobileNav'

test('點漢堡展開選單，含登入會員連結', () => {
  render(<MobileNav loggedIn={true} />)
  expect(screen.queryByText('我的活動')).toBeNull()
  fireEvent.click(screen.getByLabelText('選單'))
  expect(screen.getByText('探索')).toBeInTheDocument()
  expect(screen.getByText('我的活動')).toBeInTheDocument()
})
test('未登入不顯示會員連結', () => {
  render(<MobileNav loggedIn={false} />)
  fireEvent.click(screen.getByLabelText('選單'))
  expect(screen.queryByText('我的活動')).toBeNull()
})
