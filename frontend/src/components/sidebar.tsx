"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Search,
  GitBranch,
  History,
  Bookmark,
  Settings,
  Sparkles,
  LogOut,
  Users,
  UserPlus,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ProfileSelector } from "./profile-selector";
import { NotificationBell } from "./notification-bell";

const nav = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/repo", label: "Explore Repo", icon: GitBranch },
  { href: "/history", label: "History", icon: History },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logout, role } = useStore();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass-strong flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/discover" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-colors">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight gold-gradient">
              Issue Finder
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              PR Writer HFI
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Admin Nav */}
      {role === "admin" && (
        <div className="px-4 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium px-3 pt-3 pb-1">
            Admin
          </p>
          {[
            { href: "/admin/users", label: "Users", icon: Users },
            { href: "/admin/access-requests", label: "Access Requests", icon: UserPlus },
            { href: "/admin/analytics", label: "Platform Analytics", icon: BarChart3 },
            { href: "/admin/config", label: "Configuration", icon: SlidersHorizontal },
          ].map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Profile & Language */}
      <div className="border-t border-border py-3">
        <ProfileSelector />
      </div>

      {/* User */}
      <div className="p-4 border-t border-border">
        {email ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold border border-primary/20">
              {email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{email}</p>
            </div>
            <NotificationBell />
            <button onClick={() => { logout(); router.push("/auth/login"); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
