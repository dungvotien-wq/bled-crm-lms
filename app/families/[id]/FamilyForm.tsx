"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Family, FamilyTier } from "@/lib/families-types";
import { TIER_LABELS } from "@/lib/families-types";
import { CONTACT_ROLE_LABELS, type ContactRole } from "@/lib/leads-types";
import { createFamily, updateFamily } from "../actions";

interface Props {
  isCeo: boolean;
  branches: { id: string; name: string }[];
  defaultBranchId: string | null;
  family: Family | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}

export default function FamilyForm({ isCeo, branches, defaultBranchId, family, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = !!family;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<{ id: string; parent_name: string } | null>(null);

  const [parentName, setParentName] = useState(family?.parent_name ?? "");
  const [contactRole, setContactRole] = useState<ContactRole | "">(family?.contact_role ?? "");
  const [phone, setPhone] = useState(family?.phone ?? "");
  const [email, setEmail] = useState(family?.email ?? "");
  const [zalo, setZalo] = useState(family?.zalo ?? "");
  const [facebook, setFacebook] = useState(family?.facebook ?? "");
  const [address, setAddress] = useState(family?.address ?? "");
  const [tier, setTier] = useState<FamilyTier>(family?.tier ?? "standard");
  const [note, setNote] = useState(family?.note ?? "");
  const [branchId, setBranchId] = useState(family?.branch_id ?? defaultBranchId ?? "");

  function submit() {
    setError(null); setDup(null);
    if (!parentName.trim()) return setError("Vui lòng nhập tên phụ huynh.");
    if (!phone.trim()) return setError("Vui lòng nhập số điện thoại.");
    if (isCeo && !isEdit && !branchId) return setError("Vui lòng chọn chi nhánh.");

    startTransition(async () => {
      const payload = {
        id: family?.id, parent_name: parentName, contact_role: (contactRole || null) as ContactRole | null,
        phone, email, zalo, facebook, address, tier, note, branch_id: branchId,
      };
      const res = isEdit ? await updateFamily(payload) : await createFamily(payload);
      if (!res.ok) {
        if (res.duplicate) setDup(res.duplicate);
        return setError(res.error ?? "Có lỗi xảy ra.");
      }
      onSaved(res.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{isEdit ? "Sửa gia đình" : "Thêm gia đình"}</h2>

        <div className="grid grid-cols-2 gap-4">
          <F label="Tên phụ huynh *"><input value={parentName} onChange={(e) => setParentName(e.target.value)} className="inp" /></F>
          <F label="Vai trò">
            <select value={contactRole} onChange={(e) => setContactRole(e.target.value as ContactRole | "")} className="inp">
              <option value="">— Chọn vai trò —</option>
              {Object.entries(CONTACT_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          <F label="Số điện thoại *"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="inp" /></F>
          <F label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className="inp" /></F>
          <F label="Zalo"><input value={zalo} onChange={(e) => setZalo(e.target.value)} className="inp" /></F>
          <F label="Facebook"><input value={facebook} onChange={(e) => setFacebook(e.target.value)} className="inp" /></F>
          <F label="Phân loại">
            <select value={tier} onChange={(e) => setTier(e.target.value as FamilyTier)} className="inp">
              {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          {isCeo && !isEdit && (
            <F label="Chi nhánh *">
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="inp">
                <option value="">— Chọn chi nhánh —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </F>
          )}
          <F label="Địa chỉ" full><input value={address} onChange={(e) => setAddress(e.target.value)} className="inp" /></F>
          <F label="Ghi chú" full><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="inp" /></F>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
            {dup && (
              <> {" "}<button onClick={() => { onClose(); router.push(`/families/${dup.id}`); }} className="font-medium underline">
                Mở gia đình "{dup.parent_name}"
              </button></>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button onClick={submit} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo gia đình"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </div>
  );
}

function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
