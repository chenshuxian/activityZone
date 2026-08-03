'use client'
import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toggleFavorite } from '@/lib/favorites'

export function FavoriteButton({
  eventId, initialFavorited, variant = 'inline',
}: { eventId: string; initialFavorited: boolean; variant?: 'inline' | 'overlay' }) {
  const [fav, setFav] = useState(initialFavorited)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setFav(initialFavorited)
  }, [initialFavorited])

  async function onClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (busy) return
    setBusy(true)
    const res = await toggleFavorite(eventId)
    setBusy(false)
    if (!res.ok) {
      createClient().auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` },
      })
      return
    }
    setFav(res.favorited)
  }

  const base = 'flex items-center justify-center transition-colors'
  const cls = variant === 'overlay'
    ? `${base} absolute right-2 top-2 h-8 w-8 rounded-full bg-card/80 backdrop-blur text-lg`
    : `${base} h-9 px-3 rounded-pill border border-hairline text-lg gap-1`

  return (
    <button onClick={onClick} aria-label="收藏" aria-pressed={fav}
      className={`${cls} ${fav ? 'text-accent' : 'text-secondary'} cursor-pointer`}>
      <Heart size={variant === 'overlay' ? 18 : 20} className={fav ? 'fill-current' : ''} aria-hidden />
    </button>
  )
}
