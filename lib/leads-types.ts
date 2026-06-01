export type LeadSource =
  | "zalo"
  | "facebook"
  | "web_form"
  | "walk_in"
  | "referral"
  | "other";

export type LeadStage =
  | "new"
  | "consulting"
  | "test"
  | "registered"
  | "paid"
  | "lost";

export type ReferrerType = "none" | "family" | "student" | "external";

export const REFERRER_TYPE_LABELS: Record<ReferrerType, string> = {
  none: "Không có",
  family: "Phụ huynh",
  student: "Học viên",
  external: "Ngoài hệ thống",
};

// Kết quả tra cứu người giới thiệu từ DB
// - family/student: bản ghi thật đã chốt -> lưu reference (có id)
// - lead: người liên hệ trên 1 lead khác -> lưu dạng external (tên + SĐT)
export interface ReferrerResult {
  kind: "family" | "student" | "lead";
  id: string;
  name: string;
  phone: string | null;
  branch_name: string | null;
}

export type ContactRole = "father" | "mother" | "guardian" | "student" | "other";

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  father: "Cha",
  mother: "Mẹ",
  guardian: "Người giám hộ",
  student: "Học viên",
  other: "Khác",
};

export interface Lead {
  id: string;
  branch_id: string;
  family_id: string | null;
  student_name: string | null;
  contact_name: string;
  contact_role: ContactRole | null;
  phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  score: number;
  programs: string[];
  program_interest: string | null; // cột cũ — giữ để tương thích, không dùng nữa
  assigned_to: string | null;
  intake_date: string | null;
  is_reenrollment: boolean;
  previous_lead_id: string | null;
  referrer_type: ReferrerType;
  referrer_family_id: string | null;
  referrer_student_id: string | null;
  referrer_name: string | null;
  referrer_phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  // Quan hệ (join)
  assignee?: { full_name: string } | null;
}

// Một ghi chú (lưu trong bảng interactions, channel='note')
export interface LeadNote {
  id: string;
  summary: string;
  occurred_at: string;
  created_by: string | null; // app_users.id — map sang tên ở client
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface UserOption {
  id: string;
  full_name: string;
}

// Nhãn tiếng Việt + thứ tự cột Kanban
export const STAGE_ORDER: LeadStage[] = [
  "new",
  "consulting",
  "test",
  "registered",
  "paid",
  "lost",
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "Mới",
  consulting: "Tư vấn",
  test: "Test",
  registered: "Đăng ký",
  paid: "Đã đóng phí",
  lost: "Mất",
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new: "bg-slate-100 text-slate-700",
  consulting: "bg-blue-100 text-blue-700",
  test: "bg-amber-100 text-amber-700",
  registered: "bg-violet-100 text-violet-700",
  paid: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  zalo: "Zalo",
  facebook: "Facebook",
  web_form: "Web form",
  walk_in: "Vãng lai",
  referral: "Giới thiệu",
  other: "Khác",
};
