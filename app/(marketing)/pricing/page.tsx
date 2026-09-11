import { DivideX } from "@/components/marketing-general/divideX";
import { Pricing } from "@/components/marketing-sections/pricing";
import { PricingCompareTable } from "@/components/marketing-sections/pricing-compare-table";
import { FAQs } from "@/components/marketing-sections/faq";

export const metadata = {
  title: "Pricing – dbluna",
  description:
    "Simple, transparent pricing. Start free and upgrade when you need the full canvas, imports, and cloud sync.",
};

export default function PricingPage() {
  return (
    <main>
      <DivideX />
      <Pricing />
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
