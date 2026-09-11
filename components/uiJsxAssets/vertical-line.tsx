export const VerticalLine = () => (
  <div
    className="relative shrink-0 overflow-hidden"
    style={{ width: 1, height: 81 }}
    aria-hidden
  >
    <div
      className="absolute inset-0"
      style={{ background: "var(--color-line)" }}
    />
    <div
      className="line-sweep-v absolute top-0 left-0 w-full"
      style={{
        height: "40%",
        background:
          "linear-gradient(to bottom, transparent, var(--color-brand), transparent)",
      }}
    />
  </div>
);
