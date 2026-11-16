import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-5 py-12 sm:py-20">
      <Link href="/" aria-label="ISFRID home">
        <Logo />
      </Link>
      <div className="mt-10 w-full max-w-sm animate-rise">{children}</div>
    </main>
  );
}
