import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1.5 mb-8 text-sm text-fg-muted">Upload a PDF and build your first study set in minutes.</p>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-text hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
