import type { WebhookEvent } from "@clerk/nextjs/server";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

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

        // Idempotent: will insert if missing, patch if exists
        await ctx.runMutation(internal.users.createUser, {
          clerkId: data.id,
          email,
          firstName,
          lastName,
          imageUrl,
          credits: 0,
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
