import type { SelectHTMLAttributes } from "react";

export default function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`input ${className}`.trim()} {...props} />;
}