import { cn } from "@/lib/utils";

export const TableBlock = ({
  icon,
  className,
  children,
}: {
  icon: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        [
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md",
          "border border-neutral-200 bg-white shadow-md dark:border-neutral-600 dark:bg-neutral-900",
          "min-h-25 min-w-25 h-auto w-auto",
        ].join(" "),
        className
      )}
    >
      {icon}
      {children}
    </div>
  );
};
