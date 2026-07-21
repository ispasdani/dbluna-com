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

  // ✅ read-only share-link viewer — must never require sign-in, that's the
  // whole point of an anonymous share link (see release-1-0/share-via-url-plan.md)
  "/d/view(.*)",

  // If you want *some* API public, keep it narrow:
  // "/api/public(.*)",
  // Otherwise remove this and protect APIs by default.
  "/api/(.*)",
]);

export default clerkMiddleware(
  async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    // Require sign-in for protected routes
    // ✅ This includes /d/[id] because it is NOT in isPublicRoute — /d/view is
    // the one exception, listed above.
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
