import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Netflix-style horizontal row: a titled band whose items scroll left/right.
 * Used on the homepage for 近期活動 / 為你推薦 / 你附近 etc.
 */
export function Row({
  title,
  subtitle,
  seeAllHref,
  children,
}: {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-8">
      <div className="mx-auto flex max-w-6xl items-end justify-between px-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight-a">{title}</h2>
          {subtitle && <p className="mt-0.5 text-secondary">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-[15px] font-medium text-accent hover:underline"
          >
            查看全部 →
          </Link>
        )}
      </div>
      <div className="no-scrollbar mx-auto mt-4 flex max-w-6xl gap-4 overflow-x-auto px-5 pb-2">
        {children}
      </div>
    </section>
  );
}
