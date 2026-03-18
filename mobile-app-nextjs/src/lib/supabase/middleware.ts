import type { Database } from "@/types/database"; // Optional but recommended for typing
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Shared cookie type (copy from server.ts or move to a shared types file)
type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

// Validate environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If environment variables are missing, allow unauthenticated access to login page only
  // and redirect all other routes to login
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing Supabase environment variables in middleware");

    // Allow access to login page so error can be displayed
    if (request.nextUrl.pathname === "/login") {
      return supabaseResponse;
    }

    // Redirect to login for all other pages
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Set value-only on request to propagate downstream
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Clone response with updated request headers
          supabaseResponse = NextResponse.next({
            request,
          });

          // Set full cookie (with options) on response
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refreshing the auth token
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("Error getting user in middleware:", err);
    // Continue with user = null, will redirect to login
  }

  // Protected routes - redirect to login if not authenticated
  const protectedRoutes = ["/", "/diesel", "/freight", "/profile"];
  const isProtectedRoute = protectedRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(route + "/")
  );

  if (
    !user &&
    isProtectedRoute &&
    !request.nextUrl.pathname.startsWith("/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect to home if logged in and trying to access login
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}