"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Sparkles, Zap } from "lucide-react";
import { WindowIcon } from "@/components/uiJsxAssets/window-icon";
import { CodeIcon } from "@/components/uiJsxAssets/code-icon";
import { PhoneIcon } from "@/components/uiJsxAssets/phone-icon";
import { DivideX } from "@/components/marketing-general/divideX";
import { LogoSVG } from "@/components/uiJsxAssets/logo";
import { useTypewriter } from "@/hooks/use-typewriter";
import { TableBlock } from "@/components/marketing-general/table-block";

// "LLM Model Selector" card — a single model, one job: describe your app, get a starter schema.
export const AISchemaGeneratorSkeleton = () => {
  const PROMPT = "An e-commerce store with users, orders, and products";
  const [started, setStarted] = useState(false);
  const { displayText, isComplete } = useTypewriter(started ? PROMPT : "", 35);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isComplete) return;
    const timer = setTimeout(() => setShowResult(true), 400);
    return () => clearTimeout(timer);
  }, [isComplete]);

  return (
    <motion.div className="relative mx-auto mt-8 h-full max-h-70 min-h-52 w-[85%] rounded-2xl border-t border-gray-300 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400">
        <Sparkles className="text-brand h-3.5 w-3.5" />
        Describe your app
      </div>
      <div className="text-charcoal-700 mt-2 min-h-11 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-200">
        {displayText}
        {started && !isComplete && <span className="animate-pulse">|</span>}
      </div>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <DivideX className="my-3" />
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-gray-400 uppercase dark:text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Schema generated
            </div>
            <div className="flex gap-2">
              {["users", "orders", "products"].map((label, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.15 }}
                  className="h-24 w-1/3"
                >
                  <MiniTable label={label} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// "From Code to Canvas, Instantly" card — a DBML editor with a live, synced table preview.
const DBML_LINES: { number: number; content: React.ReactNode }[] = [
  {
    number: 1,
    content: (
      <>
        <span className="text-brand font-medium">Table</span>{" "}
        <span className="text-charcoal-700 dark:text-neutral-200">
          clients
        </span>{" "}
        <span className="text-gray-400 dark:text-neutral-500">{"{"}</span>
      </>
    ),
  },
  {
    number: 2,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">id</span>{" "}
        <span className="text-blue-500">int</span>{" "}
        <span className="text-emerald-600 dark:text-emerald-400">
          [pk, increment]
        </span>
      </>
    ),
  },
  {
    number: 3,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">name</span>{" "}
        <span className="text-blue-500">varchar(255)</span>
      </>
    ),
  },
  {
    number: 4,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">
          email
        </span>{" "}
        <span className="text-blue-500">varchar(255)</span>
      </>
    ),
  },
  {
    number: 5,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">
          is_active
        </span>{" "}
        <span className="text-blue-500">bool</span>
      </>
    ),
  },
  {
    number: 6,
    content: (
      <>
        {"  "}
        <span className="text-charcoal-700 dark:text-neutral-200">
          created_at
        </span>{" "}
        <span className="text-blue-500">datetime</span>
      </>
    ),
  },
  {
    number: 7,
    content: <span className="text-gray-400 dark:text-neutral-500">{"}"}</span>,
  },
];

export const TextToWorkflowBuilderSkeleton = () => {
  const previewDelay = 0.15 + DBML_LINES.length * 0.16 + 0.2;

  return (
    <motion.div className="relative mx-auto mt-6 h-full max-h-70 min-h-56 w-[92%] overflow-hidden rounded-2xl border-t border-gray-300 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-2 dark:border-neutral-700">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 font-mono text-[10px] text-gray-400 dark:text-neutral-500">
          schema.dbml
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-neutral-700">
        <div className="p-3 font-mono text-[11px] leading-relaxed">
          {DBML_LINES.map((line, index) => (
            <motion.div
              key={line.number}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.15 + index * 0.16 }}
              className="flex gap-2"
            >
              <span className="w-3 shrink-0 text-right text-gray-300 select-none dark:text-neutral-600">
                {line.number}
              </span>
              <span className="whitespace-pre">{line.content}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col p-3">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: previewDelay }}
            className="mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-gray-400 uppercase dark:text-neutral-500"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live preview
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: previewDelay + 0.15 }}
            className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-medium text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  <th className="px-1 py-1 text-left">Column</th>
                  <th className="px-1 py-1 text-left">Type</th>
                  <th className="px-1 py-1 text-left">Key</th>
                </tr>
              </thead>
              <tbody className="text-[10px] text-neutral-800 dark:text-neutral-100">
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <td className="px-1 py-1 font-mono">id</td>
                  <td className="px-1 py-1 font-mono">int</td>
                  <td className="px-1 py-1 text-[9px] tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                    PK
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <td className="px-1 py-1 font-mono">name</td>
                  <td className="px-1 py-1 font-mono">varchar</td>
                  <td className="px-1 py-1 text-[9px] text-neutral-400">—</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <td className="px-1 py-1 font-mono">email</td>
                  <td className="px-1 py-1 font-mono">varchar</td>
                  <td className="px-1 py-1 text-[9px] text-neutral-400">—</td>
                </tr>
                <tr>
                  <td className="px-1 py-1 font-mono">is_active</td>
                  <td className="px-1 py-1 font-mono">bool</td>
                  <td className="px-1 py-1 text-[9px] text-neutral-400">—</td>
                </tr>
              </tbody>
            </table>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: previewDelay + 0.5 }}
            className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 dark:text-neutral-500"
          >
            <Zap className="h-3 w-3 text-emerald-500" />
            Synced instantly
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export const NativeToolsIntegrationSkeleton = () => {
  return (
    <>
      {/* Mobile / small screens illustration stays untouched */}
      <div className="relative mx-auto my-24 h-full w-full scale-[2] sm:scale-[1.5] md:scale-[1.2] lg:hidden">
        <Image
          src="/images/nativeVisualSchemaBuilder.png"
          alt="Native Visual Schema Builder"
          width={1200}
          height={1200}
          className="dark:invert dark:filter"
        />
      </div>

      {/* Desktop layout stays untouched, only inner icons swapped */}
      <motion.div className="relative mx-auto my-12 hidden h-full max-h-70 min-h-80 max-w-[67rem] grid-cols-2 p-4 lg:grid">
        <div className="hidden items-center justify-between md:flex">
          <div className="flex flex-col gap-10">
            <TextIconBlock icon={<WindowIcon />} text="Drag & Drop Tables">
              <TopSVG className="absolute top-2 -right-84" />
            </TextIconBlock>
            <TextIconBlock icon={<CodeIcon />} text="Define Columns">
              <MiddleSVG className="absolute top-2 -right-84" />
            </TextIconBlock>
            <TextIconBlock icon={<PhoneIcon />} text="Map Relationships">
              <BottomSVG className="absolute -right-84 bottom-2" />
            </TextIconBlock>
          </div>

          {/* Center "connection" node stays untouched */}
          <div className="relative h-16 w-16 overflow-hidden rounded-md bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
            <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-blue-500)_20%,transparent_30%)] [animation-duration:2s]"></div>
            <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full [background-image:conic-gradient(at_center,transparent,var(--color-brand)_20%,transparent_30%)] [animation-delay:1s] [animation-duration:2s]"></div>
            <div className="relative z-20 flex h-full w-full items-center justify-center rounded-[5px] bg-white dark:bg-neutral-900">
              <LogoSVG className="text-black dark:text-white" />
            </div>
          </div>
        </div>

        <div className="relative flex h-full w-full items-center justify-start">
          <RightSideSVG />

          {/* Connected badge stays */}
          <div className="relative flex flex-col items-center gap-2">
            <span className="relative z-20 rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs text-blue-500 dark:bg-blue-900 dark:text-white">
              Connected
            </span>

            {/* Column of "tables" instead of product logos */}
            <div className="absolute inset-x-0 -top-30 flex h-full flex-col items-center">
              <TableBlock icon={<MiniTable label="users" />} />
              <VerticalLine />
              <VerticalLine />
              <TableBlock icon={<MiniTable label="projects" />} />
            </div>
          </div>

          {/* Second column of "tables" instead of product logos */}
          <div className="absolute -top-4 right-30 flex h-full flex-col items-center">
            <TableBlock icon={<MiniTable label="tasks" />} />
            <VerticalLine />
            <TableBlock icon={<MiniTable label="comments" />} />
          </div>

          <RightSideSVG />

          {/* Final "table" instead of OpenAI logo */}
          <TableBlock icon={<MiniTable label="relations" compact />} />
        </div>
      </motion.div>
    </>
  );
};

/**
 * Tiny stylized “table” icon that fits inside existing IconBlock
 * without changing any of your layout/styling.
 */
export const MiniTable = ({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) => {
  return (
    <div
      className={[
        "relative flex h-3/4 w-3/4 flex-col overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm",
        "dark:border-neutral-700 dark:bg-neutral-900",
      ].join(" ")}
    >
      {/* header bar */}
      <div className="flex h-4 w-full items-center justify-center bg-neutral-100 dark:bg-neutral-800">
        <div className="rounded-sm bg-blue-50 px-1 text-[8px] font-medium text-blue-600 dark:bg-blue-900 dark:text-white">
          {label}
        </div>
      </div>

      {/* schema rows */}
      <div className="flex flex-1 flex-col px-1 py-0.5 text-[8px] leading-tight">
        <div className="flex items-center justify-between border-t border-neutral-200 py-0.5 dark:border-neutral-700">
          <span className="text-neutral-700 dark:text-neutral-200">id</span>
          <span className="text-neutral-400 dark:text-neutral-500">PK</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 py-0.5 dark:border-neutral-700">
          <span className="text-neutral-700 dark:text-neutral-200">
            {label === "relations" ? "from_id" : "name"}
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">text</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 py-0.5 dark:border-neutral-700">
          <span className="text-neutral-700 dark:text-neutral-200">
            {label === "relations" ? "to_id" : "created_at"}
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">ts</span>
        </div>
      </div>
    </div>
  );
};

const VerticalLine = (
  props: React.SVGProps<SVGSVGElement> & { stopColor?: string }
) => {
  return (
    <svg
      width="1"
      height="81"
      viewBox="0 0 1 81"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      {...props}
    >
      <line
        y1="-0.5"
        x2="80"
        y2="-0.5"
        transform="matrix(0 -1 -1 0 0 80.5)"
        stroke="var(--color-line)"
      />
      <line
        y1="-0.5"
        x2="80"
        y2="-0.5"
        transform="matrix(0 -1 -1 0 0 80.5)"
        stroke="url(#vertical-line-gradient)"
      />
      <defs>
        <motion.linearGradient
          id="vertical-line-gradient"
          initial={{
            x1: 0,
            x2: 2,
            y1: "0%",
            y2: "0%",
          }}
          animate={{
            x1: 0,
            x2: 2,
            y1: "80%",
            y2: "100%",
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.5" stopColor="#F17463" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

const RightSideSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="314"
      height="2"
      viewBox="0 0 314 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line
        x1="0.5"
        y1="1"
        x2="313.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
      <line
        x1="0.5"
        y1="1"
        x2="313.5"
        y2="1"
        stroke="url(#horizontal-line-gradient)"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          id="horizontal-line-gradient"
          initial={{
            y1: 0,
            y2: 1,
            x1: "-10%",
            x2: "0%",
          }}
          animate={{
            y1: 0,
            y2: 1,
            x1: "110%",
            x2: "120%",
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.5" stopColor="var(--color-blue-500)" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

const TopSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="312"
      height="33"
      viewBox="0 0 312 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line
        x1="0.5"
        y1="1"
        x2="311.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
      <line
        x1="311.5"
        y1="1"
        x2="311.5"
        y2="32"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />

      <line
        x1="0.5"
        y1="1"
        x2="311.5"
        y2="1"
        stroke="url(#line-one-gradient)"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          gradientUnits="userSpaceOnUse"
          id="line-one-gradient"
          initial={{
            x1: "-20%",
            x2: "0%",
            y1: 1,
            y2: 0,
          }}
          animate={{
            x1: "105%",
            x2: "120%",
            y1: 1,
            y2: 0,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
          }}
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.33" stopColor="#F17463" />
          <stop offset="0.66" stopColor="#F17463" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

export const MiddleSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="323"
      height="2"
      viewBox="0 0 323 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line
        x1="0.5"
        y1="1"
        x2="322.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
      <line
        x1="0.5"
        y1="1"
        x2="322.5"
        y2="1"
        stroke="url(#line-two-gradient)"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          gradientUnits="userSpaceOnUse"
          id="line-two-gradient"
          initial={{
            x1: "-20%",
            x2: "0%",
            y1: 1,
            y2: 0,
          }}
          animate={{
            x1: "105%",
            x2: "120%",
            y1: 1,
            y2: 0,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
          }}
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.33" stopColor="var(--color-blue-500)" />
          <stop offset="0.66" stopColor="var(--color-blue-500)" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

export const BottomSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="326"
      height="32"
      viewBox="0 0 326 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <line y1="31" x2="325" y2="31" stroke="var(--color-line)" />

      <line
        x1="325.5"
        y1="31"
        x2="325.5"
        y2="1"
        stroke="var(--color-line)"
        strokeLinecap="round"
      />
      <line y1="31" x2="325" y2="31" stroke="url(#line-three-gradient)" />

      <defs>
        <motion.linearGradient
          id="line-three-gradient"
          gradientUnits="userSpaceOnUse"
          initial={{
            x1: "-20%",
            x2: "0%",
            y1: 1,
            y2: 0,
          }}
          animate={{
            x1: "105%",
            x2: "120%",
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
          }}
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.33" stopColor="var(--color-yellow-500)" />
          <stop offset="0.66" stopColor="var(--color-yellow-500)" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

const TextIconBlock = ({
  icon,
  text,
  children,
}: {
  icon: React.ReactNode;
  text: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className="relative flex items-center gap-2">
      {icon}
      <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">
        {text}
      </span>
      {children}
    </div>
  );
};
