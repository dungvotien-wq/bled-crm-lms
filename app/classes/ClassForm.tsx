"use client";

import { useState, useTransition } from "react";
import type { TeacherOption } from "@/lib/classes-types";
import { PROGRAMS } from "@/lib/programs";
import { saveClass } from "./actions";

interface ClassData {
  id: string; code: string; name: string; program: string | null; teacher_id: string | null;
  start_date: string | null; end_date: string | null; status: string; branch_id: string;
  assistant_ids?: string[];
}

interface Props {
  isCeo: boolean;
  branches: { id: string; name: string }[];
  teachers: TeacherOption[];
  defaultBranchId: string | null;
  cls: ClassData | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}

export default function ClassForm({ isCeo, branches, teachers, defaultBranchId, cls, onClose, onSaved }: Props) {
  const isEdit = !!cls;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState(cls?.code ?? "");
  const [name, setName] = useState(cls?.name ?? "");
  const [program, setProgram] = useState(cls?.program ?? PROGRAMS[0]);
  const [teacherId, setTeacherId] = useState(cls?.teacher_id ?? "");
  const [assistants, setAssistants] = useState<string[]>(cls?.assistant_ids ?? []);
  const [startDate, setStartDate] = useState(cls?.start_date ?? "");
  const [endDate, setEndDate] = useState(cls?.end_date ?? "");
  const [status, setStatus] = useState(cls?.status ?? "active");
  const [branchId, setBranchId] = useState(cls?.branch_id ?? defaultBranchId ?? "");

  function toggleAssistant(id: string) {
    setAssistants((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function submit() {
    setError(null);
    if (!code.trim()) return setError("Nhập mã lớp.");
    if (!name.trim()) return setError("Nhập tên lớp.");
    if (isCeo && !isEdit && !branchId) return setError("Chọn chi nhánh.");
    startTransition(async () => {
      const res = await saveClass({
        id: cls?.id, code, name, program, teacher_id: teacherId || null,
        assistant_ids: assistants, start_date: startDate || null, end_date: endDate || null,
        status, branch_id: branchId,
      });
      if (!res.ok) return setError(res.error ?? "Lỗi.");
      onSaved(res.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-ink">{isEdit ? "Sửa lớp" : "Thêm lớp"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <L label="Mã lớp *"><input value={code} onChange={(e) => setCode(e.target.value)} className="inp" /></L>
          <L label="Tên lớp *"><input value={name} onChange={(e) => setName(e.target.value)} className="inp" /></L>
          <L label="Chương trình">
            <select value={program} onChange={(e) => setProgram(e.target.value)} className="inp">
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </L>
          <L label="GV chính">
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="inp">
              <option value="">— Chọn GV —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </L>
          <L label="Ngày bắt đầu"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="inp" /></L>
          <L label="Ngày kết thúc"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="inp" /></L>
          <L label="Trạng thái">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="inp">
              <option value="active">Đang mở</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </L>
          {isCeo && !isEdit && (
            <L label="Chi nhánh *">
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="inp">
                <option value="">— Chọn —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </L>
          )}
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-subtle">GV phụ (chọn nhiều)</label>
            <div className="flex flex-wrap gap-1.5">
              {teachers.filter((t) => t.id !== teacherId).map((t) => {
                const on = assistants.includes(t.id);
                return (
                  <button type="button" key={t.id} onClick={() => toggleAssistant(t.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-muted hover:bg-surface-2"}`}>
                    {on ? "✓ " : ""}{t.full_name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-md border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-2">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
            {isPending ? "Đang lưu…" : isEdit ? "Lưu" : "Tạo lớp"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid var(--border);border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-ink-subtle">{label}</label>{children}</div>;
}
