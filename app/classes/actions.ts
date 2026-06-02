"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export interface ActionResult { ok: boolean; error?: string; id?: string; count?: number }

function canManage(role: UserRole) {
  return role === "ceo" || role === "branch_manager" || role === "cm";
}

// TODO 3.6: điểm danh học viên (mobile+desktop, GV & CM) — mỗi teaching_session
// lấy enrollments active của lớp để render danh sách điểm danh; ghi attendance_student.

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- LỚP ---------------------------------------------------------------
export interface ClassInput {
  id?: string;
  code: string; name: string; program: string;
  teacher_id?: string | null;
  assistant_ids?: string[];
  start_date?: string | null; end_date?: string | null;
  status?: string;
  branch_id?: string; // CEO chọn
}

export async function saveClass(input: ClassInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!canManage(user.role)) return { ok: false, error: "Bạn không có quyền quản lý lớp." };
  if (!input.code?.trim()) return { ok: false, error: "Thiếu mã lớp." };
  if (!input.name?.trim()) return { ok: false, error: "Thiếu tên lớp." };

  const branchId = user.role === "ceo" ? input.branch_id : user.branch_id;
  if (!branchId) return { ok: false, error: "Chưa chọn chi nhánh." };

  const supabase = createClient();
  const row = {
    branch_id: branchId, code: input.code.trim(), name: input.name.trim(),
    program: input.program || null, teacher_id: input.teacher_id || null,
    start_date: input.start_date || null, end_date: input.end_date || null,
    status: input.status || "active",
  };

  let classId = input.id;
  if (input.id) {
    const { error } = await supabase.from("classes").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase.from("classes").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Lỗi tạo lớp." };
    classId = data.id;
  }

  // GV phụ cấp lớp (đồng bộ)
  if (classId) {
    await supabase.from("class_teachers").delete().eq("class_id", classId).neq("role", "main");
    const assistants = (input.assistant_ids ?? []).filter((t) => t && t !== input.teacher_id);
    if (assistants.length) {
      await supabase.from("class_teachers").insert(
        assistants.map((tid) => ({ branch_id: branchId, class_id: classId, teacher_id: tid, role: "assistant" }))
      );
    }
  }

  revalidatePath("/classes");
  return { ok: true, id: classId };
}

// ---- LỊCH LẶP ----------------------------------------------------------
export interface ScheduleInput {
  id?: string; class_id: string; weekday: number;
  planned_start: string; planned_end: string;
  mode: string; room?: string;
  effective_from?: string | null; effective_to?: string | null;
}

export async function saveSchedule(input: ScheduleInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { data: cls } = await supabase.from("classes").select("branch_id").eq("id", input.class_id).maybeSingle();
  if (!cls) return { ok: false, error: "Không tìm thấy lớp." };

  const row = {
    branch_id: cls.branch_id, class_id: input.class_id, weekday: input.weekday,
    planned_start: input.planned_start, planned_end: input.planned_end,
    mode: input.mode, room: input.room || null,
    effective_from: input.effective_from || null, effective_to: input.effective_to || null, active: true,
  };
  const { error } = input.id
    ? await supabase.from("class_schedules").update(row).eq("id", input.id)
    : await supabase.from("class_schedules").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/classes/${input.class_id}`);
  return { ok: true };
}

export async function deleteSchedule(id: string, classId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { error } = await supabase.from("class_schedules").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

// ---- SINH BUỔI HỌC -----------------------------------------------------
export async function generateSessions(classId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();

  const { data: cls } = await supabase
    .from("classes").select("branch_id, teacher_id, start_date, end_date").eq("id", classId).maybeSingle();
  if (!cls) return { ok: false, error: "Không tìm thấy lớp." };
  if (!cls.start_date || !cls.end_date) return { ok: false, error: "Lớp cần có ngày bắt đầu & kết thúc." };

  const { data: schedules } = await supabase.from("class_schedules").select("*").eq("class_id", classId).eq("active", true);
  if (!schedules || schedules.length === 0) return { ok: false, error: "Chưa có mẫu lịch lặp." };

  const { data: hols } = await supabase.from("holidays").select("day").or(`branch_id.eq.${cls.branch_id},branch_id.is.null`);
  const holiday = new Set((hols ?? []).map((h) => h.day));

  const { data: existing } = await supabase.from("teaching_sessions").select("session_date, planned_start").eq("class_id", classId);
  const existKey = new Set((existing ?? []).map((s) => `${s.session_date}|${s.planned_start}`));

  // GV mặc định: GV chính + GV phụ cấp lớp
  const { data: cts } = await supabase.from("class_teachers").select("teacher_id, role").eq("class_id", classId);
  const defaultTeachers: { teacher_id: string; role: string }[] = [];
  if (cls.teacher_id) defaultTeachers.push({ teacher_id: cls.teacher_id, role: "main" });
  for (const ct of cts ?? []) if (ct.teacher_id !== cls.teacher_id) defaultTeachers.push({ teacher_id: ct.teacher_id, role: ct.role });

  const start = new Date(cls.start_date + "T00:00:00");
  const end = new Date(cls.end_date + "T00:00:00");
  const newRows: any[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = fmtDate(d);
    if (holiday.has(ds)) continue;
    const wd = d.getDay();
    for (const sc of schedules) {
      if (sc.weekday !== wd) continue;
      if (sc.effective_from && ds < sc.effective_from) continue;
      if (sc.effective_to && ds > sc.effective_to) continue;
      const key = `${ds}|${sc.planned_start}`;
      if (existKey.has(key)) continue;
      existKey.add(key);
      newRows.push({
        branch_id: cls.branch_id, class_id: classId, teacher_id: cls.teacher_id,
        session_date: ds, planned_start: sc.planned_start, planned_end: sc.planned_end,
        mode: sc.mode, room: sc.room, status: "scheduled",
      });
    }
  }

  if (newRows.length === 0) { revalidatePath(`/classes/${classId}`); return { ok: true, count: 0 }; }

  const { data: inserted, error } = await supabase.from("teaching_sessions").insert(newRows).select("id");
  if (error) return { ok: false, error: error.message };

  // Gán GV mặc định cho các buổi vừa tạo
  if (defaultTeachers.length && inserted) {
    const stRows = inserted.flatMap((s) =>
      defaultTeachers.map((t) => ({ branch_id: cls.branch_id, session_id: s.id, teacher_id: t.teacher_id, role: t.role }))
    );
    if (stRows.length) await supabase.from("session_teachers").insert(stRows);
  }

  revalidatePath(`/classes/${classId}`);
  return { ok: true, count: newRows.length };
}

// ---- BUỔI LẺ / DỜI / HỦY / HỌC BÙ -------------------------------------
export async function addAdHocSession(input: {
  class_id: string; session_date: string; planned_start: string; planned_end: string;
  mode: string; room?: string; teams_meeting_url?: string; makeup_of?: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { data: cls } = await supabase.from("classes").select("branch_id, teacher_id").eq("id", input.class_id).maybeSingle();
  if (!cls) return { ok: false, error: "Không tìm thấy lớp." };

  const { data: s, error } = await supabase.from("teaching_sessions").insert({
    branch_id: cls.branch_id, class_id: input.class_id, teacher_id: cls.teacher_id,
    session_date: input.session_date, planned_start: input.planned_start, planned_end: input.planned_end,
    mode: input.mode, room: input.room || null, teams_meeting_url: input.teams_meeting_url || null,
    status: "scheduled", makeup_of: input.makeup_of || null,
  }).select("id").single();
  if (error || !s) return { ok: false, error: error?.message ?? "Lỗi." };

  // Kế thừa GV chính cho buổi lẻ
  if (cls.teacher_id) {
    await supabase.from("session_teachers").insert({ branch_id: cls.branch_id, session_id: s.id, teacher_id: cls.teacher_id, role: "main" });
  }
  revalidatePath(`/classes/${input.class_id}`);
  return { ok: true, id: s.id };
}

export async function updateSession(input: {
  id: string; class_id: string; session_date?: string; planned_start?: string; planned_end?: string;
  room?: string; teams_meeting_url?: string; status?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const patch: any = {};
  for (const k of ["session_date", "planned_start", "planned_end", "room", "teams_meeting_url", "status"] as const) {
    if (input[k] !== undefined) patch[k] = input[k] || null;
  }
  const { error } = await supabase.from("teaching_sessions").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/classes/${input.class_id}`);
  return { ok: true };
}

export async function cancelSession(id: string, classId: string): Promise<ActionResult> {
  return updateSession({ id, class_id: classId, status: "cancelled" });
}

// ---- GÁN GV CHO BUỔI ---------------------------------------------------
export async function setSessionTeachers(
  sessionId: string, classId: string, teachers: { teacher_id: string; role: string }[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { data: s } = await supabase.from("teaching_sessions").select("branch_id").eq("id", sessionId).maybeSingle();
  if (!s) return { ok: false, error: "Không tìm thấy buổi." };
  await supabase.from("session_teachers").delete().eq("session_id", sessionId);
  if (teachers.length) {
    const { error } = await supabase.from("session_teachers").insert(
      teachers.map((t) => ({ branch_id: s.branch_id, session_id: sessionId, teacher_id: t.teacher_id, role: t.role }))
    );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

// ---- GHI DANH ----------------------------------------------------------
export async function enrollStudent(classId: string, studentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { data: cls } = await supabase.from("classes").select("branch_id").eq("id", classId).maybeSingle();
  if (!cls) return { ok: false, error: "Không tìm thấy lớp." };
  const { error } = await supabase.from("enrollments").insert({
    branch_id: cls.branch_id, class_id: classId, student_id: studentId, status: "active",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Học viên đã có trong lớp." };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function updateEnrollment(id: string, classId: string, status: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

// ---- DỮ LIỆU MẪU -------------------------------------------------------
export async function createSampleClass(branchIdArg?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();

  let branchId = user.role === "ceo" ? branchIdArg : user.branch_id;
  if (!branchId) {
    const { data: b } = await supabase.from("branches").select("id").limit(1).maybeSingle();
    branchId = b?.id;
  }
  if (!branchId) return { ok: false, error: "Không tìm thấy chi nhánh." };

  // Đảm bảo có 2 GV (VN + GVNN)
  let { data: teachers } = await supabase.from("teachers").select("id, teacher_type").eq("branch_id", branchId);
  if (!teachers || teachers.length < 2) {
    await supabase.from("teachers").insert([
      { branch_id: branchId, full_name: "[MẪU] Cô Lan (VN)", teacher_type: "vn", hourly_rate: 200000 },
      { branch_id: branchId, full_name: "[MẪU] Mr. John (GVNN)", teacher_type: "gvnn", hourly_rate: 500000 },
    ]);
    ({ data: teachers } = await supabase.from("teachers").select("id, teacher_type").eq("branch_id", branchId));
  }
  const vn = teachers?.find((t) => t.teacher_type === "vn") ?? teachers?.[0];
  const gvnn = teachers?.find((t) => t.teacher_type === "gvnn") ?? teachers?.[1] ?? teachers?.[0];

  // 1 ngày nghỉ mẫu (trong ~2 tuần tới)
  const today = new Date();
  const hol = new Date(today); hol.setDate(hol.getDate() + 7);
  const holStr = fmtDate(hol);
  const { data: existHol } = await supabase.from("holidays").select("id").eq("day", holStr).or(`branch_id.eq.${branchId},branch_id.is.null`).maybeSingle();
  if (!existHol) await supabase.from("holidays").insert({ branch_id: branchId, day: holStr, name: "[MẪU] Nghỉ lễ" });

  // Lớp mẫu
  const end = new Date(today); end.setDate(end.getDate() + 56);
  const code = "MAU-IELTS-" + Math.floor(100 + Math.random() * 900);
  const { data: cls, error: clsErr } = await supabase.from("classes").insert({
    branch_id: branchId, code, name: "[MẪU] IELTS Buổi tối", program: "IELTS",
    teacher_id: vn?.id ?? null, start_date: fmtDate(today), end_date: fmtDate(end), status: "active",
  }).select("id").single();
  if (clsErr || !cls) return { ok: false, error: `Lỗi tạo lớp mẫu: ${clsErr?.message}` };

  // GV phụ = GVNN
  if (gvnn && gvnn.id !== vn?.id) {
    await supabase.from("class_teachers").insert({ branch_id: branchId, class_id: cls.id, teacher_id: gvnn.id, role: "gvnn" });
  }

  // Lịch lặp T2-T4-T6, 18:00-20:00
  await supabase.from("class_schedules").insert([2, 4, 6].map((wd) => ({
    branch_id: branchId, class_id: cls.id, weekday: wd,
    planned_start: "18:00", planned_end: "20:00", mode: "offline", room: "P1", active: true,
  })));

  // Sinh buổi (tự bỏ ngày nghỉ)
  await generateSessions(cls.id);

  // Ghi danh vài học viên có sẵn
  const { data: studs } = await supabase.from("students").select("id").eq("branch_id", branchId).eq("status", "active").limit(3);
  if (studs && studs.length) {
    await supabase.from("enrollments").insert(
      studs.map((s) => ({ branch_id: branchId, class_id: cls.id, student_id: s.id, status: "active" }))
    );
  }

  revalidatePath("/classes");
  return { ok: true, id: cls.id };
}
