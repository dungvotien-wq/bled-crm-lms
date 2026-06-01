import type { UserRole } from "@/lib/permissions";
import { getMenuForRole } from "@/lib/permissions";

export interface NavItem { label: string; href: string; icon: string }
export interface NavGroup { title: string; items: NavItem[] }

// icon = tên icon lucide-react (map trong AppShell).
const NAV_GROUPS: NavGroup[] = [
  { title: "Tổng quan", items: [{ label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" }] },
  {
    title: "CRM",
    items: [
      { label: "Lead", href: "/leads", icon: "Target" },
      { label: "Phụ huynh & Học viên", href: "/families", icon: "Users" },
      { label: "Học phí & Công nợ", href: "/finance", icon: "Wallet" },
    ],
  },
  {
    title: "LMS",
    items: [
      { label: "Lớp & Lịch học", href: "/classes", icon: "CalendarDays" },
      { label: "Điểm danh", href: "/attendance", icon: "ClipboardCheck" },
      { label: "Báo cáo tháng", href: "/reports", icon: "FileBarChart" },
    ],
  },
  {
    title: "Chấm công",
    items: [
      { label: "Bảng công giáo viên", href: "/payroll", icon: "Clock" },
      { label: "TQS", href: "/tqs", icon: "Award" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { label: "Bảng giá học phí", href: "/pricing", icon: "Tag" },
      { label: "Cấu hình chứng từ", href: "/settings/branch", icon: "Settings" },
    ],
  },
];

// Lọc theo quyền của vai trò (dựa trên getMenuForRole); ẩn nhóm rỗng.
export function navGroupsForRole(role: UserRole): NavGroup[] {
  const allowed = new Set(getMenuForRole(role).map((m) => m.href));
  return NAV_GROUPS
    .map((g) => ({ title: g.title, items: g.items.filter((i) => allowed.has(i.href)) }))
    .filter((g) => g.items.length > 0);
}
