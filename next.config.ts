// Next.js configuration: rendering flags and the security headers sent with every response.
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const JSDELIVR = "https://cdn.jsdelivr.net";
const CDNJS = "https://cdnjs.cloudflare.com";

/** Origins of the configured Supabase project (HTTPS API + realtime websocket), if any. */
function supabaseOrigins() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return [url.origin, url.origin.replace(/^http/, "ws")];
  } catch {
    return [];
  }
}

const csp = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

const pageCsp = csp({
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", JSDELIVR, ...(isDev ? ["'unsafe-eval'"] : [])],
  "style-src": ["'self'", "'unsafe-inline'", JSDELIVR],
  "font-src": ["'self'", "data:", "blob:", JSDELIVR],
  "img-src": ["'self'", "data:", "blob:"],
  "connect-src": ["'self'", JSDELIVR, ...supabaseOrigins(), ...(isDev ? ["ws:"] : [])],
  "worker-src": ["'self'", "blob:"],
  "frame-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
});

const sandbox = (script: string[], connect: string[]) =>
  csp({ "default-src": ["'none'"], "script-src": script, "connect-src": connect.length ? connect : ["'none'"] });

const baseHeaders = [
  { key: "Content-Security-Policy", value: pageCsp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      {
        source: "/runners/js-worker.js",
        headers: [{ key: "Content-Security-Policy", value: sandbox(["'unsafe-eval'"], []) }],
      },
      {
        source: "/runners/py-worker.js",
        headers: [{ key: "Content-Security-Policy", value: sandbox(["'unsafe-eval'", "'wasm-unsafe-eval'", JSDELIVR], [JSDELIVR]) }],
      },
      {
        source: "/runners/sql-worker.js",
        headers: [{ key: "Content-Security-Policy", value: sandbox(["'wasm-unsafe-eval'", CDNJS], [CDNJS]) }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
