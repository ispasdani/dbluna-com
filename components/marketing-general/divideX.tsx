import { cn } from "@/lib/utils";

export const DivideX = ({ className }: { className?: string }) => {
  return <div className={cn("bg-divide h-px w-full", className)} />;
};
