import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass, Card } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Setup" };

const STEPS = [
  { title: "Create a Supabase project", body: "Free tier is enough to start. supabase.com → New project." },
  { title: "Run the schema", body: "Open the SQL editor and run supabase/migrations/0001_init.sql from this repository. It creates every table, the security policies and the private documents bucket." },
  { title: "Add your keys", body: "Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Project Settings → API)." },
  { title: "Allow the auth redirect", body: "Authentication → URL Configuration: set the Site URL to this app's address and add <address>/auth/callback to Redirect URLs." },
  { title: "Restart the dev server", body: "Environment variables are read at startup. Then register your first account." },
];

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold">
        {isSupabaseConfigured ? "ISFRID is connected" : "Connect ISFRID to its backend"}
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        {isSupabaseConfigured
          ? "Supabase keys were found. You can register and sign in."
          : "Accounts, study sets and PDFs are stored in Supabase. No project is configured yet, so sign-in and everything behind it is unavailable until these steps are done."}
      </p>
      {isSupabaseConfigured ? (
        <Link href="/register" className={buttonClass("primary", "md", "mt-6")}>
          Create an account
        </Link>
      ) : (
        <Card className="mt-8 divide-y divide-border">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex gap-4 p-5">
              <span className="font-mono text-sm text-fg-subtle">{index + 1}</span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-fg-muted">{step.body}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
      <p className="mt-8 text-sm text-fg-subtle">
        Full instructions, including optional code execution for C, C++, Java and PHP, are in README.md.
      </p>
    </main>
  );
}
