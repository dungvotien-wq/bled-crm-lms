"use client";

import { useState, useTransition } from "react";
import { formatVnd, parseVndInput } from "@/lib/finance";
import { addPayment } from "./actions";

const METHODS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank", label: "Chuyển khoản" },
  { value: "vnpay", label: "VNPay" },
  { value: "momo", label: "MoMo" },
  { value: "other", label: "Khác" },
];

interface Props {
  invoice: { id: string; code: string; remaining: number };
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentForm({ invoice, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(invoice.remaining));
  const [method, setMethod] = useState("bank");
  const [refNo, setRefNo] = useState("");

  function submit() {
    setError(null);
    if (parseVndInput(amount) <= 0) return setError("Nhập số tiền hợp lệ.");
    startTransition(async () => {
      const res = await addPayment({ invoice_id: invoice.id, amount, method, ref_no: refNo });
      if (!res.ok) return setError(res.error ?? "Lỗi.");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-bold text-slate-800">Ghi nhận thanh toán</h2>
        <p className="mb-4 text-sm text-slate-500">HĐ {invoice.code} · còn lại <b>{formatVnd(invoice.remaining)}</b></p>

        <div className="space-y-3">
          <div>
            <label className="lbl">Số tiền (VND) *</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="inp" inputMode="numeric" />
          </div>
          <div>
            <label className="lbl">Phương thức</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="inp">
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Mã đối soát (ref_no)</label>
            <input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="inp" placeholder="Mã giao dịch (nếu có)" />
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Đang ghi…" : "Ghi thanh toán"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}.lbl{display:block;margin-bottom:.25rem;font-size:.75rem;font-weight:500;color:#64748b}`}</style>
    </div>
  );
}
