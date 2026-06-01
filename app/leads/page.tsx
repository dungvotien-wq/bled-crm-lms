import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import LeadsClient from "./LeadsClient";
import type { Lead, BranchOption, UserOption } from "@/lib/leads-types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  // Leads — RLS tự lọc theo branch (CEO thấy tất cả).
  // Lấy "*" để KHÔNG bị vỡ toàn bộ khi một cột mới chưa được migrate.
  // (Tránh hiện tượng "0 lead / mất dữ liệu" khi quên chạy migration.)
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (leadsError) {
    // Không nuốt lỗi âm thầm — hiện cảnh báo để biết cần chạy migration.
    console.error("[leads] Lỗi truy vấn — có thể thiếu migration:", leadsError.message);
  }

  // Chi nhánh — cho bộ lọc của CEO (vai trò khác chỉ thấy branch mình qua RLS).
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .order("name");

  // Người phụ trách — danh sách app_users để lọc & gán.
  const { data: users } = await supabase
    .from("app_users")
    .select("id, full_name")
    .order("full_name");

  return (
    <LeadsClient
      currentUser={{
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
      }}
      leads={(leads ?? []) as Lead[]}
      branches={(branches ?? []) as BranchOption[]}
      users={(users ?? []) as UserOption[]}
    />
  );
}
