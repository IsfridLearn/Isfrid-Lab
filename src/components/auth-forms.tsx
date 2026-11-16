"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { changePassword, requestPasswordReset, setRecoveredPassword, signIn, signUp } from "@/app/actions/auth";
import { completeOnboarding, updateProfile } from "@/app/actions/profile";
import { ActionForm, FormMessage, SubmitButton } from "@/components/client-ui";
import { Badge, Field, Input, Notice } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AcademicProgram } from "@/lib/types";

export function LoginForm() {
  const [state, action] = useActionState(signIn, null);
  const linkError = useSearchParams().get("error") === "link";
  return (
    <ActionForm action={action} className="space-y-4">
      {linkError && !state ? <Notice tone="danger">That link is invalid or has expired. Sign in or request a new one.</Notice> : null}
      <FormMessage state={state} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" maxLength={72} required />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Log in
      </SubmitButton>
      <p className="text-center text-sm text-fg-muted">
        <Link href="/forgot-password" className="hover:text-fg hover:underline">
          Forgot your password?
        </Link>
      </p>
    </ActionForm>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(signUp, null);
  if (state?.message) return <Notice tone="success">{state.message}</Notice>;
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Full name">
        <Input name="full_name" autoComplete="name" maxLength={120} required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Create account
      </SubmitButton>
    </ActionForm>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Send reset link
      </SubmitButton>
    </ActionForm>
  );
}

/** New-password form. `compact` is the Settings version, which also asks for the current password. */
export function NewPasswordForm({ compact }: { compact?: boolean }) {
  const [state, action] = useActionState(compact ? changePassword : setRecoveredPassword, null);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state} />
      {compact ? (
        <Field label="Current password">
          <Input name="current_password" type="password" autoComplete="current-password" maxLength={72} required />
        </Field>
      ) : null}
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Field label="Confirm new password">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <SubmitButton size={compact ? "md" : "lg"} className={compact ? undefined : "w-full"}>
        Update password
      </SubmitButton>
      {state?.message && !compact ? (
        <p className="text-center text-sm">
          <Link href="/dashboard" className="text-brand-text hover:underline">
            Continue to your dashboard
          </Link>
        </p>
      ) : null}
    </ActionForm>
  );
}

/** Name + academic program. Used by onboarding (with goal + time zone) and the profile page. */
export function ProfileForm({
  programs,
  initial,
  onboarding,
}: {
  programs: AcademicProgram[];
  initial: { full_name: string; program_id: string | null; custom_program: string | null };
  onboarding?: boolean;
}) {
  const [state, action] = useActionState(onboarding ? completeOnboarding : updateProfile, null);
  const [programId, setProgramId] = useState(initial.program_id ?? "");
  const timezoneInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (timezoneInput.current) timezoneInput.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [programId]);
  const selected = programs.find((p) => p.id === programId);

  return (
    <ActionForm action={action} className="space-y-6">
      <FormMessage state={state} />
      <Field label="Full name">
        <Input name="full_name" defaultValue={initial.full_name} maxLength={120} required />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Academic program</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {programs.map((program) => (
            <label
              key={program.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                programId === program.id ? "border-brand bg-brand-soft" : "border-border-strong bg-surface hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="program_id"
                value={program.id}
                checked={programId === program.id}
                onChange={() => setProgramId(program.id)}
                className="mt-0.5 accent-(--brand)"
                required
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{program.name}</span>
                <span className="mt-1 block">
                  {program.is_technical ? <Badge tone="brand">Includes Fill in the Code</Badge> : <Badge>Multiple choice + identification</Badge>}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {selected?.allows_custom_name ? (
        <Field label="Name of your program" hint="For example: BS Data Science, BS Accountancy.">
          <Input name="custom_program" defaultValue={initial.custom_program ?? ""} maxLength={120} required />
        </Field>
      ) : null}

      {onboarding ? (
        <>
          <Field label="Weekly goal" hint="Assessments you want to complete each week. You can change this later.">
            <Input name="weekly_goal" type="number" min={1} max={50} defaultValue={5} className="max-w-28" required />
          </Field>
          <input ref={timezoneInput} type="hidden" name="timezone" defaultValue="" />
        </>
      ) : null}

      <SubmitButton size={onboarding ? "lg" : "md"}>{onboarding ? "Continue to dashboard" : "Save profile"}</SubmitButton>
    </ActionForm>
  );
}
