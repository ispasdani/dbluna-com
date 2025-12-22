import { motion } from "motion/react";

export const CenterSVG = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <motion.svg
      width="2"
      height="56"
      viewBox="0 0 2 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        duration: 1,
      }}
      className={props.className}
    >
      <line x1="1" y1="56" x2="1" stroke="var(--color-line)" strokeWidth="2" />
      <line
        x1="1"
        y1="56"
        x2="1"
        stroke="url(#gradient-three)"
        strokeWidth="1"
      />
      <defs>
        <motion.linearGradient
          id="gradient-three"
          initial={{
            x1: "0%",
            x2: "0%",
            y1: "-100%",
            y2: "-90%",
          }}
          animate={{
            x1: "0%",
            x2: "0%",
            y1: "90%",
            y2: "100%",
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-line)" stopOpacity="1" offset="0" />
          <stop stopColor="#F17463" stopOpacity="0.5" offset="0.5" />
          <stop stopColor="#F17463" stopOpacity="0" offset="1" />
        </motion.linearGradient>
      </defs>
    </motion.svg>
  );
};
