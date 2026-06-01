"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FinanceRow } from "./page";
import type { UserRole } from "@/lib/permissions";
import {
  formatVnd, formatDate, computeInvoiceStatus, summarizeDebt,
  STATUS_LABELS, STATUS_COLORS, type InvoiceStatus,
} from "@/lib/finance";
import { createSampleInvoices } from "./actions";
import InvoiceForm from "./InvoiceForm";
import PaymentForm from "./PaymentForm";

interface Props {
  currentUser: { role: UserRole; branch_id: string | null };
  canManage: boolean;
  canManualPrice: boolean;
  rows: FinanceRow[];
  branches: { id: string; name: string }[];
  families: { id: string; parent_name: string; phone: string | null; branch_id: string }[];
  students: { id: string; family_id: string; full_name: string }[];
  plans: { id: string; branch_id: string | null; program: string; period_type: string; unit_price: number; total_hours: number | null; unit_label: string; product_code: string | null }[];
}

export default function FinanceClient({ currentUser, canManage, canManualPrice, rows, branches, families, students, plans }: Props) {
  const router = useRouter();
  const isCeo = currentUser.role === "ceo";
  const [isPending, startTransition] = useTransition();
  const [fBranch, setFBranch] = useState("all");
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<FinanceRow | null>(null);

  // Gắn trạng thái tính động
  const enriched = useMemo(() => rows.map((r) => ({
    ...r, liveStatus: computeInvoiceStatus(r.amount, r.paid, r.due_date, r.status) as InvoiceStatus,
  })), [rows]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (isCeo && fBranch !== "all" && r.branch_id !== fBranch) return false;
      if (onlyDebt && !["unpaid", "partial", "overdue"].includes(r.liveStatus)) return false;
      return true;
    });
  }, [enriched, isCeo, fBranch, onlyDebt]);

  const totals = useMemo(() => summarizeDebt(
    filtered.map((r) => ({ amount: r.amount, paid: r.paid, status: r.liveStatus }))
  ), [filtered]);

  function handleSample() {
    startTransition(async () => {
      const res = await createSampleInvoices();
      if (!res.ok) alert("Lỗi: " + res.error);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Học phí & Công nợ</h1>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={handleSample} disabled={isPending}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {isPending ? "Đang tạo…" : "Tạo hóa đơn mẫu"}
            </button>
            <button onClick={() => setCreating(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + Tạo hóa đơn
            </button>
          </div>
        )}
      </div>

      {/* Tổng */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Đã xuất" value={formatVnd(totals.issued)} />
        <Stat label="Đã thu" value={formatVnd(totals.paid)} color="text-green-600" />
        <Stat label="Còn nợ" value={formatVnd(totals.outstanding)} color={totals.outstanding > 0 ? "text-red-600" : "text-slate-700"} />
      </div>

      {/* Lọc */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm">
        {isCeo && (
          <select value={fBranch} onChange={(e) => setFBranch(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tất cả chi nhánh</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
          Chỉ hiện ai còn nợ
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Gia đình</th>
              <th className="px-3 py-3">Học viên</th>
              <th className="px-3 py-3">Số HĐ</th>
              <th className="px-3 py-3 text-right">Số tiền</th>
              <th className="px-3 py-3 text-right">Đã thu</th>
              <th className="px-3 py-3 text-right">Còn lại</th>
              <th className="px-3 py-3">Hạn</th>
              <th className="px-3 py-3">Trạng thái</th>
              {canManage && <th className="px-3 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Không có hóa đơn.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-medium text-slate-800">{r.family_name}</td>
                <td className="px-3 py-3 text-slate-600">{r.student_name ?? "—"}</td>
                <td className="px-3 py-3">
                  <Link href={`/finance/${r.id}`} className="text-blue-700 hover:underline">{r.code}</Link>
                </td>
                <td className="px-3 py-3 text-right text-slate-700">{formatVnd(r.amount)}</td>
                <td className="px-3 py-3 text-right text-green-600">{formatVnd(r.paid)}</td>
                <td className="px-3 py-3 text-right font-semibold text-red-600">{formatVnd(Math.max(0, r.amount - r.paid))}</td>
                <td className="px-3 py-3 text-slate-500">{formatDate(r.due_date)}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.liveStatus]}`}>
                    {STATUS_LABELS[r.liveStatus]}
                  </span>
                </td>
                {canManage && (
                  <td className="px-3 py-3 text-right">
                    {r.liveStatus !== "paid" && r.liveStatus !== "void" && (
                      <button onClick={() => setPaying(r)} className="text-xs font-medium text-blue-600 hover:underline">Ghi thu</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <InvoiceForm
          isCeo={isCeo}
          canManualPrice={canManualPrice}
          families={families}
          students={students}
          plans={plans}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); router.refresh(); }}
        />
      )}
      {paying && (
        <PaymentForm
          invoice={{ id: paying.id, code: paying.code, remaining: Math.max(0, paying.amount - paying.paid) }}
          onClose={() => setPaying(null)}
          onSaved={() => { setPaying(null); router.refresh(); }}
        />
      )}
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color ?? "text-slate-800"}`}>{value}</p>
    </div>
  );
}
