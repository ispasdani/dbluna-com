import React from "react";
import { Container } from "./container";
import { SectionHeading } from "./section-heading";

export const LegalPlaceholder = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
    {children}
  </span>
);

export const LegalPage = ({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) => (
  <Container className="border-divide border-x px-4 py-16 md:px-8">
    <div className="mx-auto max-w-3xl">
      <SectionHeading className="text-left lg:text-4xl">
        {title}
      </SectionHeading>
      <p className="mt-2 text-sm text-gray-500 dark:text-neutral-500">
        Last updated: {lastUpdated}
      </p>
      <div className="mt-10 flex flex-col gap-8 text-sm leading-relaxed text-gray-600 dark:text-neutral-300">
        {children}
      </div>
    </div>
  </Container>
);

export const LegalSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <h2 className="text-charcoal-700 text-lg font-medium dark:text-neutral-100">
      {title}
    </h2>
    <div className="mt-2 flex flex-col gap-3">{children}</div>
  </section>
);

export const LegalList = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="ml-5 flex list-disc flex-col gap-2">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);
