import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import PasswordInput from "../components/ui/PasswordInput";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetDone = (location.state as { resetDone?: boolean } | null)?.resetDone;
  const [logid, setLogid] = useState("");
  const [logpass, setLogpass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(logid, logpass);
      navigate("/");
    } catch {
      setError("Invalid login ID or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-sm space-y-4 rounded-panel p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Login</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back to eYatra.</p>
        </div>
        {resetDone && (
          <p className="text-sm text-green-600">Password reset successful. Log in with your new password.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="input w-full"
          placeholder="Email or mobile"
          value={logid}
          onChange={(e) => setLogid(e.target.value)}
          required
        />
        <PasswordInput
          placeholder="Password"
          value={logpass}
          onChange={(e) => setLogpass(e.target.value)}
          autoComplete="current-password"
          required
        />
        <p className="-mt-2 text-right">
          <Link className="text-sm font-medium text-brand-600 hover:text-brand-700" to="/forgot-password">
            Forgot password?
          </Link>
        </p>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Logging in..." : "Login"}
        </button>
        <p className="text-center text-sm">
          No account? <Link className="font-medium text-brand-600 hover:text-brand-700" to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}