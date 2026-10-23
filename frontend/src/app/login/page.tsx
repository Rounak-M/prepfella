"use client";

import { ArrowLeft, ArrowRight, Lock, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, ApiError, setUserId, type User } from "@/lib/api";

type Mode = "pick" | "signin" | "signup";

/** Every account is listed: the team's open in one click, signed-up ones (lock icon) ask for their password first. */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pick");
  const [signInAs, setSignInAs] = useState(""); // name to prefill when a password account is picked
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<User[]>("/users")
      .then(setUsers)
      .catch(() => setError("Can't reach the backend. Is it running on port 8000?"));
  }, []);

  function pick(u: User) {
    if (!u.has_password) return enter(u);
    setSignInAs(u.name);
    setMode("signin");
  }

  function switchMode(m: Mode) {
    setSignInAs("");
    setMode(m);
  }

  function enter(u: User, path = "/dashboard") {
    setUserId(u.id);
    router.push(path);
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="h-12" />
          <p className="mt-4 text-[var(--muted)]">
            {mode === "pick" ? "Choose an account to continue" : mode === "signin" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {mode === "pick" ? (
          <div className="flex flex-col gap-5">
            {error && <p className="neu-inset rounded-2xl p-4 text-sm text-[var(--danger)]">{error}</p>}
            {!users && !error &&
              [0, 1, 2].map((i) => <div key={i} className="neu h-20 animate-pulse rounded-3xl opacity-60" />)}
            {users?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => pick(u)}
                className="neu group flex items-center gap-4 rounded-3xl p-4 text-left transition hover:-translate-y-0.5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[image:var(--primary-gradient)] text-lg font-semibold text-white">
                  {u.name[0]}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{u.name}</span>
                {u.has_password && <Lock size={15} className="text-[var(--muted)]" aria-label="Asks for a password" />}
                <ArrowRight size={18} className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
              </button>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => switchMode("signin")} className="neu-btn flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium">
                <LogIn size={16} /> Sign in
              </button>
              <button type="button" onClick={() => switchMode("signup")} className="btn-primary flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium">
                <UserPlus size={16} /> Create account
              </button>
            </div>
          </div>
        ) : (
          <AccountForm key={mode} mode={mode} initialName={signInAs} onSwitch={switchMode} onDone={(u) => enter(u, mode === "signup" ? "/welcome" : "/dashboard")} />
        )}
      </div>
    </div>
  );
}

function AccountForm({ mode, initialName, onSwitch, onDone }: {
  mode: "signin" | "signup";
  initialName: string;
  onSwitch: (m: Mode) => void;
  onDone: (u: User) => void;
}) {
  const signup = mode === "signup";
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (signup && password !== confirm) {
      setError("The passwords don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await api<User>(signup ? "/signup" : "/signin", { method: "POST", body: JSON.stringify({ name, password }) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach the backend. Is it running on port 8000?");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="neu flex flex-col gap-4 rounded-[28px] p-6 sm:p-7">
      <label>
        <span className="label">Name</span>
        <input className="field" required autoFocus={!initialName} autoComplete="username" maxLength={100} value={name}
          onChange={(e) => setName(e.target.value)} placeholder={signup ? "Asha Kumar" : ""} />
      </label>
      <label>
        <span className="label">Password</span>
        <input className="field" type="password" required autoFocus={!!initialName} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 6 : undefined}
          value={password} onChange={(e) => setPassword(e.target.value)} placeholder={signup ? "At least 6 characters" : ""} />
      </label>
      {signup && (
        <label>
          <span className="label">Confirm password</span>
          <input className="field" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary mt-1 rounded-2xl px-6 py-3 text-sm font-medium">
        {busy ? (signup ? "Creating…" : "Signing in…") : signup ? "Create account" : "Sign in"}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => onSwitch("pick")} className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--fg)]">
          <ArrowLeft size={14} /> Back
        </button>
        <button type="button" onClick={() => onSwitch(signup ? "signin" : "signup")} className="text-[var(--primary)]">
          {signup ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </form>
  );
}
