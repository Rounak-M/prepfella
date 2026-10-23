"use client";

import { FileUser, LayoutDashboard, LogOut, Mic } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from "react";

import { api, getUserId, setUserId, type User } from "@/lib/api";
import { FellaDrawer } from "./fella/FellaDrawer";
import { FellaIcon, LinkedInIcon } from "./icons";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext)!;

const NAV: { href: string; label: string; icon: ComponentType<{ size?: number }>; soon?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/advice", label: "Advice", icon: FellaIcon },
  { href: "/linkedin", label: "LinkedIn review", icon: LinkedInIcon },
  { href: "/setup", label: "Mock interview", icon: Mic },
  { href: "/profile", label: "Profile & resume", icon: FileUser },
];

/** Signed-in layout: sidebar + top bar. Sends you to /login when no demo account is picked. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getUserId()) {
      router.replace("/login");
      return;
    }
    api<User>("/me").then(setUser).catch(() => router.replace("/login"));
  }, [router]);

  if (!user) return <div className="grid min-h-screen place-items-center text-[var(--muted)]">Loading…</div>;

  function switchAccount() {
    setUserId(null);
    router.push("/login");
  }

  return (
    <UserContext.Provider value={user}>
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 p-4 sm:p-6 lg:pr-24">
        <aside className="neu sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col rounded-[28px] p-5 lg:flex">
          <Link href="/dashboard" className="mb-8 px-2">
            <Logo className="h-9" onTile />
          </Link>
          <nav className="flex flex-col gap-2">
            {NAV.map(({ href, label, icon: Icon, soon }) => {
              const active = pathname.startsWith(href);
              return soon ? (
                <span key={href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-[var(--muted)] opacity-60">
                  <Icon size={18} /> {label} <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
                </span>
              ) : (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    active ? "neu-inset font-medium text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon size={18} /> {label}
                </Link>
              );
            })}
          </nav>
          {/* Account + theme sit in the sidebar on desktop, so page tiles start level with the sidebar's top. */}
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AccountChip user={user} onClick={switchAccount} className="min-w-0 flex-1" />
              <ThemeToggle />
            </div>
            <button type="button" onClick={switchAccount} className="flex items-center gap-3 rounded-2xl px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]">
              <LogOut size={18} /> Switch account
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Phones: logo + account up top (Fella's button sits top-right), navigation in a bottom tab bar */}
          <header className="flex items-center gap-3 pr-16 lg:hidden">
            <Link href="/dashboard">
              <Logo className="h-8" />
            </Link>
            <AccountChip user={user} onClick={switchAccount} compact className="ml-auto" />
          </header>
          <main className="min-w-0 pb-24 lg:pb-0">{children}</main>
        </div>
      </div>
      <nav aria-label="Main" className="neu fixed inset-x-4 bottom-4 z-30 flex items-center justify-around rounded-full p-2 lg:hidden">
        {NAV.filter((n) => !n.soon).map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined}
              className={`grid size-11 place-items-center rounded-full ${active ? "neu-inset text-[var(--fg)]" : "text-[var(--muted)]"}`}>
              <Icon size={19} />
            </Link>
          );
        })}
        <ThemeToggle />
      </nav>
      <FellaDrawer />
    </UserContext.Provider>
  );
}

function AccountChip({ user, onClick, compact, className = "" }: { user: User; onClick: () => void; compact?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} title="Switch account" className={`neu-btn flex items-center gap-3 rounded-full p-1.5 ${compact ? "" : "pr-4"} ${className}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[image:var(--primary-gradient)] text-sm font-semibold text-white">
        {user.name[0]}
      </span>
      {!compact && <span className="truncate text-sm font-medium">{user.name}</span>}
    </button>
  );
}
