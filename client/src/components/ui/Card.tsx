import type { ElementType, HTMLAttributes } from "react";

const PAD = {
  none: "",
  "4": "p-4",
  "5": "p-5",
  "6": "p-6",
} as const;

export type CardPad = keyof typeof PAD;

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  pad?: CardPad;
  panel?: boolean;
}

export default function Card({
  as: Tag = "div",
  pad = "4",
  panel = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const cls = `${panel ? "card rounded-panel" : "card"} ${PAD[pad]} ${className}`.trim();
  return (
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  );
}