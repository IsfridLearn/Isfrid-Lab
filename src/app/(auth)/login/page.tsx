import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1.5 mb-8 text-sm text-fg-muted">Log in to pick up where you left off.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-fg-muted">
        New to ISFRID?{" "}
        <Link href="/register" className="font-medium text-brand-text hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
