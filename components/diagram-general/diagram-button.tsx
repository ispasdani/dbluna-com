"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * DiagramButton — design-system button for the diagram editor.
 *
 * Variants:
 *   ghost     — no background, dim label, subtle hover fill (toolbar actions)
 *   outlined  — 1px border, full-contrast label (secondary CTAs like Export)
 *   primary   — charcoal/dark fill, white label (primary CTA like Share)
 *   brand     — coral fill, white label (upgrade / brand moments)
 *   dashed    — dashed border, dim label (empty-state add actions)
 *   secondary — muted fill, standard label (toggles and less-prominent actions)
 *
 * Sizes: sm | md (default) | lg | icon
 *
 * Icon-only buttons are a *size*, not a variant: pair `size="icon"` (square,
 * no padding, transparent border) with whichever variant supplies the colour.
 */
const diagramButtonVariants = cva(
  [
    "flex items-center justify-center gap-1.5",
    "rounded-[7px] border font-medium leading-normal",
    "transition-[background-color,color,border-color] duration-75",
    "cursor-pointer whitespace-nowrap select-none",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    // Trim label boxes to cap-height → baseline so items-center lines the
    // letters up with the icon's centre, not the font's uneven em box.
    // The padding/negative-margin pair gives descenders (g, y, p) room inside
    // `truncate`'s overflow clip without changing what gets centred.
    "[&>:not(svg)]:[text-box:trim-both_cap_alphabetic]",
    "[&>:not(svg):not(:empty)]:pb-[0.3em] [&>:not(svg):not(:empty)]:-mb-[0.3em]",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Transparent — hover reveals a subtle fill */
        ghost: [
          "border-transparent bg-transparent",
          "text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
        ].join(" "),

        /** Thin border, full-contrast label */
        outlined: [
          "border-border bg-transparent",
          "text-foreground",
          "hover:bg-muted",
        ].join(" "),

        /** Charcoal fill — highest-priority action (e.g. Share) */
        primary: [
          "border-charcoal-900 bg-charcoal-900 text-white",
          "hover:bg-charcoal-700 hover:border-charcoal-700",
        ].join(" "),

        /** Brand-coral fill — upgrade / brand moments */
        brand: ["border-brand bg-brand text-white", "hover:opacity-90"].join(
          " ",
        ),

        /** Dashed border — empty-state or additive actions */
        dashed: [
          "border-dashed border-border bg-transparent",
          "text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
        ].join(" "),

        /** Muted fill — toggles and lower-priority actions */
        secondary: [
          "border-border bg-secondary text-secondary-foreground",
          "hover:bg-secondary/70",
        ].join(" "),

        /** Pre-active ghost — same hover state applied permanently */
        "ghost-active": ["border-transparent bg-muted text-foreground"].join(
          " ",
        ),
      },

      size: {
        sm: "h-7 gap-1 px-2.5 text-[11.5px]",
        md: "h-[30px] px-[10px] text-[12.5px]",
        lg: "h-9 px-4 text-[13px] rounded-[8px]",
        icon: "h-[30px] w-[30px] p-0 border-transparent",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

export interface DiagramButtonProps
  extends
    React.ComponentProps<"button">,
    VariantProps<typeof diagramButtonVariants> {
  asChild?: boolean;
}

/**
 * Bare text children become anonymous flex items, which the label selectors
 * above can't reach — so they'd miss the cap-height trim and sit high. Wrap
 * them in a span so every label is centred the same way.
 */
function wrapTextChildren(children: React.ReactNode) {
  return React.Children.map(children, (child) =>
    typeof child === "string" || typeof child === "number" ? (
      <span>{child}</span>
    ) : (
      child
    ),
  );
}

const DiagramButton = React.forwardRef<HTMLButtonElement, DiagramButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(diagramButtonVariants({ variant, size }), className)}
        {...props}
      >
        {asChild ? children : wrapTextChildren(children)}
      </Comp>
    );
  },
);
DiagramButton.displayName = "DiagramButton";

export { DiagramButton, diagramButtonVariants };
