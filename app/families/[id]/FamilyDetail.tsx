"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Family, Student, InvoiceRow, InteractionRow } from "@/lib/families-types";
import {
  TIER_LABELS, TIER_COLORS, STUDENT_STATUS_LABELS, INTERACTION_CHANNELS,
  ageFromDob, formatVnd, formatDate,
} from "@/lib/families-types";
import { CONTACT_ROLE_LABELS } from "@/lib/leads-types";
import { computeInvoiceStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/finance";
import type { UserRole } from "@/lib/permissions";
import FamilyForm from "./FamilyForm";
import StudentForm from "./StudentForm";
import QuickInteraction from "./QuickInteraction";

interface Props {
  currentUser: { role: UserRole; branch_id: string | null };
  family: Family;
  students: Student[];
  invoices: InvoiceRow[];
  totals: { issued: number; paid: number; outstanding: number };
  interactions: InteractionRow[];
  userMap: Record<string, string>;
  branches: { id: string; name: string }[];
}

const channelLabel = (v: string) =>
  INTERACTION_CHANNELS.find((c) => c.value === v)?.label ?? v;

export default function FamilyDetail({
  currentUser, family, students, invoices, totals, interactions, userMap, branches,
}: Props) {
  const router = useRouter();
  const [editFamily, setEditFamily] = useState(false);
  const [studentForm, setStudentForm] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Breadcrumb */}
      <Link href="/families" className="text-sm text-blue-600 hover:underline">← Danh sách gia đình</Link>

      {/* Header */}
      <div className="mt-2 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">{family.parent_name}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[family.tier]}`}>
            {TIER_LABELS[family.tier]}
          </span>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Cột trái: liên hệ + công nợ */}
        <div className="space-y-5 md:col-span-1">
          {/* Thông tin liên hệ */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Thông tin liên hệ</h2>
              <button onClick={() => setEditFamily(true)} className="text-xs font-medium text-blue-600 hover:underline">Sửa</button>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row label="Vai trò" value={family.contact_role ? CONTACT_ROLE_LABELS[family.contact_role] : "—"} />
              <Row label="SĐT" value={family.phone ?? "—"} />
              <Row label="Email" value={family.email ?? "—"} />
              <Row label="Zalo" value={family.zalo ?? "—"} />
              <Row label="Facebook" value={family.facebook ?? "—"} />
              <Row label="Địa chỉ" value={family.address ?? "—"} />
            </dl>
            {family.note && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{family.note}</p>}
          </div>

          {/* Công nợ */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Công nợ</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Đã xuất</span><b>{formatVnd(totals.issued)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Đã thu</span><b className="text-green-600">{formatVnd(totals.paid)}</b></div>
              <div className="flex justify-between border-t pt-1.5"><span className="text-slate-500">Còn nợ</span>
                <b className={totals.outstanding > 0 ? "text-red-600" : "text-slate-700"}>{formatVnd(totals.outstanding)}</b></div>
            </div>
            {invoices.length > 0 && (
              <ul className="mt-3 space-y-2 border-t pt-3">
                {invoices.slice(0, 5).map((inv) => (
                  <li key={inv.id} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{inv.code}</span>
                      <span className="text-slate-600">{formatVnd(inv.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>{inv.description ?? ""} · hạn {formatDate(inv.due_date)}</span>
                      <span>đã thu {formatVnd(inv.paid)}</span>
                    </div>
                    {(() => {
                      const st = computeInvoiceStatus(inv.amount, inv.paid, inv.due_date, inv.status);
                      return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[st]}`}>{STATUS_LABELS[st]}</span>;
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Cột phải: con + tương tác */}
        <div className="space-y-5 md:col-span-2">
          {/* Danh sách con */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Học viên (con) — {students.length}</h2>
              <button onClick={() => setStudentForm({ open: true, student: null })}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">+ Thêm con</button>
            </div>
            {students.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có học viên nào.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr><th className="py-1">Tên</th><th>Tuổi</th><th>Level</th><th>Lớp</th><th>Trạng thái</th><th></th></tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((s) => {
                    const age = ageFromDob(s.dob);
                    return (
                      <tr key={s.id}>
                        <td className="py-2 font-medium text-slate-800">{s.full_name}</td>
                        <td className="text-slate-600">{age !== null ? `${age}t` : "—"}</td>
                        <td className="text-slate-600">{s.level ?? "—"}</td>
                        <td className="text-slate-600">{s.current_class ?? "—"}</td>
                        <td><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{STUDENT_STATUS_LABELS[s.status]}</span></td>
                        <td className="text-right">
                          <button onClick={() => setStudentForm({ open: true, student: s })} className="text-xs text-blue-600 hover:underline">Sửa</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Ghi nhanh tương tác */}
          <QuickInteraction familyId={family.id} />

          {/* Dòng thời gian tương tác */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Dòng thời gian tương tác</h2>
            {interactions.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có tương tác nào.</p>
            ) : (
              <ul className="space-y-3">
                {interactions.map((it) => (
                  <li key={it.id} className="border-l-2 border-blue-200 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">{channelLabel(it.channel)}</span>
                      <span className="text-xs text-slate-400">
                        {formatDate(it.occurred_at)}
                        {it.created_by && userMap[it.created_by] ? ` · ${userMap[it.created_by]}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{it.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {editFamily && (
        <FamilyForm
          isCeo={currentUser.role === "ceo"}
          branches={branches}
          defaultBranchId={currentUser.branch_id}
          family={family}
          onClose={() => setEditFamily(false)}
          onSaved={() => { setEditFamily(false); router.refresh(); }}
        />
      )}
      {studentForm.open && (
        <StudentForm
          familyId={family.id}
          student={studentForm.student}
          onClose={() => setStudentForm({ open: false, student: null })}
          onSaved={() => { setStudentForm({ open: false, student: null }); router.refresh(); }}
        />
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
