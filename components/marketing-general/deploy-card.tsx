import { cn } from "@/lib/utils";
import { ForkIcon } from "../uiJsxAssets/fork-icon";

export const DeployCard = ({
  variant = "default",
  title,
  subtitle,
  branch,
}: {
  variant?: "default" | "danger" | "success" | "warning";
  title: string;
  subtitle: string;
  branch: string;
}) => {
  return (
    <div className="mx-auto flex w-full max-w-sm items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            variant === "default" && "bg-gray-200",
            variant === "danger" && "bg-red-200",
            variant === "success" && "bg-green-200",
            variant === "warning" && "bg-yellow-200"
          )}
        >
          <ForkIcon
            className={cn(
              "h-4 w-4",
              variant === "default" && "text-gray-500",
              variant === "danger" && "text-red-500",
              variant === "success" && "text-green-500",
              variant === "warning" && "text-yellow-500"
            )}
          />
        </div>
        <span className="text-charcoal-700 text-xs font-medium sm:text-sm">
          {title}
        </span>
      </div>
      <div className="ml-2 flex flex-row items-center gap-2">
        <span className="text-charcoal-700 text-xs font-normal">
          {subtitle}
        </span>
        <div className="size-1 rounded-full bg-gray-400"></div>
        <span className="text-charcoal-700 text-xs font-normal">{branch}</span>
      </div>
    </div>
  );
};
