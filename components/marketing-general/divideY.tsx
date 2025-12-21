import { cn } from "@/lib/utils";

export const DivideY = ({ className }: { className?: string }) => {
  return <div className={cn("bg-divide h-6 w-0.5", className)} />;
};
