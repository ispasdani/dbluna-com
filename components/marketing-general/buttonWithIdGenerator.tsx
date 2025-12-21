import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import React from "react";

export const ButtonWithIdGenerator = <T extends React.ElementType = "button">({
  children,
  variant = "primary",
  className,
  as,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "brand";
  className?: string;
  as?: T;
} & Omit<
  React.ComponentProps<T>,
  "children" | "variant" | "className" | "as"
>) => {
  const Component = as || "button";

  const router = useRouter();

  const handleStartBuilding = () => {
    const diagramId = crypto.randomUUID();

    router.push(`/d/${diagramId}`);
  };

  return (
    <Component
      {...props}
      className={cn(
        "block rounded-xl px-6 py-2 text-center text-sm font-medium transition duration-150 active:scale-[0.98] sm:text-base cursor-pointer",
        variant === "primary"
          ? "bg-charcoal-900 text-white dark:bg-white dark:text-black"
          : variant === "brand"
            ? "bg-brand text-white"
            : "border-divide border bg-white text-black transition duration-200 hover:bg-gray-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800",
        className
      )}
      onClick={() => handleStartBuilding()}
    >
      {children}
    </Component>
  );
};
