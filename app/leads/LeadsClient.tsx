"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Lead,
  BranchOption,
  UserOption,
  LeadSource,
  LeadStage,
} from "@/lib/leads-types";
import { SOURCE_LABELS, STAGE_LABELS, STAGE_ORDER } from "@/lib/leads-types";
import type { UserRole } from "@/lib/permissions";
import { createSampleLeads } from "./actions";
import KanbanBoard from "./KanbanBoard";
import LeadTable from "./LeadTable";
import LeadForm from "./LeadForm";

interface Props {
  currentUser: { role: UserRole; branch_id: string | null; branch_name: string | null };
  leads: Lead[];
  branches: BranchOption[];
  users: UserOption[];
}

export default function LeadsClient({ currentUser, leads, branches, users }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [isPending, startTransition] = useTransition();

  // Bộ lọc
  const [fBranch, setFBranch] = useState<string>("all");
  const [fSource, setFSource] = useState<string>("all");
  const [fStage, setFStage] = useState<string>("all");
  const [fAssignee, setFAssignee] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Form thêm/sửa
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  // Sắp xếp danh sách theo ngày nhập
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const isCeo = currentUser.role === "ceo";
  const userMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.full_name])),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (isCeo && fBranch !== "all" && l.branch_id !== fBranch) return false;
      if (fSource !== "all" && l.source !== fSource) return false;
      if (fStage !== "all" && l.stage !== fStage) return false;
      if (fAssignee !== "all" && l.assigned_to !== fAssignee) return false;
      if (q) {
        const hay = `${l.student_name ?? ""} ${l.contact_name} ${l.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, isCeo, fBranch, fSource, fStage, fAssignee, search]);

  const sortedForList = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDir === "desc" ? db - da : da - db;
    });
    return arr;
  }, [filtered, sortDir]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(lead: Lead) {
    setEditing(lead);
    setFormOpen(true);
  }
  // Mở lead đang trùng (từ cảnh báo trong form)
  function openDuplicate(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setEditing(lead);
      setFormOpen(true);
    }
  }
  function onSaved() {
    setFormOpen(false);
    router.refresh();
  }
  function handleSample() {
    startTransition(async () => {
      const branchArg = isCeo ? (fBranch !== "all" ? fBranch : undefined) : undefined;
      const res = await createSampleLeads(branchArg);
      if (!res.ok) alert("Lỗi tạo dữ liệu mẫu: " + res.error);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Lead</h1>
          <p className="text-sm text-slate-500">
            {isCeo ? "Toàn hệ thống" : `Chi nhánh: ${currentUser.branch_name ?? "—"}`} ·{" "}
            {filtered.length} lead
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSample}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {isPending ? "Đang tạo…" : "Tạo 5 lead mẫu"}
          </button>
          <button
            onClick={openAdd}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Thêm lead
          </button>
        </div>
      </div>

      {/* Thanh lọc */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên / SĐT…"
          className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {isCeo && (
          <Select value={fBranch} onChange={setFBranch} label="Chi nhánh">
            <option value="all">Tất cả chi nhánh</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        )}
        <Select value={fSource} onChange={setFSource} label="Nguồn">
          <option value="all">Tất cả nguồn</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select value={fStage} onChange={setFStage} label="Trạng thái">
          <option value="all">Tất cả trạng thái</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </Select>
        <Select value={fAssignee} onChange={setFAssignee} label="Phụ trách">
          <option value="all">Tất cả người phụ trách</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </Select>

        {/* Chuyển chế độ xem */}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-2 text-sm ${view === "kanban" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-2 text-sm ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
          >
            Danh sách
          </button>
        </div>
      </div>

      {/* Nội dung */}
      {view === "kanban" ? (
        <KanbanBoard leads={filtered} userMap={userMap} onEdit={openEdit} />
      ) : (
        <LeadTable
          leads={sortedForList}
          userMap={userMap}
          onEdit={openEdit}
          sortDir={sortDir}
          onToggleSort={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
        />
      )}

      {/* Form modal */}
      {formOpen && (
        <LeadForm
          isCeo={isCeo}
          branches={branches}
          users={users}
          userMap={userMap}
          defaultBranchId={currentUser.branch_id}
          allLeads={leads}
          lead={editing}
          onClose={() => setFormOpen(false)}
          onSaved={onSaved}
          onOpenDuplicate={openDuplicate}
        />
      )}
    </main>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
    >
      {children}
    </select>
  );
}
