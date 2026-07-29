import { EventForm } from '@/components/EventForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')
  return (
    <main>
      <EventForm categories={categories ?? []} />
    </main>
  )
}
