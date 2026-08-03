'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { register, cancelRegistration } from '@/lib/events/registration'
import { Button } from '@/components/ui/Button'
import type { RegistrationField } from '@/lib/events/registration-logic'
import type { MyRegistration } from '@/lib/types'

export function RegistrationPanel(props: {
  eventId: string
  capacity: number | null
  registeredCount: number
  fields: RegistrationField[]
  startAt: string
  registrationDeadline: string | null
  isLoggedIn: boolean
  myRegistration: MyRegistration | null
}) {
  const { eventId, capacity, registeredCount, fields, startAt, registrationDeadline, isLoggedIn, myRegistration } = props
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = Date.now()
  const started = new Date(startAt).getTime() <= now
  const closed = registrationDeadline ? new Date(registrationDeadline).getTime() <= now : false
  const full = capacity !== null && registeredCount >= capacity

  const login = () => {
    const supabase = createClient()
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } })
  }
  async function doRegister(formData: FormData) {
    setBusy(true); setError(null)
    const answers: Record<string, string> = {}
    let partySize = 1
    for (const f of fields) {
      const v = String(formData.get(f.key) ?? '')
      if (f.key === 'party_size') partySize = Number(v) || 1
      else if (v) answers[f.key] = v
    }
    const res = await register(eventId, { partySize, formAnswers: answers })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }
  async function doCancel() {
    setBusy(true); setError(null)
    const res = await cancelRegistration(eventId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  const box = 'rounded-card border border-hairline bg-card p-5'

  if (started) return <div className={box}><p className="text-secondary">活動已開始或結束</p></div>
  if (!isLoggedIn) return <div className={box}><Button onClick={login}>登入後報名</Button></div>

  if (myRegistration?.status === 'registered')
    return <div className={box}><p className="mb-3 font-semibold text-accent"><Check size={16} className="mr-1 inline" aria-hidden />已報名</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button variant="ghost" disabled={busy} onClick={doCancel}>
        {busy && <Loader2 size={16} className="mr-1 inline animate-spin" aria-hidden />}取消報名
      </Button></div>
  if (myRegistration?.status === 'waitlist')
    return <div className={box}><p className="mb-3 font-semibold">候補中（第 {myRegistration.waitlistPosition} 位）</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button variant="ghost" disabled={busy} onClick={doCancel}>
        {busy && <Loader2 size={16} className="mr-1 inline animate-spin" aria-hidden />}取消候補
      </Button></div>
  if (closed) return <div className={box}><Button disabled>報名已截止</Button></div>

  return (
    <form action={doRegister} className={box}>
      {full && <p className="mb-2 text-sm text-secondary">此活動已額滿，報名將加入候補。</p>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {fields.map(f => (
        <label key={f.key} className="mb-2 block text-sm">
          {f.label}{f.required && ' *'}
          <input name={f.key} required={f.required}
            type={f.key === 'party_size' ? 'number' : 'text'}
            defaultValue={f.key === 'party_size' ? 1 : ''}
            className="mt-1 w-full rounded-lg border border-hairline bg-card px-3 py-1.5" />
        </label>
      ))}
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 size={16} className="mr-1 inline animate-spin" aria-hidden />}{full ? '加入候補' : '我要報名'}
      </Button>
    </form>
  )
}
