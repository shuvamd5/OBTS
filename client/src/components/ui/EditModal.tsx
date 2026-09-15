import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Button from "./Button";

export default function EditModal({
  open,
  title,
  busy = false,
  confirmNote,
  error = "",
  children,
  onSave,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  busy?: boolean;
  confirmNote?: string;
  error?: string;
  children: ReactNode;
  onSave: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) setConfirming(false);
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    if (confirming) {
      onSave();
    } else {
      setConfirming(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={busy ? undefined : onClose} />
      <div className="card relative z-10 max-h-[85vh] w-full max-w-md overflow-hidden rounded-panel shadow-pop">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-btn p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(85vh-8rem)] overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 rounded-card bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {children}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          {confirming ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {confirmNote ?? "Save these changes?"}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                  Back
                </Button>
                <Button size="sm" onClick={handleSave} disabled={busy}>
                  {busy ? "Saving..." : "Yes, save"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={busy}>
                Save changes
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}