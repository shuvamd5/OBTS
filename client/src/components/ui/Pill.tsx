import type { HTMLAttributes } from "react";

export type PillDot = "green" | "red" | "amber" | "slate";

const DOT: Record<PillDot, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  amber: "bg-amber-400",
  slate: "bg-slate-300",
};

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  dot?: PillDot;
}

export default function Pill({ dot, className = "", children, ...props }: PillProps) {
  return (
    <span className={`pill ${className}`.trim()} {...props}>
      {dot && <span className={`pill-dot ${DOT[dot]}`} />}
      {children}
    </span>
  );
}