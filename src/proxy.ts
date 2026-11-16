import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

const PUBLIC_PATHS = ["/", "/setup"];
const AUTH_PATHS = ["/login", "/register", "/forgot-password"];

/** Refreshes the session cookie and redirects signed-out visitors away from protected pages. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = AUTH_PATHS.includes(pathname);

  if (!isSupabaseConfigured) {
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (signedIn && isAuthPage) return redirectTo("/dashboard");
  if (!signedIn && !isPublic && !isAuthPage && !pathname.startsWith("/auth/")) return redirectTo("/login");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pdfjs/|runners/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
