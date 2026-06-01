"use client";

import type { Lead } from "@/lib/leads-types";
import { SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS } from "@/lib/leads-types";

interface Props {
  leads: Lead[];
  userMap: Record<string, string>;
  onEdit: (lead: Lead) => void;
  sortDir: "asc" | "desc";
  onToggleSort: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function LeadTable({ leads, userMap, onEdit, sortDir, onToggleSort }: Props) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        Chưa có lead nào. Bấm <b>+ Thêm lead</b> hoặc <b>Tạo 5 lead mẫu</b>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Học viên</th>
            <th className="px-4 py-3">Người liên hệ</th>
            <th className="px-4 py-3">SĐT</th>
            <th className="px-4 py-3">Nguồn</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3">Chương trình</th>
            <th className="px-4 py-3">Phụ trách</th>
            <th
              className="cursor-pointer select-none px-4 py-3 hover:text-slate-700"
              onClick={onToggleSort}
            >
              Ngày nhập {sortDir === "desc" ? "▼" : "▲"}
            </th>
            <th className="px-4 py-3 text-right">Điểm</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onEdit(l)}
              className="cursor-pointer hover:bg-slate-50"
            >
              <td className="px-4 py-3 font-medium text-slate-800">{l.student_name || "—"}</td>
              <td className="px-4 py-3 text-slate-600">{l.contact_name}</td>
              <td className="px-4 py-3 text-slate-600">{l.phone}</td>
              <td className="px-4 py-3 text-slate-600">{SOURCE_LABELS[l.source]}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[l.stage]}`}>
                  {STAGE_LABELS[l.stage]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(l.programs ?? []).length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    (l.programs ?? []).map((p) => (
                      <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                        {p}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {l.assigned_to ? userMap[l.assigned_to] ?? "—" : "—"}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(l.created_at)}</td>
              <td className="px-4 py-3 text-right font-semibold text-blue-700">{l.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
