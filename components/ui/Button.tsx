import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost";

const base =
  "inline-flex items-center justify-center rounded-pill px-5 py-2 text-[15px] font-medium " +
  "transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-default";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  ghost: "text-accent border border-accent/40 hover:bg-accent/10",
};

type BaseProps = { variant?: Variant; className?: string; children: ReactNode };

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: BaseProps & ComponentProps<"button">) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...rest
}: BaseProps & ComponentProps<typeof Link>) {
  return (
    <Link className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
