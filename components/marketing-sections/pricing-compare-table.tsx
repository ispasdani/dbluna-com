"use client";

import React from "react";
import { pricingTable, tiers } from "@/constants/pricing";
import { Container } from "@/components/marketing-general/container";
import { Badge } from "@/components/marketing-general/badge";
import { SectionHeading } from "@/components/marketing-general/section-heading";
import { DivideX } from "@/components/marketing-general/divideX";

export const PricingCompareTable = () => {
  return (
    <section>
      <Container className="border-divide flex flex-col items-center border-x pt-10 pb-8">
        <Badge text="Compare" />
        <SectionHeading className="mt-4">Everything side by side</SectionHeading>
      </Container>
      <DivideX />
      <Container className="border-divide border-x pb-16">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-2/5 p-4 text-left text-sm font-medium text-gray-500 md:p-6 dark:text-neutral-400" />
                {tiers.map((tier) => (
                  <th
                    key={tier.title}
                    className={`w-1/5 p-4 text-center text-sm font-semibold md:p-6 ${
                      tier.featured
                        ? "text-brand"
                        : "text-charcoal-700 dark:text-neutral-100"
                    }`}
                  >
                    {tier.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-divide divide-y">
              {pricingTable.map((row) => (
                <tr
                  key={row.title}
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/40"
                >
                  <td className="p-4 text-sm text-gray-700 md:p-6 dark:text-neutral-300">
                    {row.title}
                  </td>
                  {row.tiers.map((tierData) => (
                    <td
                      key={tierData.title}
                      className="p-4 text-center text-sm text-gray-700 md:p-6 dark:text-neutral-300"
                    >
                      {tierData.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
};
