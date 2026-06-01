export type UserRole =
  | "ceo"
  | "branch_manager"
  | "cm"
  | "teacher"
  | "csr"
  | "accountant";

export interface MenuItem {
  label: string;
  href: string;
  icon?: string; // tên icon — thêm sau khi tích hợp icon lib
}

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  branch_name?: string | null;
}

// -----------------------------------------------------------------------
// Định nghĩa menu cho từng role.
// Thêm/bớt mục tại đây — không cần sửa logic khác.
// -----------------------------------------------------------------------
const MENU_ALL: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leads", href: "/leads" },
  { label: "Phụ huynh & Học viên", href: "/families" },
  { label: "Lớp học & Lịch dạy", href: "/classes" },
  { label: "Điểm danh", href: "/attendance" },
  { label: "Học phí & Công nợ", href: "/finance" },
  { label: "Bảng giá học phí", href: "/pricing" },
  { label: "Cấu hình chứng từ", href: "/settings/branch" },
  { label: "Chấm công GV", href: "/payroll" },
  { label: "TQS", href: "/tqs" },
  { label: "Báo cáo tháng", href: "/reports" },
  { label: "Cài đặt hệ thống", href: "/settings" },
];

const MENU_BY_ROLE: Record<UserRole, string[]> = {
  ceo: [
    "/dashboard",
    "/leads",
    "/families",
    "/classes",
    "/attendance",
    "/finance",
    "/pricing",
    "/settings/branch",
    "/payroll",
    "/tqs",
    "/reports",
    "/settings",
  ],
  branch_manager: [
    "/dashboard",
    "/leads",
    "/families",
    "/classes",
    "/attendance",
    "/finance",
    "/payroll",
    "/tqs",
    "/reports",
  ],
  cm: [
    "/dashboard",
    "/leads",
    "/families",
    "/classes",
    "/attendance",
    "/reports",
  ],
  teacher: [
    "/dashboard",
    "/classes",
    "/attendance",
  ],
  csr: [
    "/dashboard",
    "/leads",
    "/families",
    "/finance",
  ],
  accountant: [
    "/dashboard",
    "/finance",
    "/pricing",
    "/settings/branch",
    "/payroll",
    "/reports",
  ],
};

// -----------------------------------------------------------------------
// QUYỀN TÀI CHÍNH (siết để tránh lạm dụng) — chỉnh tại đây.
// -----------------------------------------------------------------------
// Ai được tạo hóa đơn / ghi thanh toán
export function canManageInvoices(role: UserRole): boolean {
  return role === "ceo" || role === "accountant" || role === "branch_manager";
}
// Ai được sửa bảng giá học phí
export function canEditPricing(role: UserRole): boolean {
  return role === "ceo" || role === "accountant";
}
// Ai được dùng "giá thủ công" hoặc giảm giá vượt ngưỡng
export function canManualPriceOrHighDiscount(role: UserRole): boolean {
  return role === "ceo" || role === "accountant";
}

export function getMenuForRole(role: UserRole): MenuItem[] {
  const allowed = new Set(MENU_BY_ROLE[role]);
  return MENU_ALL.filter((item) => allowed.has(item.href));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: "CEO / Giám đốc",
  branch_manager: "Quản lý Chi nhánh",
  cm: "CM (Giáo vụ)",
  teacher: "Giáo viên",
  csr: "Tư vấn viên (CSR)",
  accountant: "Kế toán",
};
