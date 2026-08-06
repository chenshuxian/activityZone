import { EventForm } from '@/components/EventForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const [{ data: categories }, { data: me }] = await Promise.all([
    supabase.from('categories').select('id,name,slug,icon'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])
  return (
    <main>
      <EventForm categories={categories ?? []} isAdmin={me?.role === 'admin'} />
    </main>
  )
}
