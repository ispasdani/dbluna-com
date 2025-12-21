"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Text — general purpose typography component
 * - Use as plain text (default) or as a link via `href`
 * - `variant="primary"` is always black (white in dark mode)
 * - `variant="secondary"` matches your navbar link styling
 */
type TextVariant =
  | "primary"
  | "secondary"
  | "muted"
  | "danger"
  | "success"
  | "brand";

type TextSize = "xs" | "sm" | "base" | "lg" | "xl";

type TextWeight = "normal" | "medium" | "semibold" | "bold";

type TextProps = {
  children: React.ReactNode;
  className?: string;

  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;

  /** Makes it render as an anchor using Next Link */
  href?: string;

  /** Underline behavior */
  underline?: "none" | "hover" | "always";

  /** If true, do not apply transitions */
  noTransition?: boolean;

  /** Render as a custom element */
  as?: React.ElementType;

  /** Optional click handler */
  onClick?: React.MouseEventHandler<HTMLElement>;
} & Omit<React.HTMLAttributes<HTMLElement>, "color" | "onClick">;

const variantClasses: Record<TextVariant, string> = {
  // Always black in light; white in dark.
  primary: "text-black dark:text-white",
  // EXACT class requested
  secondary:
    "font-medium text-gray-600 transition duration-200 hover:text-neutral-900 dark:text-gray-300 dark:hover:text-neutral-300",
  muted: "text-gray-500 dark:text-gray-400",
  danger: "text-red-600 dark:text-red-400",
  success: "text-emerald-600 dark:text-emerald-400",
  brand: "text-brand",
};

const sizeClasses: Record<TextSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

const weightClasses: Record<TextWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const underlineClasses = {
  none: "no-underline",
  hover: "no-underline hover:underline",
  always: "underline",
};

export function Text({
  children,
  className,
  variant = "primary",
  size = "base",
  weight,
  href,
  underline = "none",
  noTransition,
  as,
  onClick,
  ...rest
}: TextProps) {
  const Comp: React.ElementType = href ? Link : (as ?? "span");

  // If variant already includes font/transition (like secondary), don’t double-apply
  const base =
    variant === "secondary"
      ? ""
      : cn(
          weight ? weightClasses[weight] : "",
          noTransition ? "" : "transition duration-200"
        );

  const computedClassName = cn(
    "inline-flex items-center",
    sizeClasses[size],
    variantClasses[variant],
    underlineClasses[underline],
    base,
    className
  );

  if (href) {
    return (
      <Link href={href} className={computedClassName} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <Comp className={computedClassName} onClick={onClick} {...rest}>
      {children}
    </Comp>
  );
}

/**
 * LinkText — convenience wrapper for links
 */
export function LinkText(props: Omit<TextProps, "href"> & { href: string }) {
  return <Text {...props} />;
}
