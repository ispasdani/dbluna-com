import { ClerkProvider, PricingTable } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <ClerkProvider>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <PricingTable />
      </div>
    </ClerkProvider>
  );
}
