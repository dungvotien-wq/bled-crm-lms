"use client";

import { useState, useTransition } from "react";
import type { Student, StudentStatus } from "@/lib/families-types";
import { STUDENT_STATUS_LABELS } from "@/lib/families-types";
import { saveStudent } from "../actions";

interface Props {
  familyId: string;
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentForm({ familyId, student, onClose, onSaved }: Props) {
  const isEdit = !!student;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(student?.full_name ?? "");
  const [dob, setDob] = useState(student?.dob ?? "");
  const [gender, setGender] = useState(student?.gender ?? "");
  const [level, setLevel] = useState(student?.level ?? "");
  const [status, setStatus] = useState<StudentStatus>(student?.status ?? "active");

  function submit() {
    setError(null);
    if (!fullName.trim()) return setError("Vui lòng nhập tên học viên.");
    startTransition(async () => {
      const res = await saveStudent({
        id: student?.id, family_id: familyId, full_name: fullName,
        dob: dob || null, gender: gender || null, level: level || null, status,
      });
      if (!res.ok) return setError(res.error ?? "Có lỗi xảy ra.");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{isEdit ? "Sửa học viên" : "Thêm con (học viên)"}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Tên học viên *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="inp" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Ngày sinh</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="inp" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Giới tính</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="inp">
              <option value="">—</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Trình độ (level)</label>
            <input value={level} onChange={(e) => setLevel(e.target.value)} className="inp" placeholder="Starters, Movers…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)} className="inp">
              {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Đang lưu…" : isEdit ? "Lưu" : "Thêm con"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </div>
  );
}
