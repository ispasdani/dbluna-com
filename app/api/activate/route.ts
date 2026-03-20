import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

export async function POST(req: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // For this MVP, we generate a cryptographically signed JSON payload.
        // In a real app, this would verify the user's subscription tier in Stripe/Clerk
        // before issuing the offline license.
        const licenseData = {
            userId,
            issuedAt: Date.now(),
            validUntil: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
            tier: "pro"
        };

        const secret = process.env.LICENSE_SECRET || "mock-secret-key-for-mvp-offline-license";

        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify(licenseData)).toString("base64url");

        const signature = crypto.createHmac("sha256", secret)
            .update(`${header}.${payload}`)
            .digest("base64url");

        const licenseToken = `${header}.${payload}.${signature}`;

        return NextResponse.json({ license: licenseToken });
    } catch (error) {
        console.error("Activation error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
