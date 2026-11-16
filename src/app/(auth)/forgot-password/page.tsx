import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1.5 mb-8 text-sm text-fg-muted">Enter your email and we&apos;ll send a link to choose a new password.</p>
      <ForgotPasswordForm />
      <p className="mt-8 text-center text-sm text-fg-muted">
        <Link href="/login" className="font-medium text-brand-text hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
