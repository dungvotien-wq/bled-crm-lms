"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TuitionPlan } from "@/lib/pricing-types";
import type { UserRole } from "@/lib/permissions";
import { PROGRAMS } from "@/lib/programs";
import { PERIOD_TYPES, periodLabel, formatVnd, parseVndInput } from "@/lib/finance";
import { savePlan, togglePlan } from "./actions";

interface Props {
  currentUser: { role: UserRole; branch_id: string | null };
  canEdit: boolean;
  plans: TuitionPlan[];
  branches: { id: string; name: string }[];
}

export default function PricingClient({ currentUser, canEdit, plans, branches }: Props) {
  const router = useRouter();
  const isCeo = currentUser.role === "ceo";
  const [isPending, startTransition] = useTransition();
  const [fBranch, setFBranch] = useState("all");
  const [editing, setEditing] = useState<TuitionPlan | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (isCeo && fBranch !== "all") {
        if (fBranch === "global") return p.branch_id === null;
        return p.branch_id === fBranch;
      }
      return true;
    });
  }, [plans, isCeo, fBranch]);

  function handleToggle(p: TuitionPlan) {
    startTransition(async () => {
      const res = await togglePlan(p.id, !p.active);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bảng giá học phí</h1>
          <p className="text-sm text-slate-500">{filtered.length} dòng giá</p>
        </div>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Thêm dòng giá
          </button>
        )}
      </div>

      {isCeo && (
        <div className="mb-4 flex gap-2 rounded-xl border bg-white p-3 shadow-sm">
          <select value={fBranch} onChange={(e) => setFBranch(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tất cả</option>
            <option value="global">Toàn hệ thống</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Chương trình</th>
              <th className="px-4 py-3">Kỳ</th>
              <th className="px-4 py-3">Phạm vi</th>
              <th className="px-4 py-3 text-right">Đơn giá</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              {canEdit && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có dòng giá.</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-medium text-slate-800">{p.program}</td>
                <td className="px-4 py-3 text-slate-600">{periodLabel(p.period_type)}</td>
                <td className="px-4 py-3 text-slate-600">{p.branch_id === null ? "Toàn hệ thống" : p.branch_name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatVnd(p.unit_price)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                    {p.active ? "Đang áp dụng" : "Tắt"}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(p)} className="text-xs text-blue-600 hover:underline">Sửa</button>
                    <button onClick={() => handleToggle(p)} disabled={isPending} className="ml-3 text-xs text-slate-500 hover:underline">
                      {p.active ? "Tắt" : "Bật"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <PlanForm
          isCeo={isCeo}
          branches={branches}
          defaultBranchId={currentUser.branch_id}
          plan={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); router.refresh(); }}
        />
      )}
    </main>
  );
}

function PlanForm({ isCeo, branches, defaultBranchId, plan, onClose, onSaved }: {
  isCeo: boolean; branches: { id: string; name: string }[]; defaultBranchId: string | null;
  plan: TuitionPlan | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!plan;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [program, setProgram] = useState(plan?.program ?? PROGRAMS[0]);
  const [period, setPeriod] = useState(plan?.period_type ?? "month");
  const [price, setPrice] = useState(plan ? String(plan.unit_price) : "");
  const [scope, setScope] = useState<string>(plan?.branch_id ?? (isCeo ? "global" : (defaultBranchId ?? "")));
  const [note, setNote] = useState(plan?.note ?? "");

  function submit() {
    setError(null);
    if (!parseVndInput(price)) return setError("Nhập đơn giá hợp lệ.");
    startTransition(async () => {
      const branch_id = isCeo ? (scope === "global" ? null : scope) : undefined;
      const res = await savePlan({
        id: plan?.id, program, period_type: period, unit_price: price, note, branch_id, active: plan?.active ?? true,
      });
      if (!res.ok) return setError(res.error ?? "Lỗi.");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{isEdit ? "Sửa dòng giá" : "Thêm dòng giá"}</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Chương trình</label>
            <select value={program} onChange={(e) => setProgram(e.target.value)} className="inp">
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Kỳ tính phí</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="inp">
              {PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Đơn giá (VND)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} className="inp" placeholder="2.000.000" inputMode="numeric" />
          </div>
          {isCeo && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Phạm vi</label>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="inp">
                <option value="global">Toàn hệ thống</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Ghi chú</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="inp" />
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </div>
  );
}
