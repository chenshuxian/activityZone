import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyEvents } from '@/lib/events/dashboard'
import { StatusBadge } from '@/components/StatusBadge'
import { ButtonLink } from '@/components/ui/Button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const events = await getMyEvents()
  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight-a">我的活動</h1>
        <ButtonLink href="/events/new">發布活動</ButtonLink>
      </div>
      {events.length === 0 ? (
        <p className="text-secondary">你還沒有發布任何活動。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map(e => (
            <li key={e.id} className="rounded-card border border-hairline bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{e.title}</span>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-1 text-sm text-secondary">
                {new Date(e.startAt).toLocaleDateString('zh-TW')} ·
                {' '}正取 {e.registeredCount}{e.capacity !== null ? ` / ${e.capacity}` : ''}
                {e.waitlistCount > 0 ? ` · 候補 ${e.waitlistCount}` : ''}
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <Link href={`/events/${e.id}/edit`} className="text-accent hover:underline">編輯</Link>
                <Link href={`/events/${e.id}/registrations`} className="text-accent hover:underline">報名名單</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
