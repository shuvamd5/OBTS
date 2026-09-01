import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import axios from "axios";

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
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as
          | { message?: string; details?: { field: string; message: string }[] }
          | undefined;
        setError(
          data?.details?.map((d) => `${d.field}: ${d.message}`).join(", ") ||
            data?.message ||
            "Registration failed"
        );
      } else {
        setError("Registration failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-blue-600">Register</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input className="w-full border rounded px-3 py-2" placeholder="Full name" value={form.uname}
          onChange={(e) => set("uname", e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Email" type="email" value={form.uemail}
          onChange={(e) => set("uemail", e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Mobile" value={form.umobile}
          onChange={(e) => set("umobile", e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={form.upass}
          onChange={(e) => set("upass", e.target.value)} required />
        <select className="w-full border rounded px-3 py-2" value={form.ugender}
          onChange={(e) => set("ugender", e.target.value)}>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <button className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50" disabled={busy}>
          {busy ? "Creating..." : "Register"}
        </button>
        <p className="text-sm text-center">
          Have an account? <Link className="text-blue-600 underline" to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}