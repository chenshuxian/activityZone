import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

test('顯示標題與說明', () => {
  render(<EmptyState icon={Calendar} title="沒有活動" description="快來發布" />)
  expect(screen.getByText('沒有活動')).toBeInTheDocument()
  expect(screen.getByText('快來發布')).toBeInTheDocument()
})
