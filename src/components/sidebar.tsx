"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, History, Layers, LayoutDashboard, Menu, Settings, Terminal, X } from "lucide-react";
import { ThemeToggle } from "@/components/client-ui";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "My Subjects", icon: BookOpen },
  { href: "/sets", label: "My Study Sets", icon: Layers },
  { href: "/library", label: "PDF Library", icon: FileText },
  { href: "/codelab", label: "Coding Practice", icon: Terminal },
  { href: "/history", label: "Assessment History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
              active ? "bg-muted font-medium text-fg" : "text-fg-muted hover:bg-muted/60 hover:text-fg",
            )}
          >
            <item.icon className={cn("size-4", active && "text-brand-text")} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/** Reads the URL, so it sits behind a Suspense boundary; the fallback is the same list with nothing highlighted. */
function ActiveNavList({ onNavigate }: { onNavigate: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

export function Sidebar({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" aria-label="Dashboard">
          <Logo />
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-fg-muted hover:bg-muted" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>

      {open ? <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-surface transition-transform duration-200",
          "lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 lg:bg-transparent",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Dashboard" onClick={() => setOpen(false)}>
            <Logo />
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-fg-muted hover:bg-muted lg:hidden" aria-label="Close menu">
            <X className="size-4" />
          </button>
          <span className="hidden lg:block">
            <ThemeToggle />
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main">
          <Suspense fallback={<NavList pathname="" onNavigate={close} />}>
            <ActiveNavList onNavigate={close} />
          </Suspense>
        </nav>
        <div className="border-t border-border p-2">{footer}</div>
      </aside>
    </>
  );
}
