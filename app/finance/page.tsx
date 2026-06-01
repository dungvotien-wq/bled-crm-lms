import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canManageInvoices } from "@/lib/permissions";
import FinanceClient from "./FinanceClient";

export const dynamic = "force-dynamic";

export interface FinanceRow {
  id: string;
  branch_id: string;
  family_id: string;
  family_name: string;
  student_name: string | null;
  code: string;
  amount: number;
  paid: number;
  due_date: string | null;
  status: string;
}

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, branch_id, family_id, student_id, code, amount, due_date, status")
    .order("created_at", { ascending: false });
  const { data: payments } = await supabase.from("payments").select("invoice_id, amount");
  const { data: families } = await supabase.from("families").select("id, parent_name");
  const { data: students } = await supabase.from("students").select("id, full_name");
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  const paidByInvoice = new Map<string, number>();
  for (const p of payments ?? []) paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount));
  const famName = new Map((families ?? []).map((f) => [f.id, f.parent_name]));
  const stuName = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  const rows: FinanceRow[] = (invoices ?? []).map((i: any) => ({
    id: i.id, branch_id: i.branch_id, family_id: i.family_id,
    family_name: famName.get(i.family_id) ?? "—",
    student_name: i.student_id ? stuName.get(i.student_id) ?? null : null,
    code: i.code, amount: Number(i.amount), paid: paidByInvoice.get(i.id) ?? 0,
    due_date: i.due_date, status: i.status,
  }));

  // Dữ liệu cho form tạo hóa đơn
  const { data: famFull } = await supabase.from("families").select("id, parent_name, phone, branch_id").order("parent_name");
  const { data: stuFull } = await supabase.from("students").select("id, family_id, full_name").order("full_name");
  const { data: plans } = await supabase
    .from("tuition_plans")
    .select("id, branch_id, program, period_type, unit_price, total_hours, unit_label, product_code")
    .eq("active", true);

  return (
    <FinanceClient
      currentUser={{ role: user.role, branch_id: user.branch_id }}
      canManage={canManageInvoices(user.role)}
      canManualPrice={user.role === "ceo" || user.role === "accountant"}
      rows={rows}
      branches={branches ?? []}
      families={famFull ?? []}
      students={stuFull ?? []}
      plans={(plans ?? []).map((p: any) => ({
        ...p, unit_price: Number(p.unit_price),
        total_hours: p.total_hours ?? null, unit_label: p.unit_label ?? "GIỜ", product_code: p.product_code ?? null,
      }))}
    />
  );
}
