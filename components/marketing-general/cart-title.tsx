import { cn } from "@/lib/utils";

export const CardTitle = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h3
      className={cn(
        "text-charcoal-700 text-lg font-medium dark:text-neutral-100",
        className
      )}
    >
      {children}
    </h3>
  );
};
