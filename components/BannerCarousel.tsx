'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BannerItem } from '@/lib/types'

export function BannerCarousel({ banners }: { banners: BannerItem[] }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (banners.length <= 1) return
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
    if (reduce) return
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return null
  const b = banners[Math.min(idx, banners.length - 1)]
  const date = new Date(b.startAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

  return (
    <div className="mx-auto max-w-6xl px-5 py-4">
      <Link href={`/events/${b.eventId}`}
        className="relative block h-40 overflow-hidden rounded-card bg-gradient-to-br from-[#6366f1] to-[#ec4899]">
        {b.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.coverImage} alt={b.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-5 text-white">
          <div className="text-xl font-bold tracking-tight-a">{b.title}</div>
          <div className="text-sm opacity-90">{date} · {b.city}{b.district}</div>
        </div>
      </Link>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`第 ${i + 1} 張`}
              className={`h-2 w-2 rounded-full transition-colors ${i === idx ? 'bg-accent' : 'bg-secondary/40'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
