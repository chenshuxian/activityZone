import { describe, it, expect } from 'vitest'
import { taipeiLocalToISO, isoToTaipeiParts, taipeiInputValue, formatDateTime, formatDate } from './time'

describe('台灣時間處理', () => {
  it('表單 naive 時間視為台灣時間，存成正確 UTC 瞬間', () => {
    expect(new Date(taipeiLocalToISO('2026-08-06T10:00')).toISOString())
      .toBe('2026-08-06T02:00:00.000Z')
  })

  it('空字串或無 T 的字串原樣回傳', () => {
    expect(taipeiLocalToISO('')).toBe('')
    expect(taipeiLocalToISO('2026-08-06')).toBe('2026-08-06')
  })

  it('UTC 瞬間轉回台灣壁鐘時間（給表單預設值）', () => {
    expect(taipeiInputValue('2026-08-06T02:00:00.000Z')).toBe('2026-08-06T10:00')
    expect(isoToTaipeiParts('2026-08-06T02:00:00.000Z')).toEqual({ date: '2026-08-06', time: '10:00' })
  })

  it('跨日午夜以 h23 呈現為 00:00 而非 24:00', () => {
    // 台灣 2026-08-07 00:00 = UTC 2026-08-06 16:00
    expect(taipeiInputValue('2026-08-06T16:00:00.000Z')).toBe('2026-08-07T00:00')
  })

  it('round-trip：輸入→儲存→顯示 維持同一台灣時刻', () => {
    const iso = new Date(taipeiLocalToISO('2026-12-31T23:30')).toISOString()
    expect(taipeiInputValue(iso)).toBe('2026-12-31T23:30')
  })

  it('顯示一律用台灣時區，不受伺服器時區影響', () => {
    expect(formatDateTime('2026-08-06T02:00:00.000Z')).toContain('上午10:00')
    expect(formatDate('2026-08-06T02:00:00.000Z', { month: 'numeric', day: 'numeric' })).toBe('8/6')
  })
})
