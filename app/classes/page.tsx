import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClassesClient from "./ClassesClient";
import type { ClassRow, TeacherOption } from "@/lib/classes-types";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: classes } = await supabase.from("classes").select("*").order("code");
  const { data: teachers } = await supabase.from("teachers").select("id, full_name, teacher_type").order("full_name");
  const { data: enr } = await supabase.from("enrollments").select("class_id, status");
  const { data: sess } = await supabase.from("teaching_sessions").select("class_id");
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
  const enrCount = new Map<string, number>();
  for (const e of enr ?? []) if (e.status === "active") enrCount.set(e.class_id, (enrCount.get(e.class_id) ?? 0) + 1);
  const sessCount = new Map<string, number>();
  for (const s of sess ?? []) sessCount.set(s.class_id, (sessCount.get(s.class_id) ?? 0) + 1);

  const rows: ClassRow[] = (classes ?? []).map((c: any) => ({
    id: c.id, branch_id: c.branch_id, code: c.code, name: c.name, program: c.program,
    teacher_id: c.teacher_id, teacher_name: c.teacher_id ? teacherName.get(c.teacher_id) ?? null : null,
    start_date: c.start_date, end_date: c.end_date, status: c.status,
    enrolled_count: enrCount.get(c.id) ?? 0, session_count: sessCount.get(c.id) ?? 0,
  }));

  return (
    <ClassesClient
      currentUser={{ role: user.role, branch_id: user.branch_id }}
      rows={rows}
      teachers={(teachers ?? []) as TeacherOption[]}
      branches={branches ?? []}
    />
  );
}
