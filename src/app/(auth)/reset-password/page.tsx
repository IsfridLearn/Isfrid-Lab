import { NewPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-1.5 mb-8 text-sm text-fg-muted">You&apos;re signed in from your reset link. Set a new password to finish.</p>
      <NewPasswordForm />
    </>
  );
}
