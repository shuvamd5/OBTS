import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Button from "./Button";
import Pill, { type PillDot } from "./Pill";

export interface StatusOption<T extends string> {
  value: T;
  label: string;
  dot?: PillDot;
}

export default function StatusChangeDialog<T extends string>({
  open,
  title,
  current,
  options,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  current: T;
  options: StatusOption<T>[];
  busy?: boolean;
  onConfirm: (next: T) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<T>(current);

  useEffect(() => {
    if (open) setSelected(current);
  }, [open, current]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={busy ? undefined : onCancel} />
      <div className="card relative z-10 w-full max-w-sm rounded-panel p-5 shadow-pop">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <div className="mt-3 space-y-2">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-btn border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <input
                type="radio"
                name="status-change"
                value={o.value}
                checked={selected === o.value}
                onChange={() => setSelected(o.value)}
                className="accent-brand-600"
              />
              <Pill className="capitalize" dot={o.dot}>
                {o.label}
              </Pill>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || selected === current}
            onClick={() => onConfirm(selected)}
          >
            {busy ? "Updating..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}