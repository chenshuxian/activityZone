'use client'
import { CITIES, REGIONS } from '@/lib/regions'
import type { Category } from '@/lib/types'
import { useRouter, useSearchParams } from 'next/navigation'

export function FilterBar({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const city = params.get('city') ?? ''
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    if (key === 'city') next.delete('district')
    router.push(`/?${next.toString()}`)
  }
  const selectClass =
    'rounded-full border border-hairline bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent'
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-4">
      <input
        defaultValue={params.get('keyword') ?? ''}
        placeholder="搜尋活動…"
        onKeyDown={e => { if (e.key === 'Enter') setParam('keyword', (e.target as HTMLInputElement).value) }}
        className="min-w-[180px] flex-1 rounded-full border border-hairline bg-card px-4 py-1.5 text-sm text-foreground outline-none placeholder:text-secondary focus:border-accent"
      />
      <select value={city} onChange={e => setParam('city', e.target.value)} className={selectClass}>
        <option value="">全部縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {city && (
        <select value={params.get('district') ?? ''} onChange={e => setParam('district', e.target.value)} className={selectClass}>
          <option value="">全部鄉鎮區</option>
          {REGIONS[city].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      {categories.map(cat => {
        const active = params.get('cat') === cat.slug
        return (
          <button
            key={cat.slug}
            onClick={() => setParam('cat', active ? '' : cat.slug)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'border-accent bg-accent text-on-accent'
                : 'border-hairline bg-card text-foreground hover:border-accent'
            }`}
          >
            {cat.name}
          </button>
        )
      })}
    </div>
  )
}
