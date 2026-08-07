import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Linkify } from './Linkify'

describe('Linkify', () => {
  it('把網址轉成可點擊、安全的連結', () => {
    render(<Linkify text="報名 https://example.com/signup 謝謝" />)
    const a = screen.getByRole('link')
    expect(a).toHaveAttribute('href', 'https://example.com/signup')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('多個網址都會被連結', () => {
    render(<Linkify text="a https://one.com b http://two.com c" />)
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(['https://one.com', 'http://two.com'])
  })

  it('網址結尾的中文標點不算網址的一部分', () => {
    render(<Linkify text="詳見 https://example.com/foo。下一句" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/foo')
    expect(screen.getByText(/。下一句/)).toBeInTheDocument()
  })

  it('沒有網址時原樣顯示純文字', () => {
    render(<Linkify text="就只是一段文字" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('就只是一段文字')).toBeInTheDocument()
  })
})
