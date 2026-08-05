"use client";

import React from "react";
import {
  Database,
  FileJson,
  FileText,
  Palette,
  Share2,
  ShieldCheck,
} from "lucide-react";
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
  AISchemaGeneratorSkeleton,
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
              <CardTitle>AI Schema Generator</CardTitle>
            </div>
            <CardDescription>
              Describe what you're building in plain English and get a
              ready-to-edit starter schema in seconds—no prompt engineering
              required.
            </CardDescription>
            <AISchemaGeneratorSkeleton />
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
              <FileText className="h-6 w-6" />
              <CardTitle>Instant Documentation</CardTitle>
            </div>
            <CardDescription>
              Automatically generate comprehensive database documentation with
              schema diagrams, table relationships, and field descriptions
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              <CardTitle>Multi-Source Import</CardTitle>
            </div>
            <CardDescription>
              Pull schema straight from a live PostgreSQL or SQL Server
              connection, a CSV, or a BACPAC file—auto-laid-out on the canvas
              in seconds
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Share2 className="h-6 w-6" />
              <CardTitle>No-Account Share Links</CardTitle>
            </div>
            <CardDescription>
              Share a read-only link that renders entirely in the browser—no
              account required, nothing sent to a server
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              <CardTitle>Real-Time Schema Validation</CardTitle>
            </div>
            <CardDescription>
              Catch duplicate table names, reserved keywords, orphaned
              tables, and foreign-key type mismatches as you design
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <FileJson className="h-6 w-6" />
              <CardTitle>DBML & JSON Export</CardTitle>
            </div>
            <CardDescription>
              Export a full-fidelity DBML or JSON snapshot of your diagram,
              and import it back exactly as it was
            </CardDescription>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Palette className="h-6 w-6" />
              <CardTitle>Six Canvas Themes</CardTitle>
            </div>
            <CardDescription>
              Switch between Default, Blue, Cyberpunk, Contrast, Tokyo Night,
              and Dracula palettes to match your setup
            </CardDescription>
          </Card>
        </div>
      </div>
    </Container>
  );
};
