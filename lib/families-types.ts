import type { ContactRole } from "@/lib/leads-types";

export type FamilyTier = "vip" | "standard" | "watch";

export const TIER_LABELS: Record<FamilyTier, string> = {
  vip: "VIP",
  standard: "Tiêu chuẩn",
  watch: "Cần theo dõi",
};

export const TIER_COLORS: Record<FamilyTier, string> = {
  vip: "bg-amber-100 text-amber-800",
  standard: "bg-slate-100 text-slate-700",
  watch: "bg-red-100 text-red-700",
};

export type StudentStatus = "active" | "paused" | "left";

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Đang học",
  paused: "Tạm nghỉ",
  left: "Đã nghỉ",
};

export interface Family {
  id: string;
  branch_id: string;
  parent_name: string;
  contact_role: ContactRole | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  facebook: string | null;
  address: string | null;
  tier: FamilyTier;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  branch_id: string;
  family_id: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  level: string | null;
  status: StudentStatus;
  created_at: string;
  // join (tuỳ chọn)
  current_class?: string | null;
}

export interface FamilyListRow extends Family {
  student_count: number;
  debt: number; // công nợ còn lại (VND)
}

export interface InvoiceRow {
  id: string;
  code: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: string;
  paid: number; // đã thu cho hóa đơn này
}

export interface InteractionRow {
  id: string;
  channel: string;
  summary: string;
  occurred_at: string;
  created_by: string | null;
}

export const INTERACTION_CHANNELS: { value: string; label: string }[] = [
  { value: "call", label: "Gọi điện" },
  { value: "zalo", label: "Zalo" },
  { value: "facebook", label: "Facebook" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "Trực tiếp" },
  { value: "teams", label: "Teams" },
  { value: "note", label: "Ghi chú" },
];

// Tính tuổi từ ngày sinh (năm tròn)
export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Dùng chung từ lib/finance.ts để /finance và /families không lệch định dạng.
export { formatVnd, formatDate } from "@/lib/finance";
