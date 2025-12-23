export const MiniTable = ({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) => {
  return (
    <div
      className={[
        "relative flex flex-col overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm w-3/4 h-3/4",
        "dark:border-neutral-700 dark:bg-neutral-900",
      ].join(" ")}
    >
      {/* header bar */}
      <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-800 flex justify-center items-center">
        <div className="rounded-sm bg-blue-50 px-1 text-[8px] font-medium text-blue-600 dark:bg-blue-900 dark:text-white">
          {label}
        </div>
      </div>

      {/* schema rows */}
      <div className="flex flex-1 flex-col px-1 py-0.5 text-[8px] leading-tight">
        <div className="flex items-center justify-between border-t border-neutral-200 py-0.5 dark:border-neutral-700">
          <span className="text-neutral-700 dark:text-neutral-200">id</span>
          <span className="text-neutral-400 dark:text-neutral-500">PK</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 py-0.5 dark:border-neutral-700">
          <span className="text-neutral-700 dark:text-neutral-200">
            {label === "relations" ? "from_id" : "name"}
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">text</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 py-0.5 dark:border-neutral-700">
          <span className="text-neutral-700 dark:text-neutral-200">
            {label === "relations" ? "to_id" : "created_at"}
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">ts</span>
        </div>
      </div>

      {/* label chip */}
    </div>
  );
};
