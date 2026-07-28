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
  Building2,
  LogOut,
  ChevronDown,
  User,
  Key,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/lib/authStore";
import { useState } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/services", label: "Services", icon: Wrench },
  { to: "/services/free", label: "Free Services", icon: Sparkles },
  { to: "/plans", label: "Plans & Offers", icon: Tags },
  { to: "/payments", label: "Payment", icon: CreditCard },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/overview", label: "Admin Overview", icon: LayoutGrid, adminOnly: true },
  { to: "/admin", label: "Admin Panel", icon: ShieldCheck, adminOnly: true },
  { to: "/admin/company", label: "Company Settings", icon: Building2, adminOnly: true },
];

export function AppShell() {
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const isAdmin = user?.role === "admin" || user?.role === "developer";
  const photoUrl = user?.photo_url ? `/api/v1/users/photo/${user.id}` : null;

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
              end={item.to === "/admin"}
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

        <div className="border-t border-white/10 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-200 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar - just identity + plan badge; primary nav lives in
            the sidebar so this stays uncluttered. */}
        <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-brand-100 bg-white px-6">
          <div className="relative">
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
