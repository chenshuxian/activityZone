import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <main>
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  )
}
