import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Code2,
  Database,
  FileText,
  GitBranch,
  Search,
  Users,
} from "lucide-react";
import { Container } from "@/components/marketing-general/container";
import { Badge } from "@/components/marketing-general/badge";
import { SectionHeading } from "@/components/marketing-general/section-heading";
import { SubHeading } from "@/components/marketing-general/subHeading";
import { DivideX } from "@/components/marketing-general/divideX";
import { Button } from "@/components/marketing-general/button";
import { OpenEditorButton } from "@/components/marketing-general/open-editor-button";

export const metadata: Metadata = {
  title: "About",
};

const principles = [
  {
    title: "One source of truth",
    description:
      "The diagram, the DBML, and the docs are the same thing. Change one and the others follow, so nothing drifts out of sync.",
    icon: <GitBranch className="text-brand size-5" />,
  },
  {
    title: "Docs that write themselves",
    description:
      "A browsable, searchable documentation site is generated as you design. No second job to skip.",
    icon: <FileText className="text-brand size-5" />,
  },
  {
    title: "Bring what you already have",
    description:
      "Import from a live connection, a CSV, or a BACPAC file and get a documented schema in minutes instead of days.",
    icon: <Database className="text-brand size-5" />,
  },
];

const audiences = [
  {
    title: "Developers",
    description:
      "Sketch the schema before writing migrations, then keep it honest as the project grows.",
    icon: <Code2 className="text-brand size-5" />,
  },
  {
    title: "Data architects",
    description:
      "Model complex relationships visually and hand off something the whole team can read.",
    icon: <Search className="text-brand size-5" />,
  },
  {
    title: "New teammates",
    description:
      "Skip reverse-engineering old migration files. See how the tables fit together on day one.",
    icon: <Users className="text-brand size-5" />,
  },
];

export default function AboutPage() {
  return (
    <main>
      <DivideX />
      <Container className="border-divide flex flex-col items-center border-x px-4 pt-10 pb-10 text-center md:pt-20 md:pb-16">
        <Badge text="About" />
        <SectionHeading className="mt-4 lg:text-5xl">
          Database design, without the busywork
        </SectionHeading>
        <SubHeading as="p" className="mx-auto mt-6 max-w-xl px-2">
          DBLuna is a visual database schema design and documentation tool.
          We built it because designing a schema and documenting it always
          felt like two separate jobs, and the second one kept getting
          skipped.
        </SubHeading>
      </Container>
      <DivideX />

      <Container className="border-divide border-x">
        <div className="divide-divide grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="p-6 md:p-10">
            <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
              The problem
            </p>
            <p className="text-charcoal-700 mt-4 text-base leading-relaxed dark:text-neutral-200">
              Most teams design a database schema once, sketch it on a
              whiteboard or in a quick diagram, and then let it drift out of
              sync with reality as the project grows. New teammates end up
              reverse-engineering the schema from old migration files just to
              understand how the data fits together.
            </p>
          </div>
          <div className="p-6 md:p-10">
            <p className="text-brand text-sm font-medium">Our answer</p>
            <p className="text-charcoal-700 mt-4 text-base leading-relaxed dark:text-neutral-200">
              DBLuna keeps the diagram, the code, and the documentation as one
              thing. Design visually or in DBML, either one stays in sync with
              the other, and the documentation is generated automatically as
              you go.
            </p>
          </div>
        </div>
      </Container>
      <DivideX />

      <Container className="border-divide flex flex-col items-center border-x px-4 pt-10 pb-8 text-center">
        <Badge text="Principles" />
        <SectionHeading className="mt-4">What we care about</SectionHeading>
      </Container>
      <DivideX />
      <Container className="border-divide border-x">
        <div className="divide-divide grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {principles.map((item) => (
            <Card key={item.title} {...item} />
          ))}
        </div>
      </Container>
      <DivideX />

      <Container className="border-divide flex flex-col items-center border-x px-4 pt-10 pb-8 text-center">
        <Badge text="Who it's for" />
        <SectionHeading className="mt-4">Built for people who ship data</SectionHeading>
        <SubHeading as="p" className="mx-auto mt-6 max-w-lg px-2">
          And for anyone who has ever joined a project and had to ask "wait,
          how are these tables related again?"
        </SubHeading>
      </Container>
      <DivideX />
      <Container className="border-divide border-x">
        <div className="divide-divide grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {audiences.map((item) => (
            <Card key={item.title} {...item} />
          ))}
        </div>
      </Container>
      <DivideX />

      <Container className="border-divide flex flex-col items-center border-x px-4 py-16 text-center md:py-24">
        <SectionHeading className="max-w-3xl">
          See your schema the way your team should
        </SectionHeading>
        <SubHeading as="p" className="mx-auto mt-6 max-w-lg">
          Start on the free plan, or reach out if you have questions.
        </SubHeading>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <OpenEditorButton>Try it now</OpenEditorButton>
          <Button variant="secondary" as={Link} href="/contact">
            Get in touch
          </Button>
        </div>
      </Container>
      <DivideX />
    </main>
  );
}

const Card = ({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) => (
  <div className="p-6 md:p-8">
    <div className="flex size-9 items-center justify-center rounded-md bg-gray-50 dark:bg-neutral-800">
      {icon}
    </div>
    <h3 className="text-charcoal-700 mt-4 text-lg font-medium dark:text-neutral-100">
      {title}
    </h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
      {description}
    </p>
  </div>
);
