import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  Sparkles,
  Tags,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  LayoutGrid,
  LogOut,
  ChevronDown,
  User,
  Key,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Bell,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/lib/authStore";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/services", label: "Paid Services", icon: Wrench },
  { to: "/services/free", label: "Free Services", icon: Sparkles },
  { to: "/plans", label: "Plans & Offers", icon: Tags },
  { to: "/payments", label: "Payment", icon: CreditCard },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/overview", label: "Admin Overview", icon: LayoutGrid, adminOnly: true },
  { to: "/admin", label: "Admin Panel", icon: ShieldCheck, adminOnly: true },
];

interface PublicCompany {
  name: string;
  logo_url: string | null;
  social_links: Record<string, string>;
}

export function AppShell() {
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin" || user?.role === "developer";
  const photoUrl = user?.photo_url ? `/api/v1/users/photo/${user.id}` : null;

  const { data: company } = useQuery<PublicCompany>({
    queryKey: ["public-company"],
    queryFn: () => api.get("/company").then((r) => r.data),
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api.get("/notifications/unread-count").then((r) => r.data),
    refetchInterval: 30_000,
  });

  // The dropdown wasn't auto-closing on an outside click - only on
  // choosing one of its own items. A document-level listener that
  // ignores clicks inside the menu (or its toggle button) fixes that.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  return (
    <div className="flex h-screen w-full bg-surface-subtle">
      {/* Sidebar - fixed left, full height. Decision: a persistent
          sidebar (not a top mega-menu like the old project) scales
          better once more services/admin sections get added, and
          keeps the current section visually obvious at all times. */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-brand-100 bg-brand-950 text-white">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 font-display font-bold text-white">
            L
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Lexora</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin" || item.to === "/services"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-brand-200 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          {Object.keys(company?.social_links ?? {}).length > 0 && (
            <div className="mb-3 flex gap-3">
              {(["facebook", "instagram", "linkedin", "youtube"] as const)
                .filter((k) => company?.social_links?.[k])
                .map((k) => {
                  const SocialIcon = { facebook: Facebook, instagram: Instagram, linkedin: Linkedin, youtube: Youtube }[k];
                  return (
                    <a
                      key={k}
                      href={company!.social_links[k]}
                      target="_blank"
                      rel="noreferrer"
                      title={k[0].toUpperCase() + k.slice(1)}
                      className="text-brand-300 opacity-80 transition-opacity hover:opacity-100"
                    >
                      <SocialIcon size={16} />
                    </a>
                  );
                })}
            </div>
          )}
          <p className="text-xs text-brand-400">
            &copy; {new Date().getFullYear()} {company?.name ?? "Lexora AI Solutions"}. All rights reserved.
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar - just identity + plan badge; primary nav lives in
            the sidebar so this stays uncluttered. */}
        <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-brand-100 bg-white px-6">
          <Link to="/notifications" className="relative rounded-lg p-2 text-brand-400 hover:bg-brand-50 hover:text-brand-700">
            <Bell size={20} />
            {(unreadCount?.count ?? 0) > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                {unreadCount!.count > 9 ? "9+" : unreadCount!.count}
              </span>
            )}
          </Link>
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-brand-50 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <>
                    {user?.first_name?.[0]}
                    {user?.last_name?.[0]}
                  </>
                )}
              </div>
              <span className="text-sm font-semibold text-brand-900">
                {user?.first_name} {user?.last_name}
              </span>
              <ChevronDown size={16} className="text-brand-400" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-brand-100 bg-white py-1.5 shadow-popover">
                <div className="px-3.5 py-2 text-xs text-brand-400">{user?.email}</div>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm text-brand-700 hover:bg-brand-50"
                >
                  <User size={15} /> Profile
                </Link>
                <Link
                  to="/api-documentation"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm text-brand-700 hover:bg-brand-50"
                >
                  <Key size={15} /> API Documentation
                </Link>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-danger-600 hover:bg-danger-500/5"
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
