import { Card } from "@/components/marketing-general/tech-card";
import { DivideX } from "@/components/marketing-general/divideX";
import { CenterSVG } from "@/components/uiJsxAssets/center-svg";
import { CloseIcon } from "@/components/uiJsxAssets/close-icon";
import { DatabaseIcon } from "@/components/uiJsxAssets/database-icon";
import { LeftSVG } from "@/components/uiJsxAssets/left-svg";
import { RightSVG } from "@/components/uiJsxAssets/right-svg";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
      <path d="M7 11l5 5l5 -5" />
      <path d="M12 4l0 12" />
    </svg>
  );
};

const AlertTriangleIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 9v4" />
      <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
      <path d="M12 16h.01" />
    </svg>
  );
};

// Tab 1 — Design Visually or with Code: a small relational schema (users → orders → order_items / products)
export const SchemaDesignSkeleton = () => {
  return (
    <div className="mt-12 flex flex-col items-center">
      <div className="relative">
        <Card title="users" subtitle="#public" cta="id · PK" tone="default" />
        <LeftSVG className="absolute top-12 -left-32" />
        <RightSVG className="absolute top-12 -right-32" />
        <CenterSVG className="absolute top-24 right-[107px]" />
      </div>

      <div className="mt-12 flex flex-row gap-4.5">
        <Card
          title="orders"
          subtitle="#public"
          cta="user_id · FK"
          tone="danger"
          delay={0.2}
        />
        <Card
          title="order_items"
          subtitle="#public"
          cta="order_id · FK"
          tone="default"
          delay={0.4}
        />
        <Card
          title="products"
          subtitle="#public"
          cta="sku · Unique"
          tone="success"
          delay={0.6}
        />
      </div>
    </div>
  );
};

// Tab 2 — Generate Documentation Instantly: sidebar of tables + a rendered docs page for one table
export const DocsPreviewSkeleton = () => {
  const columns = [
    { name: "id", type: "integer", constraint: "PK" },
    { name: "user_id", type: "uuid", constraint: "FK → users.id" },
    { name: "status", type: "varchar", constraint: "not null" },
    { name: "created_at", type: "timestamp", constraint: "default now()" },
  ];

  const tables = ["users", "orders", "products", "order_items"];

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex h-72 w-104 flex-col overflow-hidden rounded-2xl border-t border-gray-300 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="absolute inset-x-0 -top-1.5 mx-auto size-3 rounded-full border-2 border-gray-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" />

        {/* Doc site top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-neutral-700">
          <div className="flex items-center gap-1.5 text-[11px]">
            <DatabaseIcon className="h-3.5 w-3.5 text-gray-400 dark:text-neutral-500" />
            <span className="text-gray-400 dark:text-neutral-500">Docs</span>
            <span className="text-gray-300 dark:text-neutral-600">/</span>
            <span className="text-charcoal-700 font-medium dark:text-neutral-100">
              orders
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-1 text-gray-500 dark:border-neutral-600 dark:text-neutral-400">
            <DownloadIcon className="h-3 w-3" />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-30 shrink-0 flex-col gap-0.5 border-r border-gray-200 p-3 dark:border-neutral-700">
            <span className="text-charcoal-700 mb-1.5 text-[10px] font-medium tracking-wide uppercase dark:text-neutral-400">
              Tables (4)
            </span>
            {tables.map((table, index) => (
              <motion.div
                key={table}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px]",
                  table === "orders"
                    ? "bg-brand/10 text-brand font-medium"
                    : "text-gray-500 dark:text-neutral-400"
                )}
              >
                {table === "orders" && (
                  <span className="bg-brand absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-full" />
                )}
                <DatabaseIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{table}</span>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <span className="text-charcoal-700 text-base font-semibold dark:text-neutral-100">
              orders
            </span>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
              Orders placed by customers, linked to users and products.
            </p>

            <div className="mt-3 grid grid-cols-[3.5rem_3.5rem_1fr] gap-x-2 text-[9px] font-medium tracking-wide text-gray-400 uppercase dark:text-neutral-500">
              <span>Column</span>
              <span>Type</span>
              <span>Constraint</span>
            </div>
            <DivideX className="mt-1.5" />
            <div className="flex flex-col">
              {columns.map((col, index) => (
                <motion.div
                  key={col.name}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.15 }}
                  className={cn(
                    "grid grid-cols-[3.5rem_3.5rem_1fr] items-center gap-x-2 rounded-sm px-1 py-1.5 text-[11px]",
                    index % 2 === 1 && "bg-gray-50 dark:bg-neutral-800/50"
                  )}
                >
                  <span className="text-charcoal-700 truncate font-mono dark:text-neutral-200">
                    {col.name}
                  </span>
                  <span className="truncate font-mono text-gray-500 dark:text-neutral-500">
                    {col.type}
                  </span>
                  <span className="truncate font-mono text-blue-500">
                    {col.constraint}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Tab 3 — Sandbox & Validate: an auto-scrolling feed of schema-linter issues
export const IssuesFeedSkeleton = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const issues = useMemo(
    () =>
      [
        {
          severity: "error" as const,
          message: "Duplicate table name",
          location: "customers ~ clients",
        },
        {
          severity: "warning" as const,
          message: "Missing primary key",
          location: "audit_logs",
        },
        {
          severity: "error" as const,
          message: "Reserved keyword used",
          location: "order",
        },
        {
          severity: "warning" as const,
          message: "Type mismatch on relationship",
          location: "orders.user_id → users.id",
        },
        {
          severity: "warning" as const,
          message: "Orphaned table",
          location: "temp_migrations",
        },
        {
          severity: "error" as const,
          message: "Missing primary key",
          location: "sessions",
        },
      ] as const,
    []
  );

  const extendedIssues = useMemo(
    () => [...issues, ...issues, ...issues],
    [issues]
  );

  const cardHeight = 56;
  const gap = 4;
  const itemHeight = cardHeight + gap;

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setContainerHeight(height);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const y = useMotionValue(0);
  const totalHeight = extendedIssues.length * itemHeight;

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();
    const speed = 20;

    function animateScroll(now: number) {
      const elapsed = (now - lastTime) / 1000;
      lastTime = now;
      let current = y.get();
      current -= speed * elapsed;

      if (Math.abs(current) >= totalHeight / 3) {
        current += totalHeight / 3;
      }
      y.set(current);
      animationFrame = requestAnimationFrame(animateScroll);
    }
    animationFrame = requestAnimationFrame(animateScroll);
    return () => cancelAnimationFrame(animationFrame);
  }, [y, totalHeight]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      ref={containerRef}
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
      }}
    >
      <motion.div
        className="absolute left-1/2 flex w-full -translate-x-1/2 flex-col items-center"
        style={{ y }}
      >
        {extendedIssues.map((issue, index) => (
          <div
            key={`${index}-${issue.message}-${issue.location}`}
            className="mx-auto mt-1 w-full max-w-sm shrink-0 rounded-xl border border-gray-200 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900"
          >
            <IssueCard {...issue} />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const IssueCard = ({
  severity,
  message,
  location,
}: {
  severity: "error" | "warning";
  message: string;
  location: string;
}) => {
  return (
    <div className="mx-auto flex w-full max-w-sm items-center gap-2 p-3">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          severity === "error" ? "bg-red-200" : "bg-yellow-200"
        )}
      >
        {severity === "error" ? (
          <CloseIcon
            className={cn(
              "h-3.5 w-3.5",
              severity === "error" && "text-red-500"
            )}
          />
        ) : (
          <AlertTriangleIcon className="h-3.5 w-3.5 text-yellow-600" />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-charcoal-700 truncate text-xs font-medium sm:text-sm dark:text-neutral-200">
          {message}
        </span>
        <span className="truncate font-mono text-[10px] text-gray-500 dark:text-neutral-500">
          {location}
        </span>
      </div>
      <span
        className={cn(
          "ml-auto shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px]",
          severity === "error"
            ? "border-red-400 bg-red-50 text-red-500 dark:bg-red-50/10"
            : "border-yellow-400 bg-yellow-50 text-yellow-600 dark:bg-yellow-50/10"
        )}
      >
        {severity === "error" ? "Error" : "Warning"}
      </span>
    </div>
  );
};
