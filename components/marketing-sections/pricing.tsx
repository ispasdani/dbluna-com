"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  ClerkLoaded,
  ClerkLoading,
  SignInButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { Container } from "../marketing-general/container";
import { Badge } from "../marketing-general/badge";
import { SectionHeading } from "../marketing-general/section-heading";
import { Scale } from "../marketing-general/scale";
import { DivideX } from "../marketing-general/divideX";
import { Button } from "../marketing-general/button";
import { tiers } from "@/constants/pricing";
import { SlidingNumber } from "../marketing-general/sliding-number";
import { CheckIcon } from "../uiJsxAssets/check-icon";

export const Pricing = ({ proPlanId }: { proPlanId?: string | null }) => {
  const tabs = [
    {
      title: "Monthly",
      value: "monthly",
      badge: "",
    },
    {
      title: "Yearly",
      value: "yearly",
      badge: "Save 20%",
    },
  ];

  const [activeTier, setActiveTier] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="">
      <Container className="border-divide flex flex-col items-center justify-center border-x pt-10 pb-10">
        <Badge text="Pricing" />
        <SectionHeading className="mt-4">
          Simple and Feasible Pricing
        </SectionHeading>
        <div className="relative mt-8 flex items-center gap-4 rounded-xl bg-gray-50 p-2 dark:bg-neutral-800">
          <Scale className="opacity-50" />
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTier(tab.value as "monthly" | "yearly")}
              className="relative z-20 flex w-32 justify-center py-1 text-center sm:w-40"
            >
              {activeTier === tab.value && (
                <motion.div
                  layoutId="active-span"
                  className="shadow-aceternity absolute inset-0 h-full w-full rounded-md bg-white dark:bg-neutral-950"
                ></motion.div>
              )}
              <span className="relative z-20 flex items-center gap-2 text-sm sm:text-base">
                {tab.title}{" "}
                {tab.badge && (
                  <span className="bg-brand/10 text-brand rounded-full px-2 py-1 text-xs font-medium">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </Container>
      <DivideX />
      <Container className="border-divide border-x">
        <div className="divide-divide grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {tiers.map((tier, tierIdx) => (
            <div className="p-4 md:p-8" key={tier.title + "tier-meta"}>
              <h3 className="text-charcoal-700 text-xl font-medium dark:text-neutral-100">
                {tier.title}
              </h3>
              <p className="text-base text-gray-600 dark:text-neutral-400">
                {tier.subtitle}
              </p>
              <span className="mt-6 flex items-baseline-last text-2xl font-medium dark:text-white">
                {(activeTier === "monthly" ? tier.monthly : tier.yearly) ==
                null ? (
                  "Custom"
                ) : (
                  <>
                    $
                    <Price
                      value={
                        activeTier === "monthly" ? tier.monthly : tier.yearly
                      }
                    />
                    <span className="ml-2 text-sm font-normal">/seat</span>
                  </>
                )}
              </span>

              {tier.note && (
                <p className="text-charcoal-700 mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
                  {tier.note}
                </p>
              )}

              <div
                key={tier.title + "tier-list-of-items"}
                className="flex flex-col gap-4 px-0 py-4 md:hidden md:p-8"
              >
                {tier.features.map((tierFeature, idx) => (
                  <Step key={tierFeature + tierIdx + idx}>{tierFeature}</Step>
                ))}
              </div>
              <TierCta tier={tier} period={activeTier} proPlanId={proPlanId} />
            </div>
          ))}
        </div>
      </Container>
      <DivideX />
      <Container className="border-divide hidden border-x md:block">
        <div className="divide-divide grid grid-cols-1 md:grid-cols-3 md:divide-x">
          {tiers.map((tier, index) => (
            <div
              key={tier.title + "tier-list-of-items"}
              className="flex flex-col gap-4 p-4 md:p-8"
            >
              {tier.features.map((tierFeature, idx) => (
                <Step key={tierFeature + index + idx}>{tierFeature}</Step>
              ))}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};

/** Module-scoped so the hint appears once, not once per tier per render. */
let warnedAboutMissingPlanId = false;

type Tier = (typeof tiers)[number];

/**
 * The call to action for one tier.
 *
 * Paid tiers open Clerk's checkout drawer in place, keeping this pricing page
 * as designed rather than handing the whole layout to Clerk's own
 * `<PricingTable />`. Signed-out visitors get the sign-in modal first —
 * CheckoutButton requires an authenticated user — and return here afterwards.
 */
const TierCta = ({
  tier,
  period,
  proPlanId,
}: {
  tier: Tier;
  period: "monthly" | "yearly";
  proPlanId?: string | null;
}) => {
  const className = "mt-6 w-full";
  const variant = tier.featured ? "brand" : "secondary";
  const checkout = "ctaCheckout" in tier && tier.ctaCheckout === true;

  // Developer hint, not a runtime problem: the CTA still renders, it just
  // falls back to a link pointing at the page it's on, which looks exactly
  // like a broken button. Deliberately an effect and a `warn` — logging during
  // render runs on every pass, and Next promotes a render-time `console.error`
  // into the full-screen error overlay.
  useEffect(() => {
    if (!checkout || proPlanId || warnedAboutMissingPlanId) return;
    if (process.env.NODE_ENV === "production") return;

    warnedAboutMissingPlanId = true;
    console.warn(
      "[pricing] Could not resolve the Clerk plan id for checkout, so the Pro CTA falls back " +
        "to a link. Check Billing is enabled and a plan with slug \"pro\" exists — see the " +
        "server log from lib/billing/pro-plan.ts for the reason."
    );
  }, [checkout, proPlanId]);

  if (!checkout || !proPlanId) {
    return (
      <Button className={className} as={Link} href={tier.ctaLink} variant={variant}>
        {tier.ctaText}
      </Button>
    );
  }

  return (
    <>
      {/* SignedIn/SignedOut both render nothing until Clerk has loaded and
          resolved auth state — around two seconds on a cold dev load. Without
          this the Pro CTA is simply absent for that window: the card reflows,
          and anyone who clicks where the button should be gets nothing,
          because there is nothing there. */}
      <ClerkLoading>
        <Button className={className} variant={variant} disabled aria-busy="true">
          {tier.ctaText}
        </Button>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>
          <CheckoutButton
            planId={proPlanId}
            // Clerk's period names differ from this page's tab labels.
            planPeriod={period === "monthly" ? "month" : "annual"}
            newSubscriptionRedirectUrl="/d"
          >
            <Button className={className} variant={variant}>
              {tier.ctaText}
            </Button>
          </CheckoutButton>
        </SignedIn>
        <SignedOut>
          {/* CheckoutButton requires an authenticated user, so sign in first
              and come back here rather than failing on click. */}
          <SignInButton mode="modal" forceRedirectUrl="/pricing">
            <Button className={className} variant={variant}>
              {tier.ctaText}
            </Button>
          </SignInButton>
        </SignedOut>
      </ClerkLoaded>
    </>
  );
};

const Step = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="text-charcoal-700 flex items-center gap-2 dark:text-neutral-100">
      <CheckIcon className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
};

const Price = ({ value }: { value: number | null }) => {
  return <SlidingNumber value={value} />;
};
