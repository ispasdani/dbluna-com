import { DivideX } from "@/components/marketing-general/divideX";
import { Pricing } from "@/components/marketing-sections/pricing";
import { PricingCompareTable } from "@/components/marketing-sections/pricing-compare-table";
import { FAQs } from "@/components/marketing-sections/faq";
import { getProPlanId } from "@/lib/billing/pro-plan";

export const metadata = {
  title: "Pricing – dbluna",
  description:
    "Simple, transparent pricing. Start free and upgrade when you need the full canvas, imports, and cloud sync.",
};

export default async function PricingPage() {
  // Resolved here rather than read from an env var, so the plan is identified
  // by the same "pro" slug the webhook and the Convex guards use.
  const proPlanId = await getProPlanId();

  return (
    <main>
      <DivideX />
      <Pricing proPlanId={proPlanId} />
      <DivideX />
      <PricingCompareTable />
      <DivideX />
      <div id="faq">
        <FAQs />
      </div>
      <DivideX />
    </main>
  );
}
