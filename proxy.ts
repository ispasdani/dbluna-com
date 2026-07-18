import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clerkMiddleware,
  createRouteMatcher,
  type ClerkMiddlewareAuth,
} from "@clerk/nextjs/server";

// ✅ Public routes that don't require sign-in
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",

  // ✅ public marketing/docs
  "/userDocs(.*)",
  "/blog(.*)",
  "/about(.*)",
  "/pricing(.*)",

  // ✅ webhooks / endpoints that must remain public
  "/clerk(.*)",

  // If you want *some* API public, keep it narrow:
  // "/api/public(.*)",
  // Otherwise remove this and protect APIs by default.
  "/api/(.*)",
]);

export default clerkMiddleware(
  async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    // Require sign-in for protected routes
    // ✅ This includes /d/* because it is NOT in isPublicRoute
    if (!isPublicRoute(req)) {
      await auth.protect();
    }

    return NextResponse.next();
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
