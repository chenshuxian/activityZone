import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventRegistrations } from '@/lib/events/registrations-admin'
import type { RegistrationRow } from '@/lib/types'

export default async function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  let rows: RegistrationRow[]
  try { rows = await getEventRegistrations(id) }
  catch { redirect('/dashboard') } // 非主辦方 → 函式丟例外
  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight-a">報名名單（{rows.length}）</h1>
        <a href={`/events/${id}/registrations/export`}
           className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-on-accent">匯出 CSV</a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-secondary">
              <th className="py-2 pr-4">狀態</th><th className="py-2 pr-4">名稱</th>
              <th className="py-2 pr-4">Email</th><th className="py-2 pr-4">人數</th>
              <th className="py-2 pr-4">額外</th><th className="py-2">報名時間</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.userId} className="border-b border-hairline">
                <td className="py-2 pr-4">{r.status === 'registered' ? '正取' : '候補'}</td>
                <td className="py-2 pr-4">{r.displayName}</td>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4">{r.partySize}</td>
                <td className="py-2 pr-4">{Object.entries(r.formAnswers).map(([k,v]) => `${k}=${v}`).join('; ')}</td>
                <td className="py-2">{new Date(r.createdAt).toLocaleString('zh-TW')}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-secondary">目前沒有報名。</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  )
}
