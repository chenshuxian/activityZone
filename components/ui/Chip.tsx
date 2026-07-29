import type { ReactNode } from "react";

/** Small rounded tag used for categories and status ("免費"). */
export function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent";
}) {
  const toneClass =
    tone === "accent" ? "text-free font-semibold" : "text-foreground";
  return (
    <span
      className={`inline-block rounded-pill bg-chip px-2.5 py-0.5 text-xs ${toneClass}`}
    >
      {children}
    </span>
  );
}
