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
  return (
    <div className="flex flex-wrap gap-2 p-3">
      <input defaultValue={params.get('keyword') ?? ''} placeholder="🔍 搜尋活動"
        onKeyDown={e => { if (e.key === 'Enter') setParam('keyword', (e.target as HTMLInputElement).value) }}
        className="border rounded px-2 py-1" />
      <select value={city} onChange={e => setParam('city', e.target.value)} className="border rounded px-2 py-1">
        <option value="">全部縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {city && (
        <select value={params.get('district') ?? ''} onChange={e => setParam('district', e.target.value)} className="border rounded px-2 py-1">
          <option value="">全部鄉鎮區</option>
          {REGIONS[city].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      {categories.map(cat => {
        const active = params.get('cat') === cat.slug
        return <button key={cat.slug} onClick={() => setParam('cat', active ? '' : cat.slug)}
          className={`border rounded px-2 py-1 ${active ? 'bg-black text-white' : ''}`}>
          {cat.icon} {cat.name}
        </button>
      })}
    </div>
  )
}
