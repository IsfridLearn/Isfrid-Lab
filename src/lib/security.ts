// Small request-validation helpers shared by Server Actions and route handlers.

export const RECOVERY_COOKIE = "isfrid-recovery";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True only for a well-formed UUID string. Server Action arguments are untrusted input. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Returns the id when it is a UUID, otherwise null. */
export function uuidOrNull(value: unknown) {
  return isUuid(value) ? value : null;
}

/** Accepts only a plain same-site path ("/dashboard"); rejects "//host", "/\host" and absolute URLs. */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !/^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/.test(value)) return fallback;
  return value;
}

/** True when a state-changing request was sent by a page on this site (CSRF defence in depth). */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
