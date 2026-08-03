import { Skeleton } from '@/components/ui/Skeleton'

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-card shadow-card">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
