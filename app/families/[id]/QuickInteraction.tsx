"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INTERACTION_CHANNELS } from "@/lib/families-types";
import { addFamilyInteraction } from "../actions";

export default function QuickInteraction({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [channel, setChannel] = useState("call");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!summary.trim()) return setError("Nhập nội dung tương tác.");
    startTransition(async () => {
      const res = await addFamilyInteraction(familyId, channel, summary);
      if (!res.ok) return setError(res.error ?? "Có lỗi xảy ra.");
      setSummary("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Ghi nhanh tương tác</h3>
      <div className="flex flex-wrap gap-2">
        <select value={channel} onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {INTERACTION_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Nội dung trao đổi…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit} disabled={isPending}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
          {isPending ? "Đang ghi…" : "Ghi lại"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
