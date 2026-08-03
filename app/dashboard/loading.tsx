import { Skeleton } from '@/components/ui/Skeleton'
import { EventCardSkeleton } from '@/components/EventCardSkeleton'

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)}
      </div>
    </main>
  )
}
