import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AttendanceClient from "./AttendanceClient";
import type { SessionPick } from "@/lib/attendance-types";

export const dynamic = "force-dynamic";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const date = searchParams.date || todayStr();
  const supabase = createClient();

  const { data: sess } = await supabase.from("teaching_sessions")
    .select("id, class_id, planned_start, planned_end, status, attendance_locked")
    .eq("session_date", date).neq("status", "cancelled").order("planned_start");

  let sessions = sess ?? [];

  // GV: chỉ buổi mình được gán
  if (user.role === "teacher") {
    const { data: t } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    const tid = t?.id;
    if (!tid) sessions = [];
    else {
      const ids = sessions.map((s) => s.id);
      const { data: sts } = ids.length
        ? await supabase.from("session_teachers").select("session_id").eq("teacher_id", tid).in("session_id", ids)
        : { data: [] };
      const allowed = new Set((sts ?? []).map((x) => x.session_id));
      sessions = sessions.filter((s) => allowed.has(s.id));
    }
  }

  const classIds = [...new Set(sessions.map((s) => s.class_id))];
  const clsMap = new Map<string, { code: string; name: string }>();
  if (classIds.length) {
    const { data: cs } = await supabase.from("classes").select("id, code, name").in("id", classIds);
    for (const c of cs ?? []) clsMap.set(c.id, { code: c.code, name: c.name });
  }

  const picks: SessionPick[] = sessions.map((s) => ({
    id: s.id, class_code: clsMap.get(s.class_id)?.code ?? "?", class_name: clsMap.get(s.class_id)?.name ?? "?",
    planned_start: s.planned_start, planned_end: s.planned_end, status: s.status, attendance_locked: s.attendance_locked,
  }));

  return <AttendanceClient date={date} sessions={picks} />;
}
