import type { Metadata } from "next";
import { Container } from "@/components/marketing-general/container";
import { SectionHeading } from "@/components/marketing-general/section-heading";
import { SubHeading } from "@/components/marketing-general/subHeading";
import { LegalPlaceholder } from "@/components/marketing-general/legal";

export const metadata: Metadata = {
  title: "Contact | DBLuna",
};

export default function ContactPage() {
  return (
    <Container className="border-divide border-x px-4 py-16 md:px-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <SectionHeading className="lg:text-5xl">Get in touch</SectionHeading>
        <SubHeading as="p" className="mt-6 max-w-lg">
          Questions about DBLuna, a Pro or Enterprise plan, or something
          else? We'd like to hear from you.
        </SubHeading>

        <div className="mt-12 flex w-full flex-col gap-8 sm:flex-row sm:justify-center sm:gap-16">
          <div className="text-left">
            <p className="text-charcoal-700 text-sm font-medium dark:text-neutral-100">
              General & support
            </p>
            <a
              href="mailto:support@dbluna.com"
              className="text-brand mt-1 block text-sm underline"
            >
              <LegalPlaceholder>support@dbluna.com</LegalPlaceholder>
            </a>
          </div>
          <div className="text-left">
            <p className="text-charcoal-700 text-sm font-medium dark:text-neutral-100">
              Enterprise & sales
            </p>
            <a
              href="mailto:sales@dbluna.com"
              className="text-brand mt-1 block text-sm underline"
            >
              <LegalPlaceholder>sales@dbluna.com</LegalPlaceholder>
            </a>
          </div>
        </div>

        <p className="mt-12 text-xs text-gray-400 dark:text-neutral-600">
          These addresses are placeholders. Replace them with real inboxes
          before this page goes live.
        </p>
      </div>
    </Container>
  );
}
