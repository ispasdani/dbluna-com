import type { WebhookEvent } from "@clerk/nextjs/server";
import { ConvexError } from "convex/values";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let event: WebhookEvent;

    try {
      event = await validateRequest(request);
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    // Clerk user events: https://clerk.com/docs/integrations/webhooks/events
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data;

        // Prefer primary email, fallback to first email
        const primaryEmailId = data.primary_email_address_id;
        const emailObj =
          data.email_addresses?.find((e) => e.id === primaryEmailId) ??
          data.email_addresses?.[0];

        const email = emailObj?.email_address;
        if (!email) return new Response("Missing email", { status: 422 });

        const firstName = (data.first_name ?? "").trim() || "User";
        const lastName = (data.last_name ?? "").trim() || undefined;
        const imageUrl = data.image_url ?? undefined;

        // New users default to the FREE plan explicitly. If FREE hasn't been
        // seeded yet (see convex/plans.ts), this is a no-op — planId stays
        // unset, which is equivalent to free/unauthorized as far as isPro()
        // is concerned.
        const freePlan = await ctx.runQuery(internal.plans.getBySlug, {
          slug: "free",
        });

        // Idempotent: will insert if missing, patch if exists
        await ctx.runMutation(internal.users.createUser, {
          clerkId: data.id,
          email,
          firstName,
          lastName,
          imageUrl,
          credits: 0,
          planId: freePlan?._id,
        });

        return new Response(null, { status: 200 });
      }

      case "subscription.created":
      case "subscription.updated":
      case "subscription.active":
      case "subscription.pastDue": {
        const data = event.data;
        const clerkId = data.payer?.user_id;
        // Org-payer subscriptions don't apply — this app has no org billing.
        if (!clerkId) return new Response(null, { status: 200 });

        const items = data.items ?? [];
        const current = items.find((item) => item.status === "active") ?? items[0];
        if (!current) return new Response(null, { status: 200 });

        await applyPlanUpdate(ctx, {
          clerkId,
          status: current.status,
          planSlug: current.plan?.slug,
          subscriptionId: data.id,
          periodStart: current.period_start,
          periodEnd: current.period_end,
        });

        return new Response(null, { status: 200 });
      }

      case "subscriptionItem.active":
      case "subscriptionItem.updated":
      case "subscriptionItem.canceled":
      case "subscriptionItem.ended":
      case "subscriptionItem.abandoned":
      case "subscriptionItem.pastDue": {
        const data = event.data;
        const clerkId = data.payer?.user_id;
        if (!clerkId) return new Response(null, { status: 200 });

        await applyPlanUpdate(ctx, {
          clerkId,
          status: data.status,
          planSlug: data.plan?.slug,
          periodStart: data.period_start,
          periodEnd: data.period_end,
          cancelAtPeriodEnd: data.status === "canceled",
        });

        return new Response(null, { status: 200 });
      }

      case "user.deleted": {
        const data = event.data;

        // Depending on Clerk typings, deleted event data can be partial.
        // Most importantly: make sure we have an id.
        const clerkId = data?.id;
        if (!clerkId) return new Response("Missing user id", { status: 422 });

        await ctx.runMutation(internal.users.deleteUser, { clerkId });
        return new Response(null, { status: 200 });
      }

      default:
        // Ignore other events
        return new Response(null, { status: 200 });
    }
  }),
});

export default http;

/**
 * Shared by the subscription.* and subscriptionItem.* webhook cases: resolves
 * the Convex plan row for a Clerk plan slug (if any) and patches the user's
 * subscription fields. Swallows "user not found" — Clerk billing events can
 * arrive before the corresponding user.created webhook has been processed,
 * and retrying indefinitely wouldn't help since there's nothing to patch yet.
 */
async function applyPlanUpdate(
  ctx: ActionCtx,
  args: {
    clerkId: string;
    status: string;
    planSlug?: string | null;
    subscriptionId?: string;
    periodStart?: number;
    periodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
  }
) {
  const plan = args.planSlug
    ? await ctx.runQuery(internal.plans.getBySlug, { slug: args.planSlug })
    : null;

  try {
    await ctx.runMutation(internal.users.updateUser, {
      clerkId: args.clerkId,
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.status,
      currentPeriodStart: args.periodStart
        ? new Date(args.periodStart).toISOString()
        : undefined,
      currentPeriodEnd: args.periodEnd
        ? new Date(args.periodEnd).toISOString()
        : undefined,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      planId: plan?._id,
    });
  } catch (err) {
    if (err instanceof ConvexError) return;
    throw err;
  }
}

async function validateRequest(req: Request): Promise<WebhookEvent> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("CLERK_WEBHOOK_SECRET is not defined");
  }

  const payload = await req.text();

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing Svix headers");
  }

  const wh = new Webhook(webhookSecret);
  const evt = wh.verify(payload, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  }) as WebhookEvent;

  return evt;
}
