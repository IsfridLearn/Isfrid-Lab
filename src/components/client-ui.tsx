"use client";

import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Monitor, Moon, Sun, X } from "lucide-react";
import { Button, buttonClass, Notice } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/types";

const PendingContext = createContext(false);

/** Form that runs a Server Action without React's automatic reset, so typed input survives an error. */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  className?: string;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <PendingContext value={pending}>{children}</PendingContext>
    </form>
  );
}

/** Submit button that shows a spinner while its form's Server Action runs. */
export function SubmitButton({
  children,
  variant,
  size,
  className,
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const pending = use(PendingContext) || status.pending;
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

/** A submit button that asks for confirmation first. Place inside a <form action={…}>. */
export function ConfirmSubmit({
  message,
  children,
  variant = "danger",
  size = "sm",
  className,
}: {
  message: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-card border border-border bg-surface p-0 text-fg shadow-pop",
        wide ? "max-w-2xl" : "max-w-md",
      )}
    >
      {open ? (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-fg-subtle hover:bg-muted hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

/** Button + modal pair for small create/edit forms rendered from Server Components. */
export function ModalButton({
  label,
  title,
  icon,
  variant = "primary",
  size = "md",
  wide,
  children,
}: {
  label: ReactNode;
  title: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  wide?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide={wide}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}

type Theme = "light" | "dark" | "system";
const THEME_KEY = "isfrid-theme";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "dark" || stored === "system" ? stored : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  listeners.forEach((notify) => notify());
}

export function useTheme() {
  return useSyncExternalStore<Theme>(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    readTheme,
    () => "light",
  );
}

/** True when the page is currently rendered dark (used by the code editor). */
export function useIsDark() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function ThemePicker() {
  const theme = useTheme();
  const options: { id: Theme; label: string; icon: ReactNode }[] = [
    { id: "light", label: "Light", icon: <Sun className="size-4" /> },
    { id: "dark", label: "Dark", icon: <Moon className="size-4" /> },
    { id: "system", label: "System", icon: <Monitor className="size-4" /> },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border-strong bg-surface p-0.5" role="radiogroup" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={theme === option.id}
          onClick={() => applyTheme(option.id)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
            theme === option.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const dark = useIsDark();
  return (
    <button
      type="button"
      onClick={() => applyTheme(dark ? "light" : "dark")}
      className="rounded-md p-2 text-fg-muted transition-colors hover:bg-muted hover:text-fg"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
