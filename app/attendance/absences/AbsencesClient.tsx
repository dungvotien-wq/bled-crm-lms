"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/finance";
import { resolveNotify } from "../actions";
import type { AbsenceRow } from "./page";

export default function AbsencesClient({ rows }: { rows: AbsenceRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function resolve(id: string) {
    startTransition(async () => {
      const r = await resolveNotify(id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="h-page">HV vắng cần báo phụ huynh</h1>
          <p className="t-caption">{rows.length} trường hợp chờ xử lý</p>
        </div>
        <Link href="/attendance" className="text-sm text-primary hover:underline">← Điểm danh</Link>
      </div>

      {/* TODO P2: gửi Zalo OA/ZNS tự động; hiện chỉ đánh dấu thủ công. */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase text-ink-subtle">
            <tr><th className="px-4 py-3">Học viên</th><th className="px-4 py-3">Lớp</th><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">Không có HV vắng nào chờ báo.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 font-medium text-ink">{r.student_name}</td>
                <td className="px-4 py-3 text-ink-muted">{r.class_name}</td>
                <td className="px-4 py-3 text-ink-muted">{formatDate(r.session_date)}</td>
                <td className="px-4 py-3 text-ink-muted">{r.note ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => resolve(r.id)} disabled={isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50">Đánh dấu đã xử lý</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
