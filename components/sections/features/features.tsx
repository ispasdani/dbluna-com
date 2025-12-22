"use client";

import React from "react";
import { FileText, FlaskConical, Users } from "lucide-react";
import { Container } from "@/components/marketing-general/container";
import { SectionHeading } from "@/components/marketing-general/section-heading";
import { Badge } from "@/components/marketing-general/badge";
import { SubHeading } from "@/components/marketing-general/subHeading";
import { NativeIcon } from "@/components/uiJsxAssets/native-icon";
import { BrainIcon } from "@/components/uiJsxAssets/brain-icon";
import { MouseBoxIcon } from "@/components/uiJsxAssets/mouse-box-icon";
import { Card } from "@/components/marketing-general/card";
import { CardTitle } from "@/components/marketing-general/cart-title";
import { CardDescription } from "@/components/marketing-general/card-description";
import {
  LLMModelSelectorSkeleton,
  NativeToolsIntegrationSkeleton,
  TextToWorkflowBuilderSkeleton,
} from "./skeletons";

type Tab = {
  title: string;
  description: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  id: string;
};

export const Features = () => {
  return (
    <Container className="border-divide border-x">
      <div className="flex flex-col items-center py-16">
        <Badge text="Features" />
        <SectionHeading className="mt-4">
          Professional Database Design Tools
        </SectionHeading>

        <SubHeading as="p" className="mx-auto mt-6 max-w-lg px-2">
          Interactive canvas, intelligent validation, and multi-format export
          for teams who build data-driven applications
        </SubHeading>
        <div className="border-divide divide-divide mt-16 grid grid-cols-1 divide-y border-y md:grid-cols-2 md:divide-x">
          <Card className="overflow-hidden mask-b-from-80%">
            <div className="flex items-center gap-2">
              <BrainIcon />
              <CardTitle>LLM Model Selector</CardTitle>
            </div>
            <CardDescription>
              Start fast with built-in models or bring your own API keys for
              custom providers—seamlessly switch between options as your needs
              evolve.
            </CardDescription>
            <LLMModelSelectorSkeleton />
          </Card>
          <Card className="overflow-hidden mask-b-from-80%">
            <div className="flex items-center gap-2">
              <NativeIcon />
              <CardTitle>From Code to Canvas, Instantly</CardTitle>
            </div>
            <CardDescription>
              Write your schema in SQL or DBML, and your diagram builds itself
              automatically. Define tables, set foreign keys, establish
              relationships,all through code.
            </CardDescription>
            <TextToWorkflowBuilderSkeleton />
          </Card>
        </div>
        <div className="w-full">
          <Card className="relative w-full max-w-none overflow-hidden">
            <div className="pointer-events-none absolute inset-0 h-full w-full bg-[radial-gradient(var(--color-dots)_1px,transparent_1px)] mask-radial-from-10% [background-size:10px_10px]"></div>
            <div className="flex items-center gap-2">
              <MouseBoxIcon />
              <CardTitle>Native Visual Schema Builder</CardTitle>
            </div>
            <CardDescription>
              Design your database structure intuitively with drag-and-drop
              tables, columns, and relationships—no code required.
            </CardDescription>
            <NativeToolsIntegrationSkeleton />
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <Card>
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6" />
              <CardTitle>Instant Documentation</CardTitle>
            </div>
            <CardDescription>
              Automatically generate comprehensive database documentation with
              schema diagrams, table relationships, and field descriptions
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <FlaskConical className="w-6 h-6" />
              <CardTitle>Interactive Playground</CardTitle>
            </div>
            <CardDescription>
              Test queries, simulate data, and validate your schema in a safe
              sandbox environment before deployment
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              <CardTitle>Real-Time Collaboration</CardTitle>
            </div>
            <CardDescription>
              Design schemas together with your team through live cursor
              tracking, instant updates, and seamless synchronization
            </CardDescription>
          </Card>
        </div>
      </div>
    </Container>
  );
};
