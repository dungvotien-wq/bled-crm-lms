import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canManageBranchOps } from "@/lib/permissions";
import AbsencesClient from "./AbsencesClient";

export const dynamic = "force-dynamic";

export interface AbsenceRow {
  id: string; student_name: string; class_name: string; session_date: string; note: string | null;
}

export default async function AbsencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageBranchOps(user.role)) redirect("/attendance");

  const supabase = createClient();
  const { data: att } = await supabase.from("attendance_student")
    .select("id, student_id, session_id, note").eq("notify_status", "pending");

  const rows: AbsenceRow[] = [];
  if (att && att.length) {
    const studentIds = [...new Set(att.map((a) => a.student_id))];
    const sessionIds = [...new Set(att.map((a) => a.session_id))];
    const { data: studs } = await supabase.from("students").select("id, full_name").in("id", studentIds);
    const sName = new Map((studs ?? []).map((s) => [s.id, s.full_name]));
    const { data: sess } = await supabase.from("teaching_sessions").select("id, class_id, session_date").in("id", sessionIds);
    const sInfo = new Map((sess ?? []).map((s) => [s.id, s]));
    const classIds = [...new Set((sess ?? []).map((s) => s.class_id))];
    const { data: cls } = classIds.length ? await supabase.from("classes").select("id, name").in("id", classIds) : { data: [] };
    const cName = new Map((cls ?? []).map((c) => [c.id, c.name]));
    for (const a of att) {
      const si = sInfo.get(a.session_id);
      rows.push({
        id: a.id, student_name: sName.get(a.student_id) ?? "?",
        class_name: si ? cName.get(si.class_id) ?? "?" : "?",
        session_date: si?.session_date ?? "", note: a.note,
      });
    }
    rows.sort((a, b) => b.session_date.localeCompare(a.session_date));
  }

  return <AbsencesClient rows={rows} />;
}
