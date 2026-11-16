import { cn } from "@/lib/utils";

/** The ISFRID mark: a document with a folded corner, a prompt chevron and a cursor. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <path d="M7 2h12l8 8v16a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill="var(--brand)" />
      <path d="M19 2l8 8h-5a3 3 0 0 1-3-3V2Z" fill="var(--brand-fg)" opacity=".38" />
      <path d="M9 14.5l4.5 3.5L9 21.5" fill="none" stroke="var(--brand-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 22h6" stroke="var(--brand-fg)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[0.08em] text-fg">ISFRID</span>
    </span>
  );
}
