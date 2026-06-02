"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/finance";
import { ATT_STATUS, type AttendanceStatus, type RosterData, type SessionPick } from "@/lib/attendance-types";
import { getRoster, saveAttendance, teacherCheck, lockSession, reopenSession, createSampleAttendance } from "./actions";

export default function AttendanceClient({ date, sessions }: { date: string; sessions: SessionPick[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sessionId, setSessionId] = useState("");
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [edits, setEdits] = useState<Record<string, { status: AttendanceStatus | null; note: string }>>({});

  function loadRoster(id: string) {
    setSessionId(id);
    setRoster(null);
    if (!id) return;
    startTransition(async () => {
      const r = await getRoster(id);
      if (!r.ok || !r.data) { alert(r.error); return; }
      setRoster(r.data);
      setEdits(Object.fromEntries(r.data.students.map((s) => [s.student_id, { status: s.status, note: s.note }])));
    });
  }
  const reload = () => loadRoster(sessionId);

  function setStatus(sid: string, st: AttendanceStatus) {
    setEdits((p) => ({ ...p, [sid]: { ...p[sid], status: st } }));
  }
  function setNote(sid: string, note: string) {
    setEdits((p) => ({ ...p, [sid]: { ...p[sid], note } }));
  }

  function save() {
    const entries = Object.entries(edits)
      .filter(([, v]) => v.status)
      .map(([student_id, v]) => ({ student_id, status: v.status as AttendanceStatus, note: v.note }));
    if (entries.length === 0) return alert("Chưa chọn trạng thái cho HV nào.");
    startTransition(async () => {
      const r = await saveAttendance(sessionId, entries);
      if (!r.ok) return alert(r.error);
      reload(); router.refresh();
    });
  }

  function changeDate(d: string) { router.push(`/attendance?date=${d}`); }

  const markedCount = Object.values(edits).filter((v) => v.status).length;

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-page">Điểm danh</h1>
        <div className="flex items-center gap-2">
          <Link href="/attendance/absences" className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted hover:bg-surface-2">HV vắng cần báo PH</Link>
          <button onClick={() => startTransition(async () => { const r = await createSampleAttendance(); if (!r.ok) alert(r.error); else router.refresh(); })}
            disabled={isPending} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted hover:bg-surface-2 disabled:opacity-50">Tạo dữ liệu mẫu</button>
        </div>
      </div>

      {/* Chọn ngày + buổi */}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm" />
        <select value={sessionId} onChange={(e) => loadRoster(e.target.value)} className="min-w-[240px] flex-1 rounded-md border border-line px-3 py-2 text-sm">
          <option value="">— Chọn buổi ({sessions.length} buổi) —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.class_code} · {s.planned_start}–{s.planned_end} · {s.class_name}{s.attendance_locked ? " (đã chốt)" : ""}</option>
          ))}
        </select>
      </div>

      {isPending && !roster && <p className="t-caption">Đang tải…</p>}
      {sessions.length === 0 && <div className="card p-6 text-center text-ink-subtle">Không có buổi nào trong ngày {formatDate(date)}.</div>}

      {roster && (
        <div className="space-y-4">
          {/* Header buổi */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-ink">{roster.session.class_code} · {roster.session.class_name}</div>
                <div className="t-caption">{formatDate(roster.session.session_date)} · {roster.session.planned_start}–{roster.session.planned_end} · Sĩ số {roster.students.length} · Đã đánh {markedCount}</div>
              </div>
              <div className="flex items-center gap-2">
                {roster.session.attendance_locked
                  ? <span className="rounded-full bg-danger/10 px-2 py-1 text-xs font-medium text-danger">🔒 Đã chốt {roster.session.locked_at ? "· " + formatDate(roster.session.locked_at) : ""}{roster.session.locked_by_name ? " · " + roster.session.locked_by_name : ""}</span>
                  : roster.taken_at && <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">✓ Đã điểm danh {formatDate(roster.taken_at)}{roster.taken_by_name ? " · " + roster.taken_by_name : ""}</span>}
                {roster.canLock && <button onClick={() => { if (confirm("Chốt buổi? Sau khi chốt sẽ chỉ đọc.")) startTransition(async () => { const r = await lockSession(sessionId); if (!r.ok) alert(r.error); reload(); router.refresh(); }); }} className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Chốt buổi</button>}
                {roster.canReopen && <button onClick={() => startTransition(async () => { const r = await reopenSession(sessionId); if (!r.ok) alert(r.error); reload(); router.refresh(); })} className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-2">Mở lại</button>}
              </div>
            </div>
          </div>

          {/* Check-in GV */}
          <div className="card p-4">
            <h2 className="h-section mb-2">Giáo viên</h2>
            <div className="space-y-2">
              {roster.teachers.length === 0 && <p className="t-caption">Chưa gán GV cho buổi.</p>}
              {roster.teachers.map((t) => (
                <div key={t.teacher_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                  <span>{t.name} <span className="t-caption">({t.role})</span> {t.is_self && <span className="text-primary">· bạn</span>}</span>
                  <div className="flex items-center gap-2">
                    <span className="t-caption">{t.check_in_at ? `Vào ${hhmm(t.check_in_at)}` : "Chưa vào"} · {t.check_out_at ? `Ra ${hhmm(t.check_out_at)}` : "Chưa ra"}</span>
                    {!roster.session.attendance_locked && (
                      <>
                        <button onClick={() => startTransition(async () => { const r = await teacherCheck(sessionId, t.teacher_id, "in"); if (!r.ok) alert(r.error); reload(); })} className="rounded border border-line px-2 py-1 text-xs hover:bg-surface">Check-in</button>
                        <button onClick={() => startTransition(async () => { const r = await teacherCheck(sessionId, t.teacher_id, "out"); if (!r.ok) alert(r.error); reload(); })} className="rounded border border-line px-2 py-1 text-xs hover:bg-surface">Check-out</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danh sách HV */}
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h-section">Học viên</h2>
              {roster.canEdit && <button onClick={save} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">Lưu điểm danh</button>}
            </div>
            {roster.students.length === 0 && <p className="t-caption">Lớp chưa có học viên ghi danh.</p>}
            <div className="space-y-2">
              {roster.students.map((s) => {
                const e = edits[s.student_id] ?? { status: null, note: "" };
                return (
                  <div key={s.student_id} className="rounded-lg border border-line p-3">
                    <div className="mb-2 font-medium text-ink">{s.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ATT_STATUS.map((opt) => (
                        <button key={opt.value} disabled={!roster.canEdit}
                          onClick={() => setStatus(s.student_id, opt.value)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${e.status === opt.value ? opt.color : "border-line bg-surface text-ink-muted hover:bg-surface-2"} disabled:opacity-60`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {(e.status === "excused" || e.status === "absent" || e.status === "late" || e.note) && (
                      <input value={e.note} disabled={!roster.canEdit} onChange={(ev) => setNote(s.student_id, ev.target.value)}
                        placeholder={e.status === "excused" ? "Lý do nghỉ phép (bắt buộc)" : "Ghi chú (tùy chọn)"}
                        className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-surface-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
