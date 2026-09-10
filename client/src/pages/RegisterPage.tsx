import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formError } from "../lib/errors";
import PasswordInput from "../components/ui/PasswordInput";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    uname: "",
    uemail: "",
    umobile: "",
    upass: "",
    ugender: "Male",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(formError(err, "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="card w-full max-w-sm space-y-4 rounded-panel p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Register</h1>
          <p className="mt-1 text-sm text-slate-500">Create your eYatra account.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="input w-full"
          placeholder="Full name"
          value={form.uname}
          onChange={(e) => set("uname", e.target.value)}
          required
        />
        <input
          className="input w-full"
          placeholder="Email"
          type="email"
          value={form.uemail}
          onChange={(e) => set("uemail", e.target.value)}
          required
        />
        <input
          className="input w-full"
          placeholder="Mobile"
          value={form.umobile}
          onChange={(e) => set("umobile", e.target.value)}
          required
        />
        <PasswordInput
          placeholder="Password"
          value={form.upass}
          onChange={(e) => set("upass", e.target.value)}
          autoComplete="new-password"
          required
        />
        <select
          className="input w-full"
          value={form.ugender}
          onChange={(e) => set("ugender", e.target.value)}
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating..." : "Register"}
        </button>
        <p className="text-center text-sm">
          Have an account? <Link className="font-medium text-brand-600 hover:text-brand-700" to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}