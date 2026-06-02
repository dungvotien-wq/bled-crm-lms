"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { canManageBranchOps, canReopenSession, canTakeAttendance } from "@/lib/permissions";
import { createSampleClass } from "@/app/classes/actions";
import type { AttendanceStatus, RosterData } from "@/lib/attendance-types";
import { revalidatePath } from "next/cache";

// TODO 3.7 payroll từ checkin — dùng teacher_checkin (check_in/out) + teaching_sessions
//   để sinh payroll_lines (giờ thực tế × đơn giá). KHÔNG nhập tay.
// TODO 3.8 TQS retention từ attendance — tỉ lệ chuyên cần/giữ chân vào điểm B.
// TODO P2 gửi báo vắng Zalo ZNS — đẩy notify_status pending → sent qua OA.
// TODO lọc buổi theo lớp ở màn chọn buổi.

export interface ActionResult { ok: boolean; error?: string; count?: number }

async function myTeacherId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

async function canAccessSession(
  supabase: ReturnType<typeof createClient>, user: CurrentUser, session: { branch_id: string; id: string }
): Promise<boolean> {
  if (user.role === "ceo") return true;
  if (user.role === "branch_manager" || user.role === "cm") return session.branch_id === user.branch_id;
  if (user.role === "teacher") {
    const tid = await myTeacherId(supabase, user.id);
    if (!tid) return false;
    const { data } = await supabase.from("session_teachers").select("id").eq("session_id", session.id).eq("teacher_id", tid).maybeSingle();
    return !!data;
  }
  return false;
}

// ---- NẠP ROSTER --------------------------------------------------------
export async function getRoster(sessionId: string): Promise<{ ok: boolean; error?: string; data?: RosterData }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  const supabase = createClient();

  const { data: s } = await supabase.from("teaching_sessions")
    .select("id, branch_id, class_id, session_date, planned_start, planned_end, status, attendance_locked, locked_at, locked_by")
    .eq("id", sessionId).maybeSingle<any>();
  if (!s) return { ok: false, error: "Không tìm thấy buổi." };
  if (!(await canAccessSession(supabase, user, s))) return { ok: false, error: "Bạn không có quyền với buổi này." };

  const { data: cls } = await supabase.from("classes").select("code, name").eq("id", s.class_id).maybeSingle<any>();

  // HV ghi danh active
  const { data: enr } = await supabase.from("enrollments").select("student_id").eq("class_id", s.class_id).eq("status", "active");
  const studentIds = (enr ?? []).map((e) => e.student_id);
  const nameMap = new Map<string, string>();
  if (studentIds.length) {
    const { data: studs } = await supabase.from("students").select("id, full_name").in("id", studentIds);
    for (const st of studs ?? []) nameMap.set(st.id, st.full_name);
  }
  const { data: att } = await supabase.from("attendance_student")
    .select("student_id, status, note, taken_by, taken_at").eq("session_id", sessionId);
  const attMap = new Map((att ?? []).map((a) => [a.student_id, a]));

  const students = studentIds.map((id) => {
    const a = attMap.get(id);
    return { student_id: id, name: nameMap.get(id) ?? "?", status: (a?.status ?? null) as AttendanceStatus | null, note: a?.note ?? "" };
  }).sort((a, b) => a.name.localeCompare(b.name, "vi"));

  // GV của buổi + check-in
  const { data: sts } = await supabase.from("session_teachers").select("teacher_id, role").eq("session_id", sessionId);
  const tIds = (sts ?? []).map((t) => t.teacher_id);
  const tNames = new Map<string, string>();
  if (tIds.length) {
    const { data: tch } = await supabase.from("teachers").select("id, full_name, user_id").in("id", tIds);
    for (const t of tch ?? []) tNames.set(t.id, t.full_name);
  }
  const { data: cis } = await supabase.from("teacher_checkin").select("teacher_id, check_in_at, check_out_at").eq("session_id", sessionId);
  const ciMap = new Map((cis ?? []).map((c) => [c.teacher_id, c]));
  const myTid = user.role === "teacher" ? await myTeacherId(supabase, user.id) : null;
  const teachers = (sts ?? []).map((t) => ({
    teacher_id: t.teacher_id, name: tNames.get(t.teacher_id) ?? "?", role: t.role,
    is_self: t.teacher_id === myTid,
    check_in_at: ciMap.get(t.teacher_id)?.check_in_at ?? null,
    check_out_at: ciMap.get(t.teacher_id)?.check_out_at ?? null,
  }));

  // Tên người điểm danh / khóa
  const ids = [s.locked_by, ...(att ?? []).map((a) => a.taken_by)].filter(Boolean) as string[];
  const uNames = new Map<string, string>();
  if (ids.length) {
    const { data: us } = await supabase.from("app_users").select("id, full_name").in("id", ids);
    for (const u of us ?? []) uNames.set(u.id, u.full_name);
  }
  const firstTaken = (att ?? []).find((a) => a.taken_at);

  const canEditBase = canTakeAttendance(user.role);
  return {
    ok: true,
    data: {
      session: {
        id: s.id, class_name: cls?.name ?? "?", class_code: cls?.code ?? "?",
        session_date: s.session_date, planned_start: s.planned_start, planned_end: s.planned_end,
        status: s.status, attendance_locked: s.attendance_locked,
        locked_at: s.locked_at, locked_by_name: s.locked_by ? uNames.get(s.locked_by) ?? null : null,
      },
      students, teachers,
      taken_at: firstTaken?.taken_at ?? null,
      taken_by_name: firstTaken?.taken_by ? uNames.get(firstTaken.taken_by) ?? null : null,
      canEdit: canEditBase && !s.attendance_locked,
      canLock: canManageBranchOps(user.role) && !s.attendance_locked,
      canReopen: canReopenSession(user.role) && s.attendance_locked,
    },
  };
}

// ---- LƯU ĐIỂM DANH -----------------------------------------------------
export async function saveAttendance(
  sessionId: string, entries: { student_id: string; status: AttendanceStatus; note: string }[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  const supabase = createClient();
  const { data: s } = await supabase.from("teaching_sessions").select("id, branch_id, attendance_locked").eq("id", sessionId).maybeSingle<any>();
  if (!s) return { ok: false, error: "Không tìm thấy buổi." };
  if (s.attendance_locked) return { ok: false, error: "Buổi đã chốt — không sửa được." };
  if (!(await canAccessSession(supabase, user, s))) return { ok: false, error: "Không có quyền." };

  for (const e of entries) {
    if (e.status === "excused" && !e.note?.trim()) return { ok: false, error: "Vắng có phép cần ghi lý do." };
  }

  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    branch_id: s.branch_id, session_id: sessionId, student_id: e.student_id,
    status: e.status, note: e.note?.trim() || null, taken_by: user.id, taken_at: now,
    parent_notify_flag: e.status === "absent",
    notify_status: e.status === "absent" ? "pending" : "none",
  }));
  const { error } = await supabase.from("attendance_student").upsert(rows, { onConflict: "session_id,student_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/attendance");
  return { ok: true, count: rows.length };
}

// ---- CHECK-IN GV -------------------------------------------------------
export async function teacherCheck(sessionId: string, teacherId: string, kind: "in" | "out"): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  const supabase = createClient();
  const { data: s } = await supabase.from("teaching_sessions").select("id, branch_id, attendance_locked").eq("id", sessionId).maybeSingle<any>();
  if (!s) return { ok: false, error: "Không tìm thấy buổi." };
  if (s.attendance_locked) return { ok: false, error: "Buổi đã chốt." };
  // GV chỉ check-in cho chính mình; CM/admin nhập hộ
  if (user.role === "teacher") {
    const myTid = await myTeacherId(supabase, user.id);
    if (myTid !== teacherId) return { ok: false, error: "GV chỉ check-in cho chính mình." };
  } else if (!canManageBranchOps(user.role)) {
    return { ok: false, error: "Không có quyền." };
  } else if (user.role !== "ceo" && s.branch_id !== user.branch_id) {
    return { ok: false, error: "Khác chi nhánh." };
  }

  const field = kind === "in" ? "check_in_at" : "check_out_at";
  const { error } = await supabase.from("teacher_checkin").upsert(
    { branch_id: s.branch_id, session_id: sessionId, teacher_id: teacherId, [field]: new Date().toISOString(), method: "app" },
    { onConflict: "session_id,teacher_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/attendance");
  return { ok: true };
}

// ---- CHỐT / MỞ LẠI -----------------------------------------------------
export async function lockSession(sessionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManageBranchOps(user.role)) return { ok: false, error: "Không có quyền chốt buổi." };
  const supabase = createClient();
  const { data: s } = await supabase.from("teaching_sessions").select("branch_id").eq("id", sessionId).maybeSingle<any>();
  if (!s) return { ok: false, error: "Không tìm thấy buổi." };
  if (user.role !== "ceo" && s.branch_id !== user.branch_id) return { ok: false, error: "Khác chi nhánh." };
  const { error } = await supabase.from("teaching_sessions")
    .update({ status: "done", attendance_locked: true, locked_at: new Date().toISOString(), locked_by: user.id }).eq("id", sessionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/attendance");
  return { ok: true };
}

export async function reopenSession(sessionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canReopenSession(user.role)) return { ok: false, error: "Chỉ CEO/QLCN được mở lại buổi." };
  const supabase = createClient();
  const { data: s } = await supabase.from("teaching_sessions").select("branch_id").eq("id", sessionId).maybeSingle<any>();
  if (!s) return { ok: false, error: "Không tìm thấy buổi." };
  if (user.role !== "ceo" && s.branch_id !== user.branch_id) return { ok: false, error: "Khác chi nhánh." };
  const { error } = await supabase.from("teaching_sessions")
    .update({ attendance_locked: false, reopened_at: new Date().toISOString(), reopened_by: user.id }).eq("id", sessionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/attendance");
  return { ok: true };
}

// ---- CỜ BÁO VẮNG -------------------------------------------------------
export async function resolveNotify(attendanceId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManageBranchOps(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { error } = await supabase.from("attendance_student").update({ notify_status: "sent" }).eq("id", attendanceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/attendance/absences");
  return { ok: true };
}

// ---- DỮ LIỆU MẪU (tự tạo lớp nếu chưa có) -----------------------------
export async function createSampleAttendance(branchIdArg?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManageBranchOps(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();

  let branchId = user.role === "ceo" ? branchIdArg : user.branch_id;
  if (!branchId) { const { data: b } = await supabase.from("branches").select("id").limit(1).maybeSingle(); branchId = b?.id; }
  if (!branchId) return { ok: false, error: "Không tìm thấy chi nhánh." };

  // Lấy enrollments active theo lớp
  const findSessions = async () => {
    const { data } = await supabase.from("teaching_sessions")
      .select("id, class_id, branch_id, session_date, planned_start, status, attendance_locked")
      .eq("branch_id", branchId).neq("status", "cancelled").order("session_date").limit(50);
    return data ?? [];
  };
  const activeByClass = async () => {
    const { data } = await supabase.from("enrollments").select("class_id, student_id").eq("branch_id", branchId).eq("status", "active");
    const m = new Map<string, string[]>();
    for (const e of data ?? []) { const a = m.get(e.class_id) ?? []; a.push(e.student_id); m.set(e.class_id, a); }
    return m;
  };

  let sessions = await findSessions();
  let enrMap = await activeByClass();
  let usable = sessions.filter((s) => (enrMap.get(s.class_id)?.length ?? 0) > 0);
  if (usable.length === 0) {
    // Tự tạo lớp mẫu (kèm lịch, sinh buổi, ghi danh)
    const r = await createSampleClass(branchId);
    if (!r.ok) return { ok: false, error: "Không tạo được lớp mẫu: " + r.error };
    sessions = await findSessions();
    enrMap = await activeByClass();
    usable = sessions.filter((s) => (enrMap.get(s.class_id)?.length ?? 0) > 0);
  }
  if (usable.length === 0) return { ok: false, error: "Vẫn chưa có buổi/HV để điểm danh mẫu." };

  // Buổi A: điểm danh đủ 4 trạng thái
  const A = usable[0];
  const studs = enrMap.get(A.class_id)!;
  const cycle: AttendanceStatus[] = ["present", "late", "excused", "absent"];
  const now = new Date().toISOString();
  const rows = studs.map((sid, i) => {
    const st = cycle[i % 4];
    return {
      branch_id: branchId, session_id: A.id, student_id: sid, status: st,
      note: st === "excused" ? "Xin nghỉ phép (mẫu)" : null,
      taken_by: user.id, taken_at: now,
      parent_notify_flag: st === "absent", notify_status: st === "absent" ? "pending" : "none",
    };
  });
  // đảm bảo có ít nhất 1 absent nếu chỉ có <4 HV
  if (!rows.some((r) => r.status === "absent") && rows.length) {
    rows[rows.length - 1] = { ...rows[rows.length - 1], status: "absent", note: null, parent_notify_flag: true, notify_status: "pending" };
  }
  await supabase.from("attendance_student").upsert(rows, { onConflict: "session_id,student_id" });

  // 2 GV check-in cho buổi A
  const { data: sts } = await supabase.from("session_teachers").select("teacher_id").eq("session_id", A.id).limit(2);
  for (const t of sts ?? []) {
    await supabase.from("teacher_checkin").upsert(
      { branch_id: branchId, session_id: A.id, teacher_id: t.teacher_id, check_in_at: now, check_out_at: now, method: "app" },
      { onConflict: "session_id,teacher_id" }
    );
  }

  // Buổi B: chốt/khóa (chỉ-đọc) — chọn buổi khác A nếu có
  const B = usable.find((s) => s.id !== A.id);
  if (B) {
    const bStuds = enrMap.get(B.class_id)!;
    if (bStuds[0]) {
      await supabase.from("attendance_student").upsert(
        [{ branch_id: branchId, session_id: B.id, student_id: bStuds[0], status: "present", taken_by: user.id, taken_at: now, parent_notify_flag: false, notify_status: "none" }],
        { onConflict: "session_id,student_id" });
    }
    await supabase.from("teaching_sessions").update({ status: "done", attendance_locked: true, locked_at: now, locked_by: user.id }).eq("id", B.id);
  }

  revalidatePath("/attendance");
  return { ok: true };
}
