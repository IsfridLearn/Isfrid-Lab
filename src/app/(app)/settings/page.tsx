import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { NewPasswordForm } from "@/components/auth-forms";
import { ThemePicker } from "@/components/client-ui";
import { PreferencesForm } from "@/components/settings-forms";
import { Button, buttonClass, Card, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { isRemoteExecutionConfigured } from "@/lib/execution";

export const metadata = { title: "Settings" };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="grid gap-5 p-5 md:grid-cols-[14rem_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-fg-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </Card>
  );
}

export default async function SettingsPage() {
  const { user, profile, isTechnical } = await requireProfile();
  const zones = Intl.supportedValuesOf("timeZone");
  const timezones = zones.includes(profile.timezone) ? zones : [profile.timezone, ...zones];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Section title="Appearance" description="Light is the default. Dark is easier on long coding sessions.">
          <ThemePicker />
        </Section>
        <Section title="Study preferences" description="Your weekly goal and the time zone used for streaks.">
          <PreferencesForm weeklyGoal={profile.weekly_goal} timezone={profile.timezone} timezones={timezones} />
        </Section>
        <Section title="Profile" description="Name and academic program.">
          <Link href="/profile" className={buttonClass("secondary")}>
            Edit profile
          </Link>
        </Section>
        {isTechnical ? (
          <Section title="Code execution" description="Where each language runs when you press Run.">
            <ul className="space-y-1.5 text-sm text-fg-muted">
              <li>
                <span className="font-medium text-fg">Python, JavaScript, SQL</span> — run inside your browser. Always available.
              </li>
              <li>
                <span className="font-medium text-fg">C, C++, Java, PHP</span> —{" "}
                {isRemoteExecutionConfigured
                  ? "run on this deployment's isolated execution service."
                  : "need an execution service, and none is configured for this deployment. Exercises checked by matching blanks, output or a solution still work."}
              </li>
            </ul>
          </Section>
        ) : null}
        <Section title="Password" description={`Signed in as ${user.email}.`}>
          <NewPasswordForm compact />
        </Section>
        <Section title="Session" description="Log out of ISFRID on this device.">
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              <LogOut /> Log out
            </Button>
          </form>
        </Section>
      </div>
    </div>
  );
}
