import { Card } from "@/components/marketing-general/tech-card";
import { DeployCard } from "@/components/marketing-general/deploy-card";
import { DivideX } from "@/components/marketing-general/divideX";
import { Scale } from "@/components/marketing-general/scale";
import { AnthropicLogo } from "@/components/uiJsxAssets/anthropic-logo";
import { CenterSVG } from "@/components/uiJsxAssets/center-svg";
import { IntegrationsLogo } from "@/components/uiJsxAssets/integrations-logo";
import { LeftSVG } from "@/components/uiJsxAssets/left-svg";
import { LogoSVG } from "@/components/uiJsxAssets/logo";
import { OpenAILogo } from "@/components/uiJsxAssets/open-ai-icon";
import { RightSVG } from "@/components/uiJsxAssets/right-svg";
import { motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

export const ConnectYourTooklsSkeleton = () => {
  const text = `Write the first and second rule of it using Claude and ChatGPT.`;
  const [mounted, setMounted] = useState(false);

  // Generate random widths once on mount using useState instead of useMemo
  const [randomWidths] = useState(() => ({
    rightBar: Math.random() * 100,
    leftBars: Array.from({ length: 3 }, () => 20 + Math.random() * 20),
    // Add target widths for the left bars animation
    leftBarsTarget: Array.from({ length: 3 }, () => 70 + Math.random() * 30),
  }));

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative flex h-full w-full items-center justify-between">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative h-70 w-60 -translate-x-2 rounded-2xl border-t border-gray-300 bg-white p-4 shadow-2xl md:translate-x-0 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="absolute -top-4 -right-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white shadow-xl">
          <Scale />
          <OpenAILogo className="relative z-20 h-8 w-8" />
        </div>
        <div className="mt-12 flex items-center gap-2">
          <IntegrationsLogo />
          <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">
            Tasks
          </span>
        </div>
        <DivideX className="mt-2" />

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-charcoal-700 text-[10px] leading-loose font-normal md:text-xs dark:text-neutral-200">
              {text.split(/(\s+)/).map((word, index) => (
                <motion.span
                  key={index}
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.02,
                    ease: "linear",
                  }}
                  className="inline-block"
                >
                  {word === " " ? "\u00A0" : word}
                </motion.span>
              ))}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-col">
          {[...Array(2)].map((_, index) => (
            <motion.div
              key={`width-bar-right-${index}`}
              initial={{
                width: "0%",
              }}
              animate={{
                width: `${randomWidths.rightBar}%`,
              }}
              transition={{
                duration: 4,
                delay: index * 0.2,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className="mt-2 h-4 w-full rounded-full bg-gray-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute inset-x-0 z-30 hidden items-center justify-center md:flex"
      >
        <div className="size-3 rounded-full border-2 border-blue-500 bg-white dark:bg-neutral-800" />
        <div className="h-[2px] w-38 bg-blue-500" />
        <div className="size-3 rounded-full border-2 border-blue-500 bg-white dark:bg-neutral-800" />
      </motion.div>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="relative h-70 w-60 translate-x-10 rounded-2xl border-t border-gray-300 bg-white p-4 shadow-2xl md:translate-x-0 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="absolute -top-4 -left-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white shadow-xl dark:bg-neutral-800">
          <Scale />
          <LogoSVG className="relative z-20 h-8 w-8" />
        </div>
        <div className="mt-12 flex items-center gap-2">
          <IntegrationsLogo className="dark:text-neutral-200" />
          <span className="text-charcoal-700 text-xs font-medium md:text-sm dark:text-neutral-200">
            Integrations
          </span>
          <span className="text-charcoal-700 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
            200
          </span>
        </div>
        <DivideX className="mt-2" />
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <OpenAILogo className="h-4 w-4 shrink-0" />
            <span className="text-charcoal-700 text-xs font-medium md:text-sm dark:text-neutral-200">
              ChatGPT
            </span>
          </div>

          <div className="rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs text-blue-500">
            Connected
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AnthropicLogo className="h-4 w-4 shrink-0" />
            <span className="text-charcoal-700 text-xs font-medium md:text-sm dark:text-neutral-200">
              Claude 4 Opus
            </span>
          </div>

          <div className="rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs text-blue-500">
            Connected
          </div>
        </div>
        <div className="mt-2 flex flex-col">
          {randomWidths.leftBars.map((initialWidth, index) => (
            <motion.div
              key={`width-bar-left-${index}`}
              initial={{
                width: `${initialWidth}%`,
              }}
              animate={{
                width: `${randomWidths.leftBarsTarget[index]}%`, // ✅ Use pre-generated value
              }}
              transition={{
                duration: 4,
                delay: index * 0.2,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className="mt-2 h-4 w-full rounded-full bg-gray-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export const DeployAndScaleSkeleton = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  // Define deploy cards data for reusability
  const deployCards = useMemo(
    () => [
      { title: "deploy-dev-eu-324", subtitle: "2h ago", branch: "master" },
      {
        title: "deploy-prod-eu-128",
        subtitle: "10m ago",
        branch: "main",
        variant: "success" as const,
      },
      {
        title: "deploy-dev-us-445",
        subtitle: "45m ago",
        branch: "feature/auth",
      },
      {
        title: "deploy-prod-ap-223",
        subtitle: "1h ago",
        branch: "main",
        variant: "success" as const,
      },
      {
        title: "deploy-dev-eu-891",
        subtitle: "2h ago",
        branch: "fix/cache",
        variant: "warning" as const,
      },
      {
        title: "deploy-prod-us-337",
        subtitle: "3h ago",
        branch: "main",
        variant: "success" as const,
      },
      {
        title: "deploy-dev-ap-556",
        subtitle: "4h ago",
        branch: "feat/api",
        variant: "danger" as const,
      },
      {
        title: "deploy-dev-eu-672",
        subtitle: "5h ago",
        branch: "feat/search",
        variant: "default" as const,
      },
      {
        title: "deploy-prod-ap-445",
        subtitle: "6h ago",
        branch: "main",
        variant: "success" as const,
      },
      {
        title: "deploy-dev-us-891",
        subtitle: "7h ago",
        branch: "fix/perf",
        variant: "warning" as const,
      },
      {
        title: "deploy-prod-eu-223",
        subtitle: "8h ago",
        branch: "main",
        variant: "success" as const,
      },
      {
        title: "deploy-dev-ap-337",
        subtitle: "9h ago",
        branch: "feat/analytics",
        variant: "default" as const,
      },
    ],
    []
  );

  const extendedCards = useMemo(
    () => [...deployCards, ...deployCards, ...deployCards],
    [deployCards]
  );

  const cardHeight = 64;
  const gap = 4;
  const itemHeight = cardHeight + gap;
  const offset = (containerHeight - cardHeight) / 2;

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
  const totalHeight = extendedCards.length * itemHeight;

  useEffect(() => {
    let animationFrame: number;
    let lastTime = performance.now();
    const speed = 30;

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
        {extendedCards.map((card, index) => {
          const scale = useTransform(
            y,
            [
              offset + (index - 2) * -itemHeight,
              offset + (index - 1) * -itemHeight,
              offset + index * -itemHeight,
              offset + (index + 1) * -itemHeight,
              offset + (index + 2) * -itemHeight,
            ],
            [0.85, 0.95, 1.1, 0.95, 0.85]
          );

          const background = useTransform(
            y,
            [
              offset + (index - 1) * -itemHeight,
              offset + index * -itemHeight,
              offset + (index + 1) * -itemHeight,
            ],
            ["#FFFFFF", "#f17463", "#FFFFFF"]
          );

          const borderColor = useTransform(
            y,
            [
              offset + (index - 1) * -itemHeight,
              offset + index * -itemHeight,
              offset + (index + 1) * -itemHeight,
            ],
            ["#FFFFFF", "#f17463", "#FFFFFF"]
          );

          return (
            <motion.div
              key={`${index}-${card.title}`}
              className="mx-auto mt-4 w-full max-w-sm shrink-0 rounded-2xl shadow-xl"
              style={{
                scale,
                background,
                borderColor,
              }}
            >
              <DeployCard
                variant={card.variant}
                title={card.title}
                subtitle={card.subtitle}
                branch={card.branch}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export const DesignYourWorkflowSkeleton = () => {
  return (
    <div className="mt-12 flex flex-col items-center">
      <div className="relative">
        <Card
          title="Organization"
          subtitle="#default"
          cta="Id Primary"
          tone="default"
        />
        <LeftSVG className="absolute top-12 -left-32" />
        <RightSVG className="absolute top-12 -right-32" />
        <CenterSVG className="absolute top-24 right-[107px]" />
      </div>

      <div className="mt-12 flex flex-row gap-4.5">
        <Card
          title="Subscriptions"
          subtitle="#billing"
          cta="CreatedAt"
          tone="danger"
          delay={0.2}
        />
        <Card
          title="Invoices"
          subtitle="#generated"
          cta="InvoiceId"
          tone="default"
          delay={0.4}
        />
        <Card
          title="Members"
          subtitle="#members"
          cta="MemberId"
          tone="success"
          delay={0.6}
        />
      </div>
    </div>
  );
};
