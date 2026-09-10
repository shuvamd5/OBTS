import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";

export default function ForgotPasswordPage() {
  const [uemail, setUemail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await forgotPassword(uemail);
      setSent(true);
    } catch {
      setError("Something went wrong. Check the email and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 rounded-panel p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forgot Password</h1>
          <p className="mt-1 text-sm text-slate-500">We'll email you a link to reset your password.</p>
        </div>
        {sent ? (
          <p className="text-sm text-green-600">
            If the email exists, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              className="input w-full"
              type="email"
              placeholder="Email"
              value={uemail}
              onChange={(e) => setUemail(e.target.value)}
              required
            />
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Sending..." : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-center text-sm">
          <Link className="font-medium text-brand-600 hover:text-brand-700" to="/login">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}