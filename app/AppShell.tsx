"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Target, Users, Wallet, CalendarDays, ClipboardCheck,
  FileBarChart, Clock, Award, Tag, Settings, Menu, X, ChevronLeft, ChevronRight, Search,
  type LucideIcon,
} from "lucide-react";
import { navGroupsForRole } from "@/lib/nav";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import LogoutButton from "@/app/me/LogoutButton";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Target, Users, Wallet, CalendarDays, ClipboardCheck,
  FileBarChart, Clock, Award, Tag, Settings,
};

interface Props {
  user: { full_name: string; role: UserRole; branch_name: string | null };
  children: React.ReactNode;
}

export default function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = navGroupsForRole(user.role);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const SidebarInner = ({ showLabels }: { showLabels: boolean }) => (
    <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
      {groups.map((g) => (
        <div key={g.title}>
          {showLabels
            ? <p className="t-label px-2 pb-1">{g.title}</p>
            : <div className="mx-2 mb-1 border-t border-line" />}
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon] ?? Target;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setMobileOpen(false)}
                  title={it.label}
                  className={`flex items-center gap-2.5 border-l-2 px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary-soft font-semibold text-primary"
                      : "border-transparent text-ink-muted hover:bg-surface-2"
                  } ${showLabels ? "" : "justify-center"}`}
                >
                  <Icon size={17} className="shrink-0" />
                  {showLabels && <span className="truncate">{it.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col">
      {/* GLOBAL HEADER (navy) */}
      <header className="flex h-[50px] shrink-0 items-center gap-3 bg-header px-3 text-white">
        <button onClick={() => setMobileOpen(true)} className="rounded p-1 hover:bg-white/10 lg:hidden">
          <Menu size={20} />
        </button>
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-white/15 text-sm font-bold">B</span>
          <span className="hidden text-sm font-semibold sm:inline">BLED CRM + LMS</span>
        </Link>

        {/* Search */}
        <div className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 md:flex">
          <Search size={15} className="text-white/60" />
          <input
            placeholder="Tìm kiếm…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
          />
        </div>

        {/* User block */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium">{user.full_name}</div>
            <div className="text-[11px] text-white/70">
              {ROLE_LABELS[user.role]} · {user.branch_name ?? "Toàn hệ thống"}
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <LogoutButton variant="light" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* SIDEBAR desktop */}
        <aside className={`hidden shrink-0 flex-col border-r border-line bg-surface lg:flex ${collapsed ? "w-14" : "w-60"}`}>
          <SidebarInner showLabels={!collapsed} />
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center justify-center gap-1 border-t border-line py-2 text-xs text-ink-subtle hover:bg-surface-2"
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Thu gọn</>}
          </button>
        </aside>

        {/* DRAWER mobile */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-surface shadow-xl">
              <div className="flex h-[50px] items-center justify-between border-b border-line px-3">
                <span className="text-sm font-bold text-ink">BLED CRM</span>
                <button onClick={() => setMobileOpen(false)} className="text-ink-subtle"><X size={18} /></button>
              </div>
              <SidebarInner showLabels />
            </aside>
          </div>
        )}

        {/* CONTENT */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-appbg">{children}</main>
      </div>
    </div>
  );
}
