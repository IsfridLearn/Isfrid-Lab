"use client";

import { useActionState, useState } from "react";
import { updatePreferences } from "@/app/actions/profile";
import { ActionForm, FormMessage, SubmitButton } from "@/components/client-ui";
import { Button, Field, Input, Select } from "@/components/ui";

export function PreferencesForm({ weeklyGoal, timezone, timezones }: { weeklyGoal: number; timezone: string; timezones: string[] }) {
  const [state, action] = useActionState(updatePreferences, null);
  const [zone, setZone] = useState(timezone);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Weekly goal" hint="Assessments to complete each week (Monday to Sunday).">
        <Input name="weekly_goal" type="number" min={1} max={50} defaultValue={weeklyGoal} className="max-w-28" required />
      </Field>
      <Field label="Time zone" hint="Decides when a study day starts and ends for your streak.">
        <div className="flex flex-wrap gap-2">
          <Select name="timezone" value={zone} onChange={(e) => setZone(e.target.value)} className="max-w-xs">
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Button type="button" variant="ghost" onClick={() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>
            Use this device&apos;s
          </Button>
        </div>
      </Field>
      <SubmitButton variant="secondary">Save settings</SubmitButton>
    </ActionForm>
  );
}
