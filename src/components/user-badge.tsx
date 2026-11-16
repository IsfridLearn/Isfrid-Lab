import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getProfile, programLabel } from "@/lib/auth";

export async function UserBadge() {
  const profile = await getProfile();
  const name = profile?.full_name || "Your profile";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex items-center gap-1">
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 hover:bg-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text">
          {initials || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-fg">{name}</span>
          <span className="block truncate text-xs text-fg-subtle">{programLabel(profile)}</span>
        </span>
      </Link>
      <form action={signOut}>
        <button type="submit" className="rounded-md p-2 text-fg-subtle hover:bg-muted hover:text-fg" aria-label="Log out" title="Log out">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function UserBadgeFallback() {
  return <div className="h-11 animate-pulse rounded-lg bg-muted" />;
}
