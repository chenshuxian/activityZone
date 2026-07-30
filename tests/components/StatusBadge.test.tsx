import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusBadge } from '@/components/StatusBadge'

test('顯示中文狀態', () => {
  render(<StatusBadge status="pending" />)
  expect(screen.getByText('待審核')).toBeInTheDocument()
})
test('已上架顯示對應文字', () => {
  render(<StatusBadge status="published" />)
  expect(screen.getByText('已上架')).toBeInTheDocument()
})
