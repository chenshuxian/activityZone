import Link from "next/link";
import type { EventSummary } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { FavoriteButton } from "@/components/FavoriteButton";

export function EventCard({
  event,
  isFavorited,
}: {
  event: EventSummary;
  isFavorited?: boolean;
}) {
  const date = new Date(event.startAt).toLocaleDateString("zh-TW", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const remaining =
    event.capacity !== null ? Math.max(event.capacity - event.registeredCount, 0) : null;
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block h-full w-full overflow-hidden rounded-card bg-card shadow-card transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div className="relative h-32 bg-gradient-to-br from-[#a8c0ff] to-[#3f6cd8]">
        <FavoriteButton variant="overlay" eventId={event.id} initialFavorited={isFavorited ?? false} />
      </div>
      <div className="p-4">
        <h3 className="font-semibold tracking-tight-a">{event.title}</h3>
        <p className="mt-1 text-sm text-secondary">
          {date} · {event.city}
          {event.district}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {event.categories.map((c) => (
            <Chip key={c.id}>{c.name}</Chip>
          ))}
          {event.isFree && <Chip tone="accent">免費</Chip>}
        </div>
        {remaining !== null && (
          <p className="mt-1 text-xs text-secondary">
            {remaining > 0 ? `剩 ${remaining} 位` : "已額滿"}
          </p>
        )}
      </div>
    </Link>
  );
}
