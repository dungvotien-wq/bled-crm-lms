"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  Lead, BranchOption, UserOption, LeadSource, LeadStage, ContactRole, LeadNote,
  ReferrerType, ReferrerResult,
} from "@/lib/leads-types";
import {
  SOURCE_LABELS, STAGE_LABELS, STAGE_ORDER, CONTACT_ROLE_LABELS, REFERRER_TYPE_LABELS,
} from "@/lib/leads-types";
import { PROGRAMS } from "@/lib/programs";
import { normalizePhone, namesSimilar } from "@/lib/phone";
import { createLead, updateLead, addLeadNote, getLeadNotes, searchReferrers } from "./actions";

interface Props {
  isCeo: boolean;
  branches: BranchOption[];
  users: UserOption[];
  userMap: Record<string, string>;
  defaultBranchId: string | null;
  lead: Lead | null; // null = thêm mới
  allLeads?: Lead[];
  onClose: () => void;
  onSaved: () => void;
  onOpenDuplicate: (leadId: string) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function LeadForm({
  isCeo, branches, users, userMap, defaultBranchId, lead, allLeads = [], onClose, onSaved, onOpenDuplicate,
}: Props) {
  const isEdit = !!lead;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<{ id: string; student_name: string | null; stage: LeadStage } | null>(null);

  const [studentName, setStudentName] = useState(lead?.student_name ?? "");
  const [contactName, setContactName] = useState(lead?.contact_name ?? "");
  const [contactRole, setContactRole] = useState<ContactRole | "">(lead?.contact_role ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [source, setSource] = useState<LeadSource>(lead?.source ?? "other");
  const [stage, setStage] = useState<LeadStage>(lead?.stage ?? "new");
  const [programs, setPrograms] = useState<string[]>(lead?.programs ?? []);
  const [assignedTo, setAssignedTo] = useState(lead?.assigned_to ?? "");
  const [branchId, setBranchId] = useState(lead?.branch_id ?? defaultBranchId ?? "");

  // Người giới thiệu
  const [refType, setRefType] = useState<ReferrerType>(lead?.referrer_type ?? "none");
  const [refFamilyId, setRefFamilyId] = useState<string | null>(lead?.referrer_family_id ?? null);
  const [refStudentId, setRefStudentId] = useState<string | null>(lead?.referrer_student_id ?? null);
  const [refName, setRefName] = useState(lead?.referrer_name ?? "");
  const [refPhone, setRefPhone] = useState(lead?.referrer_phone ?? "");
  const [refSearch, setRefSearch] = useState("");
  const [refResults, setRefResults] = useState<ReferrerResult[]>([]);
  const [refSearching, setRefSearching] = useState(false);
  const [refManual, setRefManual] = useState(false);

  // Tra cứu người giới thiệu (debounce nhẹ)
  useEffect(() => {
    const q = refSearch.trim();
    if (q.length < 2) { setRefResults([]); return; }
    let alive = true;
    setRefSearching(true);
    const t = setTimeout(async () => {
      const r = await searchReferrers(q);
      if (alive) { setRefResults(r); setRefSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [refSearch]);

  function pickReferrer(r: ReferrerResult) {
    // 'lead' = người liên hệ trên lead khác -> lưu external (không có id thật).
    const type: ReferrerType = r.kind === "lead" ? "external" : r.kind;
    setRefType(type);
    setRefFamilyId(r.kind === "family" ? r.id : null);
    setRefStudentId(r.kind === "student" ? r.id : null);
    setRefName(r.name);
    setRefPhone(r.phone ?? "");
    setRefSearch(""); setRefResults([]); setRefManual(false);
  }
  function clearReferrer() {
    setRefType("none"); setRefFamilyId(null); setRefStudentId(null);
    setRefName(""); setRefPhone(""); setRefSearch(""); setRefResults([]); setRefManual(false);
  }

  // Nhật ký ghi chú
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [noteText, setNoteText] = useState("");
  useEffect(() => {
    if (lead?.id) getLeadNotes(lead.id).then(setNotes);
  }, [lead?.id]);

  // Phân loại trùng tức thì (client) — chốt cuối vẫn ở server + DB index.
  const effectiveBranch = isCeo ? branchId : defaultBranchId;
  const match = useMemo(() => {
    const target = normalizePhone(phone);
    if (!target) return null;
    const samePhone = allLeads.filter(
      (l) => l.id !== lead?.id && l.branch_id === effectiveBranch && normalizePhone(l.phone) === target
    );
    if (samePhone.length === 0) return null;
    const real = samePhone.find((l) => namesSimilar(l.student_name ?? "", studentName));
    return { kind: real ? "duplicate" : "sibling", lead: real ?? samePhone[0] } as const;
  }, [phone, studentName, allLeads, effectiveBranch, lead?.id]);

  function toggleProgram(p: string) {
    setPrograms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function submit() {
    setError(null);
    setDup(null);
    if (!isEdit && !studentName.trim()) return setError("Vui lòng nhập tên học viên.");
    if (!contactName.trim()) return setError("Vui lòng nhập tên người liên hệ.");
    if (!phone.trim()) return setError("Vui lòng nhập số điện thoại.");
    if (isCeo && !isEdit && !branchId) return setError("Vui lòng chọn chi nhánh.");

    startTransition(async () => {
      const payload = {
        id: lead?.id,
        student_name: studentName,
        contact_name: contactName,
        contact_role: (contactRole || null) as ContactRole | null,
        phone, source, stage, programs,
        assigned_to: assignedTo || null,
        branch_id: branchId,
        referrer_type: refType,
        referrer_family_id: refFamilyId,
        referrer_student_id: refStudentId,
        referrer_name: refName || null,
        referrer_phone: refPhone || null,
      };
      const res = isEdit ? await updateLead(payload) : await createLead(payload);
      if (!res.ok) {
        if (res.duplicate) setDup({ id: res.duplicate.id, student_name: res.duplicate.student_name, stage: res.duplicate.stage });
        return setError(res.error ?? "Có lỗi xảy ra.");
      }
      onSaved();
    });
  }

  function submitNote() {
    if (!lead?.id || !noteText.trim()) return;
    startTransition(async () => {
      const res = await addLeadNote(lead.id, noteText);
      if (!res.ok) return setError(res.error ?? "Không thêm được ghi chú.");
      setNoteText("");
      setNotes(await getLeadNotes(lead.id));
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">
          {isEdit ? "Sửa lead" : "Thêm lead mới"}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Dòng 1: Học viên | Chương trình */}
          <Field label="Tên học viên *">
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} className="inp" placeholder="Tên bé / học viên" />
          </Field>
          <Field label="Chương trình quan tâm (chọn nhiều)">
            <div className="flex flex-wrap gap-1.5">
              {PROGRAMS.map((p) => {
                const on = programs.includes(p);
                return (
                  <button type="button" key={p} onClick={() => toggleProgram(p)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {on ? "✓ " : ""}{p}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Dòng 2: Người liên hệ | Vai trò */}
          <Field label="Tên người liên hệ *">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="inp" placeholder="Tên phụ huynh / người liên hệ" />
          </Field>
          <Field label="Vai trò người liên hệ">
            <select value={contactRole} onChange={(e) => setContactRole(e.target.value as ContactRole | "")} className="inp">
              <option value="">— Chọn vai trò —</option>
              {Object.entries(CONTACT_ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          {/* Dòng 3: SĐT | Nguồn */}
          <Field label="Số điện thoại *">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="inp" />
          </Field>
          <Field label="Nguồn">
            <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className="inp">
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          {/* Dòng 4: Trạng thái | Người phụ trách */}
          <Field label="Trạng thái">
            <select value={stage} onChange={(e) => setStage(e.target.value as LeadStage)} className="inp">
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Người phụ trách">
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="inp">
              <option value="">— Chưa gán —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </Field>

          {isCeo && !isEdit && (
            <Field label="Chi nhánh *">
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="inp">
                <option value="">— Chọn chi nhánh —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {/* NGƯỜI GIỚI THIỆU (không bắt buộc) */}
        <div className={`mt-4 rounded-xl border p-3 ${source === "referral" ? "border-blue-300 bg-blue-50/40" : "border-slate-200"}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Người giới thiệu {source === "referral" && <span className="text-blue-600">(nên điền)</span>}
            </span>
            <span className="text-xs text-slate-400">không bắt buộc</span>
          </div>

          {refType !== "none" ? (
            // Đã chọn người giới thiệu
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
              <div className="text-sm">
                <b className="text-slate-800">{refName || "(không tên)"}</b>{" "}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {REFERRER_TYPE_LABELS[refType]}
                </span>
                {refPhone && <span className="ml-2 text-xs text-slate-500">{refPhone}</span>}
              </div>
              <button onClick={clearReferrer} className="text-xs font-medium text-red-600 hover:underline">
                Bỏ chọn
              </button>
            </div>
          ) : refManual ? (
            // Nhập tay (external)
            <div className="grid grid-cols-2 gap-2">
              <input value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Tên người giới thiệu *" className="inp" />
              <input value={refPhone} onChange={(e) => setRefPhone(e.target.value)} placeholder="SĐT người giới thiệu *" className="inp" />
              <div className="col-span-2 flex gap-2">
                <button
                  onClick={() => { if (refName.trim() && refPhone.trim()) setRefType("external"); }}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                >
                  Lưu người giới thiệu ngoài
                </button>
                <button onClick={() => { setRefManual(false); setRefName(""); setRefPhone(""); }} className="text-xs text-slate-500 hover:underline">
                  Huỷ nhập tay
                </button>
              </div>
            </div>
          ) : (
            // Tìm kiếm trong DB
            <div>
              <input
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                placeholder="Gõ tên / SĐT để tìm phụ huynh, học viên có sẵn…"
                className="inp"
              />
              {refSearching && <p className="mt-1 text-xs text-slate-400">Đang tìm…</p>}
              {refResults.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border bg-white">
                  {refResults.map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <button
                        onClick={() => pickReferrer(r)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span>
                          <b className="text-slate-800">{r.name}</b>
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                            {r.kind === "family" ? "Phụ huynh" : r.kind === "student" ? "Học viên" : "Liên hệ (lead)"}
                          </span>
                          {r.branch_name && <span className="ml-2 text-xs text-slate-400">{r.branch_name}</span>}
                        </span>
                        {r.phone && <span className="text-xs text-slate-500">{r.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {refSearch.trim().length >= 2 && !refSearching && refResults.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">Không tìm thấy.</p>
              )}
              <button onClick={() => setRefManual(true)} className="mt-2 text-xs font-medium text-blue-600 hover:underline">
                Không có sẵn — nhập tay
              </button>
            </div>
          )}
        </div>

        {/* Cảnh báo TRÙNG THẬT (chặn) */}
        {match?.kind === "duplicate" && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ Học viên <b>{match.lead.student_name || match.lead.contact_name}</b> (cùng SĐT) đã tồn tại
            ({STAGE_LABELS[match.lead.stage]}).{" "}
            <button onClick={() => onOpenDuplicate(match.lead.id)} className="font-medium underline">Mở lead đó</button>
          </div>
        )}
        {/* Cảnh báo mềm: ANH/CHỊ EM cùng người liên hệ */}
        {match?.kind === "sibling" && (
          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            👨‍👩‍👧 Cùng người liên hệ với lead: <b>{match.lead.student_name || match.lead.contact_name}</b>{" "}
            ({STAGE_LABELS[match.lead.stage]}). Có thể là anh/chị em — vẫn cho phép tạo; sau này nên nhóm chung phụ huynh.{" "}
            <button onClick={() => onOpenDuplicate(match.lead.id)} className="font-medium underline">Xem</button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
            {dup && (
              <>
                {" "}Lead trùng: <b>{dup.student_name ?? "(chưa có tên HV)"}</b> ({STAGE_LABELS[dup.stage]}).{" "}
                <button onClick={() => onOpenDuplicate(dup.id)} className="font-medium underline">Mở lead đó</button>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo lead"}
          </button>
        </div>

        {/* NHẬT KÝ GHI CHÚ — chỉ khi sửa */}
        {isEdit && (
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Nhật ký ghi chú</h3>
            <div className="flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Nhập ghi chú mới…" className="inp flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }} />
              <button onClick={submitNote} disabled={isPending || !noteText.trim()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                Thêm ghi chú
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {notes.length === 0 && <li className="text-sm text-slate-400">Chưa có ghi chú nào.</li>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm text-slate-700">{n.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(n.occurred_at)}
                    {n.created_by && userMap[n.created_by] ? ` · ${userMap[n.created_by]}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
