"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Container } from "../../marketing-general/container";
import { Badge } from "../../marketing-general/badge";
import { SectionHeading } from "../../marketing-general/section-heading";
import { SubHeading } from "../../marketing-general/subHeading";
import { Scale } from "../../marketing-general/scale";
import { GraphIcon } from "../../uiJsxAssets/graph-icon";
import { RocketIcon } from "../../uiJsxAssets/rocket-icon";
import { ReuseBrainIcon } from "../../uiJsxAssets/reuse-brain-icon";
import { ShieldIcon } from "../../uiJsxAssets/shield-icon";
import { ScreenCogIcon } from "../../uiJsxAssets/screen-cog-icon";
import { BellIcon } from "../../uiJsxAssets/bell-icon";
import { LogoSVG } from "../../uiJsxAssets/logo";
import { RealtimeSyncIcon } from "../../uiJsxAssets/real-time-sync-icon";
import { HorizontalLine } from "../../uiJsxAssets/horizontal-line";
import { VerticalLine } from "../../uiJsxAssets/vertical-line";
import { MiniTable } from "./skeletons";
import { AlertCircle, Cloud, Code, Link2, Table } from "lucide-react";
import {
  SCENE_STYLE,
  SceneLink,
  SceneRowHighlight,
  SceneTableCard,
  TABLE_W,
  rowY,
  route,
  type SceneLinkDef,
  type SceneTable,
} from "../../marketing-general/canvas-scene";

export const Benefits = () => {
  const benefits = [
    {
      title: "Design Faster",
      description:
        "Build database schemas visually with drag-and-drop, or write DBML instead",
      icon: <RocketIcon className="text-brand size-6" />,
    },
    {
      title: "Never Lose Work",
      description:
        "Every diagram autosaves locally, with optional cloud sync when you're ready",
      icon: <RealtimeSyncIcon className="text-brand size-6" />,
    },
    {
      title: "Export Anywhere",
      description:
        "Export a full-fidelity DBML or JSON snapshot, ready to import back anytime",
      icon: <GraphIcon className="text-brand size-6" />,
    },
    {
      title: "Reuse Templates",
      description:
        "Start from pre-built schemas for common use cases and customize to your needs",
      icon: <ReuseBrainIcon className="text-brand size-6" />,
    },
    {
      title: "Catch Issues Early",
      description:
        "Automatically catch duplicate names, missing keys, and type mismatches",
      icon: <ShieldIcon className="text-brand size-6" />,
    },
    {
      title: "Iterate Quickly",
      description:
        "Make changes instantly and see how they affect your entire schema in real-time",
      icon: <ScreenCogIcon className="text-brand size-6" />,
    },
  ];
  return (
    <Container className="border-divide relative overflow-hidden border-x px-4 py-20 md:px-8">
      <div className="relative flex flex-col items-center">
        <Badge text="Benefits" />
        <SectionHeading className="mt-4">
          Making Database Design Effortless
        </SectionHeading>

        <SubHeading as="p" className="mx-auto mt-6 max-w-lg">
          Design, document, and share database schemas faster with visual
          tools and instant code generation
        </SubHeading>
      </div>
      <div className="mt-20 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="grid grid-cols-1 gap-4">
          {benefits.slice(0, 3).map((benefit, index) => (
            <Card key={benefit.title} {...benefit} />
          ))}
        </div>
        <MiddleCard />
        <div className="grid grid-cols-1 gap-4">
          {benefits.slice(3, 6).map((benefit, index) => (
            <Card key={benefit.title} {...benefit} />
          ))}
        </div>
      </div>
    </Container>
  );
};

// The editor window in the middle card: users → orders, the line "hovered".
const WINDOW_SCENE: SceneTable[] = [
  {
    name: "users",
    color: "#6366f1",
    x: 16,
    y: 18,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "email", type: "text", kind: "uq" },
      { name: "name", type: "text" },
    ],
  },
  {
    name: "orders",
    color: "#f59e0b",
    x: 236,
    y: 56,
    cols: [
      { name: "id", type: "int", kind: "pk" },
      { name: "user_id", type: "int", kind: "fk" },
      { name: "total", type: "numeric" },
    ],
  },
];

const WINDOW_LINK: SceneLinkDef = {
  d: route(WINDOW_SCENE[0].x + TABLE_W, rowY(WINDOW_SCENE[0], 0), WINDOW_SCENE[1].x, rowY(WINDOW_SCENE[1], 1), 208),
  oneAt: [WINDOW_SCENE[0].x + TABLE_W + 8, rowY(WINDOW_SCENE[0], 0)],
  manyAt: [WINDOW_SCENE[1].x, rowY(WINDOW_SCENE[1], 1)],
  manyDir: 1,
};

const MiddleCard = () => {
  const texts = [
    "Schema exported",
    "Table created",
    "Relationship added",
    "Docs generated",
  ];
  const [activeText, setActiveText] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveText((prev) => (prev + 1) % texts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="relative flex min-h-40 flex-col justify-end overflow-hidden rounded-lg bg-gray-50 p-4 md:p-5 dark:bg-neutral-900">
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-dots)_1px,transparent_1px)] mask-radial-from-10% [background-size:10px_10px] shadow-xl"></div>

      <div className="flex items-center justify-center">
        <MiniTable label="users" />

        <HorizontalLine />

        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
          <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-blue-500)_20%,transparent_30%)] [animation-duration:2s]"></div>
          <div className="via-brand absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-brand)_20%,transparent_30%)] [animation-delay:1s] [animation-duration:2s]"></div>
          <div className="relative z-20 flex h-full w-full items-center justify-center rounded-[5px] bg-white dark:bg-neutral-900">
            <LogoSVG />
          </div>
        </div>

        <HorizontalLine />

        <MiniTable label="orders" />
      </div>

      <div className="relative z-20 flex flex-col items-center justify-center">
        <VerticalLine />
        <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <Cloud className="size-3.5" />
          Saved to cloud
        </div>
      </div>

      <div className="h-60 w-full translate-x-10 translate-y-10 overflow-hidden rounded-md bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
        <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic from-transparent via-blue-500 via-20% to-transparent to-30% opacity-40 [animation-duration:4s]"></div>
        <div className="via-brand absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic from-transparent via-20% to-transparent to-30% opacity-40 [animation-delay:2s] [animation-duration:4s]"></div>
        <div className="relative z-20 h-full w-full rounded-[5px] bg-white dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-neutral-700">
            <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-charcoal-700 dark:border-neutral-700 dark:text-neutral-200">
              <span className="truncate">Shop schema</span>
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                className="shadow-aceternity mr-2 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] text-neutral-500 dark:bg-neutral-700 dark:text-white"
                key={activeText}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <BellIcon className="size-3" />
                <motion.span key={activeText}>{texts[activeText]}</motion.span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex h-full flex-row">
            {/* Dock strip with the side-panel tabs */}
            <div className="flex h-full w-10 shrink-0 flex-col items-center gap-2.5 border-r border-gray-200 bg-gray-50 pt-3 text-gray-400 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-500">
              <Table className="size-3.5 text-indigo-500" />
              <Link2 className="size-3.5" />
              <AlertCircle className="size-3.5" />
              <Code className="size-3.5" />
            </div>
            {/* The canvas */}
            <div className="relative h-full w-full bg-[radial-gradient(rgb(17_24_39/0.1)_1px,transparent_1.2px)] [background-size:10px_10px] dark:bg-[radial-gradient(rgb(225_227_240/0.08)_1px,transparent_1.2px)]">
              <svg viewBox="0 0 420 190" className="block w-full max-w-[420px] font-sans" aria-hidden>
                <style>{SCENE_STYLE}</style>
                <SceneLink link={WINDOW_LINK} lit delay={0.6} />
                {WINDOW_SCENE.map((t, i) => (
                  <SceneTableCard key={t.name} t={t} delay={0.1 + i * 0.15} />
                ))}
                <SceneRowHighlight t={WINDOW_SCENE[0]} row={0} delay={1} />
                <SceneRowHighlight t={WINDOW_SCENE[1]} row={1} delay={1} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card = (props: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) => {
  const { title, description, icon } = props;
  return (
    <div className="group relative">
      <div className="absolute inset-0 z-0 opacity-0 transition duration-200 group-hover:opacity-50">
        <Scale />
      </div>
      <div className="relative z-10 rounded-lg bg-gray-50 p-4 transition duration-200 group-hover:bg-transparent md:p-5 dark:bg-neutral-800">
        <div className="flex items-center gap-2">{icon}</div>
        <h3 className="mt-4 mb-2 text-lg font-medium">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
};
