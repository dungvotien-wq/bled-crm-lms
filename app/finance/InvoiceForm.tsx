"use client";

import { useMemo, useState, useTransition } from "react";
import { PROGRAMS } from "@/lib/programs";
import { PERIOD_TYPES, formatVnd, parseVndInput, computeLine } from "@/lib/finance";
import { createInvoice } from "./actions";

interface Plan {
  id: string; branch_id: string | null; program: string; period_type: string;
  unit_price: number; total_hours: number | null; unit_label: string; product_code: string | null;
}

interface Props {
  isCeo: boolean;
  canManualPrice: boolean;
  families: { id: string; parent_name: string; phone: string | null; branch_id: string }[];
  students: { id: string; family_id: string; full_name: string }[];
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}

export default function InvoiceForm({ isCeo, canManualPrice, families, students, plans, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [familyId, setFamilyId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [program, setProgram] = useState(PROGRAMS[0]);
  const [period, setPeriod] = useState("month");
  const [dueDate, setDueDate] = useState("");
  const [discountKind, setDiscountKind] = useState<"amount" | "pct">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [manual, setManual] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  // snapshot bổ sung
  const [courseStart, setCourseStart] = useState("");
  const [courseEnd, setCourseEnd] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [homeroom, setHomeroom] = useState("");
  const [room, setRoom] = useState("");
  const [campaign, setCampaign] = useState("");

  const famStudents = useMemo(() => students.filter((s) => s.family_id === familyId), [students, familyId]);
  const branchOfFamily = families.find((f) => f.id === familyId)?.branch_id ?? null;

  const plan = useMemo(() => {
    if (manual) return null;
    const matches = plans.filter((p) => p.program === program && p.period_type === period &&
      (p.branch_id === branchOfFamily || p.branch_id === null));
    if (matches.length === 0) return null;
    return matches.find((p) => p.branch_id === branchOfFamily) ?? matches[0];
  }, [manual, plans, program, period, branchOfFamily]);

  const unitPrice = manual ? parseVndInput(manualPrice) : (plan?.unit_price ?? null);
  const quantity = manual ? 1 : (plan?.total_hours && plan.total_hours > 0 ? plan.total_hours : 1);
  const line = unitPrice == null ? null : computeLine(quantity, unitPrice, discountKind, discountValue);

  function submit() {
    setError(null);
    if (!familyId) return setError("Chọn gia đình.");
    startTransition(async () => {
      const res = await createInvoice({
        family_id: familyId, student_id: studentId || null, program, period_type: period,
        due_date: dueDate || null, discount_kind: discountKind, discount_value: discountValue,
        discount_reason: discountReason, manual_price: manual,
        manual_unit_price: manualPrice, manual_price_reason: manualReason,
        course_start: courseStart || null, course_end: courseEnd || null,
        tuition_valid_until: validUntil || null, homeroom_teacher: homeroom || null,
        room_class: room || null, campaign: campaign || null,
      });
      if (!res.ok) return setError(res.error ?? "Lỗi.");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Tạo hóa đơn</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="lbl">Gia đình *</label>
            <select value={familyId} onChange={(e) => { setFamilyId(e.target.value); setStudentId(""); }} className="inp">
              <option value="">— Chọn gia đình —</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.parent_name}{f.phone ? ` · ${f.phone}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Học viên</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="inp" disabled={!familyId}>
              <option value="">— Chọn học viên —</option>
              {famStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Hạn thanh toán</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="inp" />
          </div>
          <div>
            <label className="lbl">Chương trình</label>
            <select value={program} onChange={(e) => setProgram(e.target.value)} className="inp">
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Kỳ</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="inp">
              {PERIOD_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Snapshot chứng từ */}
          <div><label className="lbl">Ngày bắt đầu khóa</label><input type="date" value={courseStart} onChange={(e) => setCourseStart(e.target.value)} className="inp" /></div>
          <div><label className="lbl">Ngày kết thúc khóa</label><input type="date" value={courseEnd} onChange={(e) => setCourseEnd(e.target.value)} className="inp" /></div>
          <div><label className="lbl">Thời hạn học phí (hiệu lực)</label><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="inp" /></div>
          <div><label className="lbl">PC Chủ nhiệm</label><input value={homeroom} onChange={(e) => setHomeroom(e.target.value)} className="inp" placeholder="Cô/Thầy…" /></div>
          <div><label className="lbl">Phòng / Lớp</label><input value={room} onChange={(e) => setRoom(e.target.value)} className="inp" /></div>
          <div><label className="lbl">Chiến dịch</label><input value={campaign} onChange={(e) => setCampaign(e.target.value)} className="inp" /></div>
        </div>

        {/* Giá thủ công */}
        {canManualPrice && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
              Giá thủ công (ngoại lệ — có ghi log)
            </label>
            {manual && (
              <div className="mt-2 space-y-2">
                <input value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="Đơn giá thủ công (VND)" className="inp" inputMode="numeric" />
                <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Lý do giá thủ công *" className="inp" />
              </div>
            )}
          </div>
        )}

        {/* Giảm giá */}
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <label className="lbl">Giảm giá</label>
          <div className="flex gap-2">
            <select value={discountKind} onChange={(e) => setDiscountKind(e.target.value as "amount" | "pct")} className="inp w-24">
              <option value="amount">VND</option>
              <option value="pct">%</option>
            </select>
            <input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountKind === "pct" ? "vd 10" : "vd 200.000"} className="inp flex-1" inputMode="numeric" />
          </div>
          <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}
            placeholder="Lý do giảm (bắt buộc nếu có giảm)" className="inp mt-2" />
        </div>

        {/* Tóm tắt tiền */}
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          {unitPrice == null ? (
            <p className="text-red-600">Chưa có bảng giá cho lựa chọn này. Vào /pricing thêm, hoặc bật giá thủ công.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Đơn giá × SL</span><b>{formatVnd(unitPrice)} × {quantity} = {formatVnd(line!.gross)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Giảm ({line!.pct}%)</span><b className="text-amber-700">− {formatVnd(line!.discount)}</b></div>
              <div className="flex justify-between border-t pt-1"><span className="text-slate-500">Phải thu</span><b className="text-blue-700">{formatVnd(line!.amount)}</b></div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Đang tạo…" : "Tạo hóa đơn"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}.lbl{display:block;margin-bottom:.25rem;font-size:.75rem;font-weight:500;color:#64748b}`}</style>
    </div>
  );
}
