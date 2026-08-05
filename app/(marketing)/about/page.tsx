import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing-general/container";
import { SectionHeading } from "@/components/marketing-general/section-heading";
import { SubHeading } from "@/components/marketing-general/subHeading";
import { Button } from "@/components/marketing-general/button";
import { ButtonWithIdGenerator } from "@/components/marketing-general/buttonWithIdGenerator";

export const metadata: Metadata = {
  title: "About | DBLuna",
};

export default function AboutPage() {
  return (
    <Container className="border-divide border-x px-4 py-16 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <SectionHeading className="lg:text-5xl">
          Database design, without the busywork
        </SectionHeading>
        <SubHeading as="p" className="mt-6 max-w-xl">
          DBLuna is a visual database schema design and documentation tool.
          We built it because designing a schema and documenting it always
          felt like two separate jobs, and the second one kept getting
          skipped.
        </SubHeading>
      </div>

      <div className="mx-auto mt-16 flex max-w-2xl flex-col gap-8 text-sm leading-relaxed text-gray-600 dark:text-neutral-300">
        <p>
          Most teams design a database schema once, sketch it on a
          whiteboard or in a quick diagram, and then let it drift out of
          sync with reality as the project grows. New teammates end up
          reverse-engineering the schema from old migration files just to
          understand how the data fits together.
        </p>
        <p>
          DBLuna keeps the diagram, the code, and the documentation as one
          thing. Design visually or in DBML, either one stays in sync with
          the other, and a browsable, searchable documentation site is
          generated automatically as you go. Import an existing database
          straight from a live connection, a CSV, or a BACPAC file, and get
          a documented schema in minutes instead of days.
        </p>
        <p>
          It's built for developers, data architects, and anyone who has
          ever joined a project and had to ask "wait, how are these tables
          related again?"
        </p>
      </div>

      <div className="mt-16 flex flex-col items-center gap-4">
        <ButtonWithIdGenerator>Start building</ButtonWithIdGenerator>
        <Button variant="secondary" as={Link} href="/contact">
          Get in touch
        </Button>
      </div>
    </Container>
  );
}
