import Link from "next/link";
import { DbLunaFuturistic } from "./dbluna-logo";

export const LogoSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="icon icon-tabler icons-tabler-filled icon-tabler-chart-bubble"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M6 12a4 4 0 1 1 -3.995 4.2l-.005 -.2l.005 -.2a4 4 0 0 1 3.995 -3.8z" />
      <path d="M16 16a3 3 0 1 1 -2.995 3.176l-.005 -.176l.005 -.176a3 3 0 0 1 2.995 -2.824z" />
      <path d="M14.5 2a5.5 5.5 0 1 1 -5.496 5.721l-.004 -.221l.004 -.221a5.5 5.5 0 0 1 5.496 -5.279z" />
    </svg>
  );
};

// Same wordmark as the diagram editor's top navbar.
export const Logo = ({ className = "" }: { className?: string }) => {
  return (
    <Link
      href="/"
      aria-label="DBLUNA home"
      className={`flex items-center ${className}`}
    >
      <DbLunaFuturistic
        weight="bold"
        className="h-[18px] w-[132px] shrink-0 text-neutral-900 dark:text-white"
      />
    </Link>
  );
};
