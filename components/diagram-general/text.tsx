"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type TextVariant =
  | "primary"
  | "secondary"
  | "muted"
  | "brand"
  | "danger"
  | "success";

type TextSize = "xs" | "sm" | "base" | "lg" | "xl";
type TextWeight = "normal" | "medium" | "semibold" | "bold";

type TextProps = {
  children: React.ReactNode;
  className?: string;

  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;

  href?: string;
  underline?: "none" | "hover" | "always";
  noTransition?: boolean;

  as?: React.ElementType;
  onClick?: React.MouseEventHandler<HTMLElement>;
} & Omit<React.HTMLAttributes<HTMLElement>, "color" | "onClick">;

const variantClasses: Record<TextVariant, string> = {
  primary: "text-foreground",
  secondary: "text-muted-foreground hover:text-foreground",
  muted: "text-muted-foreground",
  brand: "text-primary",
  danger: "text-destructive",
  // shadcn doesn't define a success token by default; keep it conservative
  success: "text-emerald-600 dark:text-emerald-400",
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

const underlineClasses: Record<NonNullable<TextProps["underline"]>, string> = {
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

  const computed = cn(
    "inline-flex items-center",
    sizeClasses[size],
    variantClasses[variant],
    underlineClasses[underline],
    weight ? weightClasses[weight] : "",
    noTransition ? "" : "transition-colors duration-200",
    className
  );

  if (href) {
    return (
      <Link href={href} className={computed} onClick={onClick as any}>
        {children}
      </Link>
    );
  }

  return (
    <Comp className={computed} onClick={onClick} {...rest}>
      {children}
    </Comp>
  );
}

export function LinkText(props: Omit<TextProps, "href"> & { href: string }) {
  return <Text {...props} />;
}
