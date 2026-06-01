"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FamilyListRow, FamilyTier } from "@/lib/families-types";
import { TIER_LABELS, TIER_COLORS, formatVnd } from "@/lib/families-types";
import type { UserRole } from "@/lib/permissions";
import { createSampleFamilies } from "./actions";
import FamilyForm from "./[id]/FamilyForm";

interface Props {
  currentUser: { role: UserRole; branch_id: string | null; branch_name: string | null };
  rows: FamilyListRow[];
  branches: { id: string; name: string }[];
}

export default function FamiliesClient({ currentUser, rows, branches }: Props) {
  const router = useRouter();
  const isCeo = currentUser.role === "ceo";
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [fBranch, setFBranch] = useState("all");
  const [fTier, setFTier] = useState("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (isCeo && fBranch !== "all" && r.branch_id !== fBranch) return false;
      if (fTier !== "all" && r.tier !== fTier) return false;
      if (q) {
        const hay = `${r.parent_name} ${r.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, isCeo, fBranch, fTier, search]);

  function handleSample() {
    startTransition(async () => {
      const branchArg = isCeo ? (fBranch !== "all" ? fBranch : undefined) : undefined;
      const res = await createSampleFamilies(branchArg);
      if (!res.ok) alert("Lỗi tạo mẫu: " + res.error);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hồ sơ Gia đình</h1>
          <p className="text-sm text-slate-500">
            {isCeo ? "Toàn hệ thống" : `Chi nhánh: ${currentUser.branch_name ?? "—"}`} · {filtered.length} gia đình
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSample} disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {isPending ? "Đang tạo…" : "Tạo gia đình mẫu"}
          </button>
          <button onClick={() => setAdding(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Thêm gia đình
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên PH / SĐT…"
          className="w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        {isCeo && (
          <select value={fBranch} onChange={(e) => setFBranch(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <option value="all">Tất cả chi nhánh</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={fTier} onChange={(e) => setFTier(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <option value="all">Tất cả phân loại</option>
          {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Chưa có gia đình nào. Bấm <b>+ Thêm gia đình</b> hoặc <b>Tạo gia đình mẫu</b>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Phụ huynh</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3 text-center">Số con</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3 text-right">Công nợ còn lại</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/families/${r.id}`} className="text-blue-700 hover:underline">
                      {r.parent_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.phone}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{r.student_count}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[r.tier as FamilyTier]}`}>
                      {TIER_LABELS[r.tier as FamilyTier]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.debt > 0 ? "text-red-600" : "text-slate-600"}`}>
                    {formatVnd(r.debt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <FamilyForm
          isCeo={isCeo}
          branches={branches}
          defaultBranchId={currentUser.branch_id}
          family={null}
          onClose={() => setAdding(false)}
          onSaved={(id) => { setAdding(false); if (id) router.push(`/families/${id}`); else router.refresh(); }}
        />
      )}
    </main>
  );
}
