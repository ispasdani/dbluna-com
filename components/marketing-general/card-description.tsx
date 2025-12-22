import { cn } from "@/lib/utils";

export const CardDescription = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <p
      className={cn(
        "mt-2 text-base text-gray-600 dark:text-gray-300",
        className
      )}
    >
      {children}
    </p>
  );
};
