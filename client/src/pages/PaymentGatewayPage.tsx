import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { paymentsApi } from "../api/payments";
import { serializeError } from "../api/client";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";

export default function PaymentGatewayPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [params] = useSearchParams();
  const amount = params.get("amount");
  const gateway = params.get("gateway") ?? "esewa";
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const verifyMutation = useMutation({
    mutationFn: () => paymentsApi.verify(transactionId!),
    onSuccess: () => setDone(true),
    onError: (err) => setError(serializeError(err)),
  });

  if (!transactionId) return <Navigate to="/" replace />;
  const busy = verifyMutation.isPending;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pay online</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mock {gateway === "khalti" ? "Khalti" : "eSewa"} gateway — no real money is involved.
      </p>

      <Card panel pad="5" className="mt-4">
        {error && <p className="mb-3 rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-600">
              ✓
            </div>
            <h2 className="text-lg font-bold text-slate-900">Payment successful</h2>
            <p className="mt-1 text-sm text-slate-500">
              {amount ? <>Rs {amount} paid</> : "Paid"}
              {gateway ? ` via ${gateway}` : ""}. Your seats are reserved.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                to="/bookings"
                className="rounded-btn border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                My bookings
              </Link>
              <Link
                to="/"
                className="rounded-btn border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Book more
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">Transaction</span>
              <span className="font-mono text-xs text-slate-600">{transactionId}</span>
            </div>
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="text-lg font-bold text-slate-900">
                {amount ? `Rs ${amount}` : "—"}
              </span>
            </div>
            <div className="mb-5 flex items-center justify-between text-sm">
              <span className="text-slate-500">Gateway</span>
              <span className="font-semibold text-slate-700 first-letter:uppercase">{gateway}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Button disabled={busy} onClick={() => verifyMutation.mutate()} className="w-full">
                {busy ? <Spinner className="h-4 w-4" /> : "Pay now"}
              </Button>
              <Link
                to="/bookings"
                className="rounded-btn border border-slate-300 px-3 py-1.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel and go back
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}