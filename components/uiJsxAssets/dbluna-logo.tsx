const DbLuna = ({ className = "" }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="120"
      height="10"
      viewBox="0 0 78 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DbLuna"
      role="img"
    >
      <path
        d="M-1.70693e-05 7V-4.76837e-07H8.28998C9.12332 -4.76837e-07 9.84665 0.14 10.46 0.419999C11.08 0.699999 11.5567 1.09667 11.89 1.61C12.23 2.12333 12.4 2.73333 12.4 3.44V3.56C12.4 4.26667 12.23 4.87667 11.89 5.39C11.5567 5.90333 11.08 6.3 10.46 6.58C9.84665 6.86 9.12332 7 8.28998 7H-1.70693e-05ZM3.09998 4.74H7.98998C8.34332 4.74 8.62665 4.63667 8.83998 4.43C9.05332 4.21667 9.15998 3.92667 9.15998 3.56V3.44C9.15998 3.07333 9.05332 2.78667 8.83998 2.58C8.62665 2.36667 8.34332 2.26 7.98998 2.26H3.09998V4.74ZM13.2715 7V-4.76837e-07H23.2415C23.9615 -4.76837e-07 24.5081 0.163333 24.8815 0.49C25.2615 0.81 25.4515 1.24 25.4515 1.78C25.4515 2.20667 25.3215 2.55333 25.0615 2.82C24.8015 3.08667 24.3948 3.27 23.8415 3.37V3.57C24.4348 3.62333 24.8881 3.79333 25.2015 4.08C25.5148 4.36 25.6715 4.73667 25.6715 5.21C25.6715 5.74333 25.4815 6.17667 25.1015 6.51C24.7281 6.83667 24.2148 7 23.5615 7H13.2715ZM16.3715 2.73H21.8615C21.9881 2.73 22.0881 2.69333 22.1615 2.62C22.2348 2.54667 22.2715 2.45 22.2715 2.33C22.2715 2.20333 22.2315 2.10667 22.1515 2.04C22.0781 1.96667 21.9815 1.93 21.8615 1.93H16.3715V2.73ZM16.3715 5.07H22.0215C22.1481 5.07 22.2481 5.03333 22.3215 4.96C22.3948 4.88667 22.4315 4.79 22.4315 4.67C22.4315 4.54333 22.3915 4.44667 22.3115 4.38C22.2381 4.30667 22.1415 4.27 22.0215 4.27H16.3715V5.07ZM26.4941 7V-4.76837e-07H29.5941V4.68H38.8941V7H26.4941ZM45.2887 7.16C41.1554 7.16 39.0887 5.83 39.0887 3.17V-4.76837e-07H42.1887V3.07C42.1887 4.26333 43.2221 4.86 45.2887 4.86C47.3554 4.86 48.3887 4.26333 48.3887 3.07V-4.76837e-07H51.4887V3.17C51.4887 5.83 49.4221 7.16 45.2887 7.16ZM52.5195 7V-4.76837e-07H55.5795L61.8195 3.86V-4.76837e-07H64.9195V7H61.8595L55.6195 3.14V7H52.5195ZM65.444 7L69.814 -4.76837e-07H73.484L77.844 7H74.514L73.914 5.91H69.404L68.774 7H65.444ZM70.734 3.59L70.394 4.19H72.964L72.634 3.59L71.804 1.89H71.604L70.734 3.59Z"
        fill="currentColor"
      />
    </svg>
  );
};

export type DbLunaWeight = "light" | "regular" | "bold" | number;

const WEIGHT_PRESETS = { light: 0.9, regular: 1.3, bold: 1.8 } as const;

// Stroke thickness in viewBox units. Numbers are clamped: below 0.6 the marks
// get hairline-thin, above 1.8 the A's floating bar no longer fits its counter.
const MIN_THICKNESS = 0.6;
const MAX_THICKNESS = 1.8;

const CHAMFER = 1.35;
const r = (n: number) => Math.round(n * 1000) / 1000;

// Every letter keeps fixed outer bounds (cap height 8, advance 10, A spans
// 50–59), so changing the weight never shifts the layout — only the
// thickness and the derived N/A geometry change.
function futuristicGeometry(t: number) {
  const h = t / 2;
  const c = CHAMFER;
  const top = r(h);
  const bot = r(8 - h);

  const D = `M${r(h)} ${top}H${r(8 - h - c)}L${r(8 - h)} ${r(h + c)}V${r(8 - h - c)}L${r(8 - h - c)} ${bot}H${r(h)}Z`;

  const bl = r(10 + h);
  const br = r(18 - h);
  const B = `M${bl} ${top}H${r(br - c)}L${br} ${r(h + c)}V${r(4 - c)}L${r(br - c)} 4L${br} ${r(4 + c)}V${r(8 - h - c)}L${r(br - c)} ${bot}H${bl}Z`;
  const BBar = `M${bl} 4H${r(br - c)}`;

  const L = `M${r(20 + h)} 0V${bot}H28`;

  const ul = r(30 + h);
  const ur = r(38 - h);
  const U = `M${ul} 0V${r(8 - h - c)}L${r(ul + c)} ${bot}H${r(ur - c)}L${ur} ${r(8 - h - c)}V0`;

  // N diagonal: solve for the horizontal width w whose perpendicular
  // thickness equals t (w depends on its own slope, so iterate).
  let w = t;
  for (let i = 0; i < 4; i++) w = (t * Math.sqrt(64 + (8 - w) ** 2)) / 8;
  const NDiagonal = `40,0 ${r(40 + w)},0 48,8 ${r(48 - w)},8`;

  // A: flat apex of width f, legs with perpendicular thickness t.
  const f = t * 1.23;
  const s = (4.5 - f / 2) / 8; // leg run per unit of rise
  const wa = t * Math.sqrt(1 + s * s); // horizontal leg width
  const apexInner = 8 - (4.5 - wa) / s;
  const A = `50,8 ${r(54.5 - f / 2)},0 ${r(54.5 + f / 2)},0 59,8 ${r(59 - wa)},8 54.5,${r(apexInner)} ${r(50 + wa)},8`;

  // Floating bar: t×t square, as high as possible (y ≥ 5) while keeping a
  // 0.6 gap to the inner edges of the legs.
  const barGap = 0.6;
  const barTop = Math.max(5, 8 - (4.5 - wa - t / 2 - barGap) / s);

  return {
    D,
    B,
    BBar,
    L,
    U,
    NDiagonal,
    A,
    bar: { x: r(54.5 - t / 2), y: r(barTop), size: r(t) },
    rightStemX: r(48 - t),
  };
}

// Futuristic all-caps variant: geometric monoline letterforms on an 8-unit
// cap height, chamfered corners, and a crossbar-less "A" with a floating bar.
export const DbLunaFuturistic = ({
  className = "",
  weight = "regular",
}: {
  className?: string;
  weight?: DbLunaWeight;
}) => {
  const raw = typeof weight === "number" ? weight : WEIGHT_PRESETS[weight];
  const t = Math.min(MAX_THICKNESS, Math.max(MIN_THICKNESS, raw));
  const g = futuristicGeometry(t);

  return (
    <svg
      className={className}
      width="74"
      height="10"
      viewBox="0 0 59 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DBLUNA"
      role="img"
    >
      <g
        stroke="currentColor"
        strokeWidth={r(t)}
        strokeLinejoin="miter"
        strokeLinecap="butt"
      >
        <path d={g.D} />
        <path d={g.B} />
        <path d={g.BBar} />
        <path d={g.L} />
        <path d={g.U} />
      </g>
      <g fill="currentColor">
        {/* N */}
        <rect x="40" y="0" width={r(t)} height="8" />
        <rect x={g.rightStemX} y="0" width={r(t)} height="8" />
        <polygon points={g.NDiagonal} />
        {/* A */}
        <polygon points={g.A} />
        <rect x={g.bar.x} y={g.bar.y} width={g.bar.size} height={g.bar.size} />
      </g>
    </svg>
  );
};

export default DbLuna;
