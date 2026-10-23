"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api, setUserId, type User } from "@/lib/api";

/** No passwords: pick one of the seeded demo accounts. */
export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<User[]>("/users")
      .then(setUsers)
      .catch(() => setError("Can't reach the backend. Is it running on port 8000?"));
  }, []);

  function pick(u: User) {
    setUserId(u.id);
    router.push("/dashboard");
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="h-12" />
          <p className="mt-4 text-[var(--muted)]">Choose a demo account to continue</p>
        </div>

        <div className="flex flex-col gap-5">
          {error && <p className="neu-inset rounded-2xl p-4 text-sm text-[var(--danger)]">{error}</p>}
          {!users && !error &&
            [0, 1, 2].map((i) => <div key={i} className="neu h-[84px] animate-pulse rounded-3xl opacity-60" />)}
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
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{u.name}</span>
                <span className="block truncate text-sm text-[var(--muted)]">{u.tagline}</span>
              </span>
              <ArrowRight size={18} className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
            </button>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-[var(--muted)]">Hackathon demo · no sign-up needed</p>
      </div>
    </div>
  );
}
