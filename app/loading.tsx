import { EventCardSkeleton } from '@/components/EventCardSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <main>
      <div className="px-5 py-16 text-center">
        <Skeleton className="mx-auto h-12 w-2/3 max-w-xl" />
        <Skeleton className="mx-auto mt-4 h-5 w-1/2 max-w-md" />
      </div>
      <div className="mx-auto max-w-6xl px-5 py-4"><Skeleton className="h-40 w-full" /></div>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-8 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)}
      </div>
    </main>
  )
}
