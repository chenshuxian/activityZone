import type { RegistrationRow } from '@/lib/types'

const HEADERS = ['狀態', '顯示名稱', 'Email', '同行人數', '額外欄位', '報名時間']

function esc(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function toRegistrationsCsv(rows: RegistrationRow[]): string {
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    const answers = Object.entries(r.formAnswers).map(([k, v]) => `${k}=${v}`).join('; ')
    lines.push([
      r.status === 'registered' ? '正取' : '候補',
      r.displayName ?? '',
      r.email ?? '',
      String(r.partySize),
      answers,
      r.createdAt,
    ].map(esc).join(','))
  }
  return lines.join('\n') + '\n'
}
