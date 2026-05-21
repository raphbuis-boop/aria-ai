import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path === "/crm") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  if (path === "/landing") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/landing.html";
    return NextResponse.rewrite(url);
  }

  const isPublic =
    path.startsWith("/api") ||
    path.startsWith("/portal") ||
    path.startsWith("/demo") ||
    path.startsWith("/bba/sign") ||
    path.startsWith("/property-search") ||
    // Sentry tunnel route — bypasses ad blockers by routing
    // Sentry SDK traffic through our own domain. Must be public so
    // unauthenticated client errors can still be captured.
    path.startsWith("/monitoring") ||
    path.startsWith("/auth/") ||
    path === "/login" ||
    path === "/login/email" ||
    path === "/signup" ||
    path === "/setup" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/about" ||
    path === "/contact" ||
    path === "/dmca" ||
    path === "/accessibility" ||
    path === "/fair-housing" ||
    path === "/landing.html" ||
    path === "/sentry-example-page";

  if (isPublic) {
    if (
      user &&
      (path === "/login" || path === "/login/email" || path === "/signup")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|JPG|gif|webp)$).*)",
  ],
};
