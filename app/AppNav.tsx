import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getMenuForRole, ROLE_LABELS } from "@/lib/permissions";
import LogoutButton from "@/app/me/LogoutButton";

// Thanh điều hướng trên cùng — chỉ hiện khi đã đăng nhập.
export default async function AppNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  const menu = getMenuForRole(user.role);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        {/* Trang chủ */}
        <Link href="/me" className="flex shrink-0 items-center gap-2 font-bold text-slate-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-sm text-white">B</span>
          <span className="hidden sm:inline">BLED CRM</span>
        </Link>

        {/* Menu theo vai trò */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Người dùng */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium text-slate-800">{user.full_name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
