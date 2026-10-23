import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/AppShell";

// AppShell reads the URL (usePathname) and localStorage, so with cacheComponents it must stream in under Suspense
// instead of blocking prerendering of dynamic routes like /interview/[id].
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-[var(--muted)]">Loading…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
