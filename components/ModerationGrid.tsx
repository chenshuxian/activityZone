'use client'
import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface ModerationRow {
  id: string
  title: string
  city: string
  district: string
  startAt: string
  organizerName: string | null
}

type SortKey = 'title' | 'region' | 'startAt' | 'organizer'

function field(r: ModerationRow, k: SortKey): string {
  if (k === 'title') return r.title
  if (k === 'region') return r.city + r.district
  if (k === 'startAt') return r.startAt
  return r.organizerName ?? ''
}

export function ModerationGrid({
  rows,
  approveAction,
  rejectAction,
}: {
  rows: ModerationRow[]
  approveAction: (formData: FormData) => Promise<void>
  rejectAction: (formData: FormData) => Promise<void>
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'startAt', dir: 1 })

  const sorted = [...rows].sort((a, b) => {
    const av = field(a, sort.key)
    const bv = field(b, sort.key)
    return av < bv ? -sort.dir : av > bv ? sort.dir : 0
  })

  const toggle = (k: SortKey) =>
    setSort(s => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: 1 }))

  const th = 'cursor-pointer select-none px-3 py-2.5 text-left font-medium text-secondary hover:text-foreground'

  const columns: { key: SortKey; label: string }[] = [
    { key: 'title', label: '活動標題' },
    { key: 'region', label: '地區' },
    { key: 'startAt', label: '開始時間' },
    { key: 'organizer', label: '主辦' },
  ]

  return (
    <div className="overflow-x-auto rounded-card border border-hairline">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline bg-surface">
            {columns.map(c => (
              <th key={c.key} className={th} onClick={() => toggle(c.key)}>
                {c.label}
                {sort.key === c.key && (
                  sort.dir === 1
                    ? <ChevronUp size={14} className="ml-0.5 inline" />
                    : <ChevronDown size={14} className="ml-0.5 inline" />
                )}
              </th>
            ))}
            <th className="px-3 py-2.5 text-left font-medium text-secondary">動作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <tr key={e.id} className="border-b border-hairline last:border-b-0">
              <td className="px-3 py-2.5 font-medium">{e.title}</td>
              <td className="px-3 py-2.5 text-secondary">{e.city}{e.district}</td>
              <td className="px-3 py-2.5 text-secondary whitespace-nowrap">
                {new Date(e.startAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="px-3 py-2.5 text-secondary">{e.organizerName}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <form action={approveAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="rounded-pill bg-accent px-3 py-1 text-xs font-medium text-on-accent hover:bg-accent-hover">
                      核准
                    </button>
                  </form>
                  <form action={rejectAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="reason" placeholder="退回原因"
                      className="w-28 rounded-lg border border-hairline bg-card px-2 py-1 text-xs outline-none focus:border-accent" />
                    <button className="rounded-pill border border-hairline px-3 py-1 text-xs font-medium text-red-600 hover:border-red-600">
                      退回
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-secondary">目前沒有待審核的活動。</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
