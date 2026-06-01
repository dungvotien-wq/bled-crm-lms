import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import FamilyDetail from "./FamilyDetail";
import type { Family, Student, InvoiceRow, InteractionRow } from "@/lib/families-types";

export const dynamic = "force-dynamic";

export default async function FamilyDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: family } = await supabase.from("families").select("*").eq("id", params.id).maybeSingle<Family>();
  if (!family) notFound();

  const { data: studentsRaw } = await supabase
    .from("students").select("*").eq("family_id", params.id).order("created_at");

  // Lớp đang học (best-effort) từ enrollments active -> classes.name
  const studentIds = (studentsRaw ?? []).map((s) => s.id);
  const classByStudent = new Map<string, string>();
  if (studentIds.length) {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("student_id, status, classes(name)")
      .in("student_id", studentIds)
      .eq("status", "active");
    for (const e of enr ?? []) {
      const name = (e as any).classes?.name;
      if (name) classByStudent.set((e as any).student_id, name);
    }
  }
  const students: Student[] = (studentsRaw ?? []).map((s) => ({
    ...(s as Student), current_class: classByStudent.get(s.id) ?? null,
  }));

  // Hóa đơn + thanh toán
  const { data: invoices } = await supabase
    .from("invoices").select("id, code, description, amount, due_date, status")
    .eq("family_id", params.id).order("created_at", { ascending: false });
  const invIds = (invoices ?? []).map((i) => i.id);
  const paidByInvoice = new Map<string, number>();
  if (invIds.length) {
    const { data: pays } = await supabase.from("payments").select("invoice_id, amount").in("invoice_id", invIds);
    for (const p of pays ?? []) paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount));
  }
  const invoiceRows: InvoiceRow[] = (invoices ?? []).map((i) => ({
    id: i.id, code: i.code, description: i.description, amount: Number(i.amount),
    due_date: i.due_date, status: i.status, paid: paidByInvoice.get(i.id) ?? 0,
  }));
  const totalIssued = invoiceRows.filter((i) => i.status !== "void").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoiceRows.reduce((s, i) => s + i.paid, 0);

  // Tương tác
  const { data: interactions } = await supabase
    .from("interactions").select("id, channel, summary, occurred_at, created_by")
    .eq("family_id", params.id).order("occurred_at", { ascending: false });

  // Map tên người ghi
  const { data: usersData } = await supabase.from("app_users").select("id, full_name");
  const userMap = Object.fromEntries((usersData ?? []).map((u) => [u.id, u.full_name]));

  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  return (
    <FamilyDetail
      currentUser={{ role: user.role, branch_id: user.branch_id }}
      family={family}
      students={students}
      invoices={invoiceRows}
      totals={{ issued: totalIssued, paid: totalPaid, outstanding: totalIssued - totalPaid }}
      interactions={(interactions ?? []) as InteractionRow[]}
      userMap={userMap}
      branches={branches ?? []}
    />
  );
}
