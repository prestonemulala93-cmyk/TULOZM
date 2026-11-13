import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { House, List, Plus, Search, Shield, Tag, User } from "lucide-react";
import { getMe } from "@/lib/tulo/api";
import { bindToast } from "@/lib/tulo/toast";
import type { Me } from "@/lib/tulo/format";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function Shell() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => bindToast((message) => {
    setNote(message);
    const timer = window.setTimeout(() => setNote(""), 2800);
    return () => window.clearTimeout(timer);
  }), []);

  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
    let live = true;
    getMe()
      .then((next) => {
        if (live) setMe(next);
      })
      .catch(() => {
        if (live) setMe(null);
      });
    return () => {
      live = false;
    };
  }, [user?.id]);

  const items: Array<{ to: string; label: string; icon: typeof House }> = [
    { to: "/", label: "Home", icon: House },
    { to: "/search", label: "Find", icon: Search },
    { to: "/plans", label: "Plans", icon: Tag },
  ];
  if (me?.role === "landlord") {
    items.push({ to: "/list", label: "List", icon: Plus }, { to: "/mine", label: "Mine", icon: List });
  }
  if (me?.isAdmin) items.push({ to: "/admin", label: "Approve", icon: Shield });
  items.push({ to: user ? "/account" : "/login", label: user ? "Account" : "Log in", icon: User });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b-4 border-amber bg-deep px-4 py-3 text-foam">
        <House aria-hidden />
        <div>
          <p className="font-display text-2xl font-extrabold leading-none">Tulo</p>
          <p className="text-sm text-foam opacity-80">Rooms across Zambia</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pt-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed right-0 bottom-0 left-0 z-20 flex border-t border-line bg-surface">
        {items.map((item) => {
          const on = path === item.to || (item.to === "/search" && path.startsWith("/listing"));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 border-t-4 text-xs ${on ? "border-amber font-extrabold text-green" : "border-transparent text-muted"}`}
            >
              <Icon size={18} />
              {isPending && item.to === "/account" ? "…" : item.label}
            </Link>
          );
        })}
      </nav>
      {note ? (
        <div className="fixed bottom-20 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-center text-sm text-foam">
          {note}
        </div>
      ) : null}
    </div>
  );
}
