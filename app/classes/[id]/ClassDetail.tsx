"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/finance";
import {
  WEEKDAYS, weekdayLabel, MODE_LABELS, SESSION_STATUS_LABELS, SESSION_STATUS_COLORS,
  type ClassSchedule, type SessionRow, type EnrollmentRow, type TeacherOption,
} from "@/lib/classes-types";
import ClassForm from "../ClassForm";
import {
  saveSchedule, deleteSchedule, generateSessions, addAdHocSession, updateSession,
  cancelSession, setSessionTeachers, enrollStudent, updateEnrollment,
} from "../actions";

interface ClassData {
  id: string; code: string; name: string; program: string | null; status: string;
  teacher_id: string | null; teacher_name: string | null;
  start_date: string | null; end_date: string | null; branch_id: string; assistant_ids: string[];
}
interface Props {
  canManage: boolean;
  cls: ClassData;
  schedules: ClassSchedule[];
  sessions: SessionRow[];
  enrollments: EnrollmentRow[];
  teachers: TeacherOption[];
  availableStudents: { id: string; full_name: string }[];
}

export default function ClassDetail(p: Props) {
  const { cls, canManage } = p;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editClass, setEditClass] = useState(false);
  const [teacherModal, setTeacherModal] = useState<SessionRow | null>(null);
  const [moveModal, setMoveModal] = useState<SessionRow | null>(null);
  const [adHoc, setAdHoc] = useState(false);
  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; count?: number }>, okMsg?: string) =>
    startTransition(async () => { const r = await fn(); if (!r.ok) alert(r.error); else if (okMsg) alert(okMsg.replace("{n}", String(r.count ?? ""))); refresh(); });

  const activeCount = p.enrollments.filter((e) => e.status === "active").length;

  return (
    <div className="p-5">
      <Link href="/classes" className="text-sm text-primary hover:underline">← Danh sách lớp</Link>

      {/* Header */}
      <div className="card mt-2 flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="h-page">{cls.code} · {cls.name}</h1>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">{cls.status}</span>
          </div>
          <p className="t-caption mt-1">
            {cls.program ?? "—"} · GV chính: {cls.teacher_name ?? "—"} · {formatDate(cls.start_date)} → {formatDate(cls.end_date)} · Sĩ số: {activeCount}
          </p>
        </div>
        {canManage && <button onClick={() => setEditClass(true)} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2">Sửa lớp</button>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Lịch lặp */}
        <div className="card p-4 lg:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h-section">Lịch lặp tuần</h2>
            {canManage && <button onClick={() => run(() => generateSessions(cls.id), "Đã sinh {n} buổi.")} disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50">Sinh buổi học</button>}
          </div>
          <ul className="space-y-1.5">
            {p.schedules.length === 0 && <li className="t-caption">Chưa có lịch lặp.</li>}
            {p.schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                <span>{weekdayLabel(s.weekday)} · {s.planned_start}–{s.planned_end} · {MODE_LABELS[s.mode]}{s.room ? ` · ${s.room}` : ""}</span>
                {canManage && <button onClick={() => run(() => deleteSchedule(s.id, cls.id))} className="text-xs text-danger hover:underline">Xóa</button>}
              </li>
            ))}
          </ul>
          {canManage && <ScheduleAdd classId={cls.id} onDone={refresh} />}
        </div>

        {/* Buổi học */}
        <div className="card p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h-section">Buổi học ({p.sessions.length})</h2>
            {canManage && <button onClick={() => setAdHoc(true)} className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-2">+ Buổi lẻ / học bù</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-subtle">
                <tr><th className="py-1 pr-2">Ngày</th><th className="pr-2">Giờ</th><th className="pr-2">Hình thức</th><th className="pr-2">Giáo viên</th><th className="pr-2">TT</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.sessions.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-ink-subtle">Chưa có buổi nào. Cấu hình lịch lặp rồi bấm “Sinh buổi học”.</td></tr>}
                {p.sessions.map((s) => (
                  <tr key={s.id} className={s.status === "cancelled" ? "opacity-50" : ""}>
                    <td className="py-2 pr-2">{formatDate(s.session_date)}{s.makeup_of ? " (bù)" : ""}</td>
                    <td className="pr-2">{s.planned_start}–{s.planned_end}</td>
                    <td className="pr-2">{MODE_LABELS[s.mode]}{s.room ? ` · ${s.room}` : ""}</td>
                    <td className="pr-2 text-ink-muted">{s.teachers.map((t) => t.name).join(", ") || "—"}</td>
                    <td className="pr-2"><span className={`rounded-full px-1.5 py-0.5 text-[11px] ${SESSION_STATUS_COLORS[s.status]}`}>{SESSION_STATUS_LABELS[s.status]}</span></td>
                    <td className="text-right">
                      {canManage && s.status !== "cancelled" && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setTeacherModal(s)} className="text-primary hover:underline">GV</button>
                          <button onClick={() => setMoveModal(s)} className="text-ink-muted hover:underline">Dời</button>
                          <button onClick={() => { if (confirm("Hủy buổi này?")) run(() => cancelSession(s.id, cls.id)); }} className="text-danger hover:underline">Hủy</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ghi danh */}
      <div className="card mt-4 p-4">
        <h2 className="h-section mb-2">Học viên ghi danh ({activeCount} đang học)</h2>
        {canManage && (
          <div className="mb-3 flex gap-2">
            <select id="enroll-sel" className="rounded-md border border-line px-3 py-2 text-sm" defaultValue="">
              <option value="" disabled>— Chọn học viên để thêm —</option>
              {p.availableStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <button onClick={() => { const el = document.getElementById("enroll-sel") as HTMLSelectElement; if (el?.value) run(() => enrollStudent(cls.id, el.value)); }}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover">Thêm vào lớp</button>
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-subtle"><tr><th className="py-1">Học viên</th><th>Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-line">
            {p.enrollments.length === 0 && <tr><td colSpan={2} className="py-3 text-center text-ink-subtle">Chưa có học viên.</td></tr>}
            {p.enrollments.map((e) => (
              <tr key={e.id}>
                <td className="py-2 text-ink">{e.student_name}</td>
                <td>
                  {canManage ? (
                    <select defaultValue={e.status} onChange={(ev) => run(() => updateEnrollment(e.id, cls.id, ev.target.value))}
                      className="rounded-md border border-line px-2 py-1 text-sm">
                      <option value="active">Đang học</option>
                      <option value="completed">Hoàn thành</option>
                      <option value="dropped">Đã nghỉ</option>
                    </select>
                  ) : e.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {editClass && (
        <ClassForm isCeo={false} branches={[]} teachers={p.teachers} defaultBranchId={cls.branch_id}
          cls={{ ...cls, assistant_ids: cls.assistant_ids }} onClose={() => setEditClass(false)} onSaved={() => { setEditClass(false); refresh(); }} />
      )}
      {teacherModal && (
        <TeacherModal session={teacherModal} teachers={p.teachers} classId={cls.id}
          onClose={() => setTeacherModal(null)} onSaved={() => { setTeacherModal(null); refresh(); }} />
      )}
      {moveModal && (
        <MoveModal session={moveModal} classId={cls.id} onClose={() => setMoveModal(null)} onSaved={() => { setMoveModal(null); refresh(); }} />
      )}
      {adHoc && (
        <AdHocModal classId={cls.id} sessions={p.sessions} onClose={() => setAdHoc(false)} onSaved={() => { setAdHoc(false); refresh(); }} />
      )}
    </div>
  );
}

function ScheduleAdd({ classId, onDone }: { classId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [wd, setWd] = useState(1);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [mode, setMode] = useState("offline");
  const [room, setRoom] = useState("");
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <p className="t-label">Thêm dòng lịch</p>
      <div className="flex flex-wrap gap-2">
        <select value={wd} onChange={(e) => setWd(Number(e.target.value))} className="rounded-md border border-line px-2 py-1.5 text-sm">
          {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
        </select>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm" />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm" />
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm">
          <option value="offline">Tại lớp</option><option value="online">Online</option>
        </select>
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Phòng" className="w-20 rounded-md border border-line px-2 py-1.5 text-sm" />
        <button disabled={isPending} onClick={() => startTransition(async () => { const r = await saveSchedule({ class_id: classId, weekday: wd, planned_start: start, planned_end: end, mode, room }); if (!r.ok) alert(r.error); onDone(); })}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Thêm</button>
      </div>
    </div>
  );
}

function TeacherModal({ session, teachers, classId, onClose, onSaved }: { session: SessionRow; teachers: TeacherOption[]; classId: string; onClose: () => void; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [sel, setSel] = useState<Record<string, string>>(
    Object.fromEntries(session.teachers.map((t) => [t.teacher_id, t.role]))
  );
  const toggle = (id: string) => setSel((p) => { const n = { ...p }; if (n[id]) delete n[id]; else n[id] = "assistant"; return n; });
  const setRole = (id: string, r: string) => setSel((p) => ({ ...p, [id]: r }));
  return (
    <Modal title="Gán giáo viên cho buổi" onClose={onClose}>
      <div className="space-y-2">
        {teachers.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!sel[t.id]} onChange={() => toggle(t.id)} />
            <span className="flex-1">{t.full_name} <span className="t-caption">({t.teacher_type})</span></span>
            {sel[t.id] && (
              <select value={sel[t.id]} onChange={(e) => setRole(t.id, e.target.value)} className="rounded border border-line px-1.5 py-1 text-xs">
                <option value="main">Chính</option><option value="assistant">Phụ</option><option value="gvnn">GVNN</option><option value="vn">VN</option>
              </select>
            )}
          </div>
        ))}
      </div>
      <ModalActions isPending={isPending} onClose={onClose}
        onSave={() => startTransition(async () => { const r = await setSessionTeachers(session.id, classId, Object.entries(sel).map(([teacher_id, role]) => ({ teacher_id, role }))); if (!r.ok) alert(r.error); else onSaved(); })} />
    </Modal>
  );
}

function MoveModal({ session, classId, onClose, onSaved }: { session: SessionRow; classId: string; onClose: () => void; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(session.session_date);
  const [start, setStart] = useState(session.planned_start);
  const [end, setEnd] = useState(session.planned_end);
  return (
    <Modal title="Dời buổi học" onClose={onClose}>
      <div className="space-y-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1 rounded-md border border-line px-3 py-2 text-sm" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="flex-1 rounded-md border border-line px-3 py-2 text-sm" />
        </div>
      </div>
      <ModalActions isPending={isPending} onClose={onClose}
        onSave={() => startTransition(async () => { const r = await updateSession({ id: session.id, class_id: classId, session_date: date, planned_start: start, planned_end: end }); if (!r.ok) alert(r.error); else onSaved(); })} />
    </Modal>
  );
}

function AdHocModal({ classId, sessions, onClose, onSaved }: { classId: string; sessions: SessionRow[]; onClose: () => void; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [mode, setMode] = useState("offline");
  const [room, setRoom] = useState("");
  const [teams, setTeams] = useState("");
  const [makeupOf, setMakeupOf] = useState("");
  return (
    <Modal title="Thêm buổi lẻ / học bù" onClose={onClose}>
      <div className="space-y-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1 rounded-md border border-line px-3 py-2 text-sm" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="flex-1 rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-sm">
          <option value="offline">Tại lớp</option><option value="online">Online</option>
        </select>
        {mode === "offline"
          ? <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Phòng" className="w-full rounded-md border border-line px-3 py-2 text-sm" />
          : <input value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="Link Teams (P2)" className="w-full rounded-md border border-line px-3 py-2 text-sm" />}
        <select value={makeupOf} onChange={(e) => setMakeupOf(e.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-sm">
          <option value="">(Buổi lẻ, không phải học bù)</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>Bù cho: {formatDate(s.session_date)} {s.planned_start}</option>)}
        </select>
      </div>
      <ModalActions isPending={isPending} onClose={onClose}
        onSave={() => { if (!date) return alert("Chọn ngày."); startTransition(async () => { const r = await addAdHocSession({ class_id: classId, session_date: date, planned_start: start, planned_end: end, mode, room, teams_meeting_url: teams, makeup_of: makeupOf || null }); if (!r.ok) alert(r.error); else onSaved(); }); }} />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ isPending, onClose, onSave }: { isPending: boolean; onClose: () => void; onSave: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button onClick={onClose} disabled={isPending} className="rounded-md border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-2">Huỷ</button>
      <button onClick={onSave} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">{isPending ? "Đang lưu…" : "Lưu"}</button>
    </div>
  );
}
