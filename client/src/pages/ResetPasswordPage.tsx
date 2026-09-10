import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { formError } from "../lib/errors";
import PasswordInput from "../components/ui/PasswordInput";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [upass, setUpass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (upass !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token ?? "", upass);
      navigate("/login", { state: { resetDone: true } });
    } catch (err: unknown) {
      setError(formError(err, "Reset link is invalid or has expired. Please request a new one."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 rounded-panel p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <PasswordInput
          placeholder="New password"
          value={upass}
          onChange={(e) => setUpass(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordInput
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Resetting..." : "Reset password"}
        </button>
        <p className="text-center text-sm">
          <Link className="font-medium text-brand-600 hover:text-brand-700" to="/login">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}