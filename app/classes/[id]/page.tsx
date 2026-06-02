import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import ClassDetail from "./ClassDetail";
import type { ClassSchedule, SessionRow, EnrollmentRow, TeacherOption } from "@/lib/classes-types";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: cls } = await supabase.from("classes").select("*").eq("id", params.id).maybeSingle<any>();
  if (!cls) notFound();

  const { data: teachers } = await supabase.from("teachers").select("id, full_name, teacher_type").order("full_name");
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

  const { data: schedules } = await supabase.from("class_schedules").select("*").eq("class_id", params.id).order("weekday");
  const { data: classTeachers } = await supabase.from("class_teachers").select("teacher_id, role").eq("class_id", params.id);

  const { data: sessions } = await supabase.from("teaching_sessions").select("*").eq("class_id", params.id).order("session_date").order("planned_start");
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const stMap = new Map<string, { teacher_id: string; name: string; role: string }[]>();
  if (sessionIds.length) {
    const { data: sts } = await supabase.from("session_teachers").select("session_id, teacher_id, role").in("session_id", sessionIds);
    for (const st of sts ?? []) {
      const arr = stMap.get(st.session_id) ?? [];
      arr.push({ teacher_id: st.teacher_id, name: teacherName.get(st.teacher_id) ?? "?", role: st.role });
      stMap.set(st.session_id, arr);
    }
  }
  const sessionRows: SessionRow[] = (sessions ?? []).map((s: any) => ({
    id: s.id, session_date: s.session_date, planned_start: s.planned_start, planned_end: s.planned_end,
    mode: s.mode, room: s.room, teams_meeting_url: s.teams_meeting_url, status: s.status,
    makeup_of: s.makeup_of, teachers: stMap.get(s.id) ?? [],
  }));

  const { data: enr } = await supabase.from("enrollments").select("id, student_id, status").eq("class_id", params.id);
  const studentIds = (enr ?? []).map((e) => e.student_id);
  const { data: studAll } = await supabase.from("students").select("id, full_name, status").eq("branch_id", cls.branch_id);
  const studName = new Map((studAll ?? []).map((s) => [s.id, s.full_name]));
  const enrollments: EnrollmentRow[] = (enr ?? []).map((e: any) => ({
    id: e.id, student_id: e.student_id, student_name: studName.get(e.student_id) ?? "?", status: e.status,
  }));
  const enrolledSet = new Set(studentIds);
  const availableStudents = (studAll ?? []).filter((s) => s.status === "active" && !enrolledSet.has(s.id))
    .map((s) => ({ id: s.id, full_name: s.full_name }));

  return (
    <ClassDetail
      canManage={["ceo", "branch_manager", "cm"].includes(user.role)}
      cls={{
        id: cls.id, code: cls.code, name: cls.name, program: cls.program, status: cls.status,
        teacher_id: cls.teacher_id, teacher_name: cls.teacher_id ? teacherName.get(cls.teacher_id) ?? null : null,
        start_date: cls.start_date, end_date: cls.end_date, branch_id: cls.branch_id,
        assistant_ids: (classTeachers ?? []).map((c) => c.teacher_id),
      }}
      schedules={(schedules ?? []) as ClassSchedule[]}
      sessions={sessionRows}
      enrollments={enrollments}
      teachers={(teachers ?? []) as TeacherOption[]}
      availableStudents={availableStudents}
    />
  );
}
