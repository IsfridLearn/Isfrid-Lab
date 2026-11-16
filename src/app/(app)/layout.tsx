import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { UserBadge, UserBadgeFallback } from "@/components/user-badge";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        footer={
          <Suspense fallback={<UserBadgeFallback />}>
            <UserBadge />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
