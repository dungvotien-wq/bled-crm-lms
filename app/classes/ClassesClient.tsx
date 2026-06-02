"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClassRow, TeacherOption } from "@/lib/classes-types";
import { PROGRAMS } from "@/lib/programs";
import type { UserRole } from "@/lib/permissions";
import { createSampleClass } from "./actions";
import ClassForm from "./ClassForm";

const STATUS_LABELS: Record<string, string> = { active: "Đang mở", completed: "Hoàn thành", cancelled: "Đã hủy" };

interface Props {
  currentUser: { role: UserRole; branch_id: string | null };
  rows: ClassRow[];
  teachers: TeacherOption[];
  branches: { id: string; name: string }[];
}

export default function ClassesClient({ currentUser, rows, teachers, branches }: Props) {
  const router = useRouter();
  const isCeo = currentUser.role === "ceo";
  const canManage = ["ceo", "branch_manager", "cm"].includes(currentUser.role);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [fProgram, setFProgram] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fBranch, setFBranch] = useState("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => rows.filter((r) => {
    if (isCeo && fBranch !== "all" && r.branch_id !== fBranch) return false;
    if (fProgram !== "all" && r.program !== fProgram) return false;
    if (fStatus !== "all" && r.status !== fStatus) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${r.code} ${r.name}`.toLowerCase().includes(q)) return false;
    return true;
  }), [rows, isCeo, fBranch, fProgram, fStatus, search]);

  function handleSample() {
    startTransition(async () => {
      const res = await createSampleClass(isCeo && fBranch !== "all" ? fBranch : undefined);
      if (!res.ok) alert("Lỗi: " + res.error);
      else if (res.id) router.push(`/classes/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h-page">Lớp & Lịch học</h1>
          <p className="t-caption">{filtered.length} lớp</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={handleSample} disabled={isPending} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted hover:bg-surface-2 disabled:opacity-50">
              {isPending ? "Đang tạo…" : "Tạo lớp mẫu"}
            </button>
            <button onClick={() => setAdding(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              + Thêm lớp
            </button>
          </div>
        )}
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã / tên lớp…" className="w-52 rounded-md border border-line px-3 py-2 text-sm" />
        {isCeo && (
          <select value={fBranch} onChange={(e) => setFBranch(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="all">Tất cả chi nhánh</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={fProgram} onChange={(e) => setFProgram(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
          <option value="all">Tất cả chương trình</option>
          {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase text-ink-subtle">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Tên lớp</th>
              <th className="px-4 py-3">Chương trình</th>
              <th className="px-4 py-3">GV chính</th>
              <th className="px-4 py-3 text-center">Sĩ số</th>
              <th className="px-4 py-3 text-center">Buổi</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-subtle">Chưa có lớp nào.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2">
                <td className="px-4 py-3"><Link href={`/classes/${r.id}`} className="font-medium text-primary hover:underline">{r.code}</Link></td>
                <td className="px-4 py-3 text-ink">{r.name}</td>
                <td className="px-4 py-3 text-ink-muted">{r.program ?? "—"}</td>
                <td className="px-4 py-3 text-ink-muted">{r.teacher_name ?? "—"}</td>
                <td className="px-4 py-3 text-center text-ink-muted">{r.enrolled_count}</td>
                <td className="px-4 py-3 text-center text-ink-muted">{r.session_count}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">{STATUS_LABELS[r.status] ?? r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <ClassForm
          isCeo={isCeo} branches={branches} teachers={teachers} defaultBranchId={currentUser.branch_id}
          cls={null}
          onClose={() => setAdding(false)}
          onSaved={(id) => { setAdding(false); if (id) router.push(`/classes/${id}`); else router.refresh(); }}
        />
      )}
    </div>
  );
}
