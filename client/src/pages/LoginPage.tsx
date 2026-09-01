import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-blue-600">Login</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Email or mobile"
          value={logid}
          onChange={(e) => setLogid(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Password"
          value={logpass}
          onChange={(e) => setLogpass(e.target.value)}
          required
        />
        <button className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50" disabled={busy}>
          {busy ? "Logging in..." : "Login"}
        </button>
        <p className="text-sm text-center">
          No account? <Link className="text-blue-600 underline" to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}