import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "md" | "sm" | "xs" | "icon";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
};

const SIZE: Record<ButtonSize, string> = {
  md: "",
  sm: "px-3 py-1.5 text-xs",
  xs: "px-2.5 py-1 text-xs",
  icon: "p-1.5 text-xs",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANT[variant]} ${SIZE[size]} ${className}`.trim()}
      {...props}
    />
  );
}