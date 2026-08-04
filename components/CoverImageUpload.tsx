'use client'
import { useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateImageFile } from '@/lib/images'
import { Loader2, X } from 'lucide-react'

export function CoverImageUpload({
  initialUrl, onChange,
}: { initialUrl?: string; onChange: (url: string | null) => void }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) { setError(err); return }
    setError(null); setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('請先登入'); setBusy(false); return }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('event-covers').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setBusy(false); return }
    const publicUrl = supabase.storage.from('event-covers').getPublicUrl(path).data.publicUrl
    setUrl(publicUrl); onChange(publicUrl); setBusy(false)
  }
  function remove() { setUrl(''); onChange(null) }

  return (
    <div>
      {url ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="封面預覽" className="h-40 w-full rounded-lg object-cover" />
          <button type="button" onClick={remove} aria-label="移除封面"
            className="absolute right-2 top-2 rounded-full bg-card/80 p-1 backdrop-blur"><X size={16} /></button>
        </div>
      ) : (
        <label className="flex h-40 cursor-pointer items-center justify-center rounded-lg border border-dashed border-hairline text-sm text-secondary">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : '選擇封面圖（最大 5MB）'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} disabled={busy} />
        </label>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
