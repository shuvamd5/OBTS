import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formError } from "../lib/errors";
import PasswordInput from "../components/ui/PasswordInput";
import type { UpdateProfilePayload } from "../types";

export default function ProfileEditPage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    uname: user?.uname ?? "",
    uemail: user?.uemail ?? "",
    umobile: user?.umobile ?? "",
    ugender: user?.ugender ?? "Male",
    curpass: "",
    upass: "",
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm((f) => ({ ...f, curpass: "", upass: "" }));
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    setBusy(true);
    try {
      if (form.upass && !form.curpass.trim()) {
        setError("Enter your current password to change it");
        return;
      }
      const payload: UpdateProfilePayload = {};
      if (form.uname !== user?.uname) payload.uname = form.uname;
      if (form.uemail !== user?.uemail) payload.uemail = form.uemail;
      if (form.umobile !== user?.umobile) payload.umobile = form.umobile;
      if (form.ugender !== user?.ugender) payload.ugender = form.ugender;
      if (form.upass) {
        payload.upass = form.upass;
        payload.curpass = form.curpass;
      }
      if (Object.keys(payload).length === 0) {
        setError("No changes to save");
        return;
      }
      await updateProfile(payload);
      setDone("Profile updated");
      setForm((f) => ({ ...f, curpass: "", upass: "" }));
    } catch (err) {
      setError(formError(err, "Update failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Link to="/profile" className="mb-2 inline-block text-sm text-brand-600 hover:text-brand-700">
        ← Profile
      </Link>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">Profile</h1>
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="card space-y-4 rounded-panel p-6"
      >
        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && <p className="text-sm text-green-600">{done}</p>}

        <input
          className="input w-full"
          placeholder="Full name"
          value={form.uname}
          onChange={(e) => set("uname", e.target.value)}
          required
        />
        <input
          className="input w-full"
          type="email"
          placeholder="Email"
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
        <select
          className="input w-full"
          value={form.ugender}
          onChange={(e) => set("ugender", e.target.value)}
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>

        <div className="border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Change password</p>
          <PasswordInput
            placeholder="Current password"
            value={form.curpass}
            onChange={(e) => set("curpass", e.target.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            className="mt-2"
            placeholder="New password"
            value={form.upass}
            onChange={(e) => set("upass", e.target.value)}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-slate-400">
            Leave both blank to keep your current password.
          </p>
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}