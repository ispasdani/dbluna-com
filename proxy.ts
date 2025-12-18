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

  // ✅ public sandbox (new)
  "/sandbox(.*)",

  // ✅ webhooks / endpoints that must remain public
  "/clerk(.*)",

  // If you want *some* API public, keep it narrow:
  // "/api/public(.*)",
  // Otherwise remove this and protect APIs by default.
  "/api/(.*)",
]);

export default clerkMiddleware(
  async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    const res = NextResponse.next();

    // 1) Assign visitorId cookie (analytics-only)
    if (!req.cookies.get("visitorId")) {
      res.cookies.set({
        name: "visitorId",
        value: crypto.randomUUID(),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    // 2) Require sign-in for protected routes
    // ✅ This now includes /d/* because it is NOT in isPublicRoute anymore
    if (!isPublicRoute(req)) {
      await auth.protect();
    }

    return res;
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
