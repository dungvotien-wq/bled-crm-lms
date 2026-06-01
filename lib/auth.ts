import { createClient, createAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  branch_name: string | null;
}

/**
 * Lấy thông tin người đang đăng nhập từ session + bảng app_users.
 * Tra cứu bằng admin client (service_role) để không phụ thuộc RLS — đây là
 * bước xác thực danh tính, giống pattern dùng ở callback và /me (Bước 3.1).
 * Trả về null nếu chưa đăng nhập hoặc email không có trong app_users.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("app_users")
    .select("id, email, full_name, role, branch_id, is_active, branches(name)")
    .ilike("email", session.user.email)
    .maybeSingle<{
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
      branch_id: string | null;
      is_active: boolean;
      branches: { name: string } | null;
    }>();

  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    branch_id: data.branch_id,
    branch_name: data.branches?.name ?? null,
  };
}
