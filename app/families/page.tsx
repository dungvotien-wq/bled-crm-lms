import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import FamiliesClient from "./FamiliesClient";
import type { Family, FamilyListRow } from "@/lib/families-types";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  const { data: families } = await supabase.from("families").select("*").order("parent_name");
  const { data: students } = await supabase.from("students").select("id, family_id");
  const { data: invoices } = await supabase.from("invoices").select("id, family_id, amount, status");
  const { data: payments } = await supabase.from("payments").select("invoice_id, amount");
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  // Map số con
  const childCount = new Map<string, number>();
  for (const s of students ?? []) {
    childCount.set(s.family_id, (childCount.get(s.family_id) ?? 0) + 1);
  }

  // Map invoice -> family + tổng đã xuất theo family (bỏ 'void')
  const invToFamily = new Map<string, string>();
  const issuedByFamily = new Map<string, number>();
  for (const inv of invoices ?? []) {
    invToFamily.set(inv.id, inv.family_id);
    if (inv.status !== "void") {
      issuedByFamily.set(inv.family_id, (issuedByFamily.get(inv.family_id) ?? 0) + Number(inv.amount));
    }
  }
  // Tổng đã thu theo family
  const paidByFamily = new Map<string, number>();
  for (const p of payments ?? []) {
    const fam = invToFamily.get(p.invoice_id);
    if (fam) paidByFamily.set(fam, (paidByFamily.get(fam) ?? 0) + Number(p.amount));
  }

  const rows: FamilyListRow[] = (families ?? []).map((f: Family) => ({
    ...f,
    student_count: childCount.get(f.id) ?? 0,
    debt: (issuedByFamily.get(f.id) ?? 0) - (paidByFamily.get(f.id) ?? 0),
  }));

  return (
    <FamiliesClient
      currentUser={{ role: user.role, branch_id: user.branch_id, branch_name: user.branch_name }}
      rows={rows}
      branches={branches ?? []}
    />
  );
}
