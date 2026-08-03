import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Skeleton } from '@/components/ui/Skeleton'

test('渲染脈動骨架塊', () => {
  const { container } = render(<Skeleton className="h-4 w-10" />)
  const el = container.firstChild as HTMLElement
  expect(el.className).toContain('animate-pulse')
  expect(el.className).toContain('h-4')
})
