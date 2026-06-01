"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Lead, LeadStage } from "@/lib/leads-types";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
  SOURCE_LABELS,
  CONTACT_ROLE_LABELS,
  REFERRER_TYPE_LABELS,
} from "@/lib/leads-types";
import { updateLeadStage } from "./actions";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  leads: Lead[];
  userMap: Record<string, string>;
  onEdit: (lead: Lead) => void;
}

export default function KanbanBoard({ leads, userMap, onEdit }: Props) {
  // State cục bộ để kéo-thả mượt (optimistic), đồng bộ lại khi props đổi.
  const [items, setItems] = useState<Lead[]>(leads);
  useEffect(() => setItems(leads), [leads]);

  const byStage = (stage: LeadStage) => items.filter((l) => l.stage === stage);

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId as LeadStage;
    const lead = items.find((l) => l.id === draggableId);
    if (!lead) return;

    // Optimistic: cập nhật UI ngay
    setItems((prev) =>
      prev.map((l) => (l.id === draggableId ? { ...l, stage: newStage } : l))
    );

    const res = await updateLeadStage(lead.id, newStage, lead.source);
    if (!res.ok) {
      // Hoàn tác nếu lỗi
      setItems((prev) =>
        prev.map((l) => (l.id === draggableId ? { ...l, stage: lead.stage } : l))
      );
      alert("Không cập nhật được trạng thái: " + res.error);
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGE_ORDER.map((stage) => {
          const colLeads = byStage(stage);
          const totalScore = colLeads.reduce((s, l) => s + (l.score ?? 0), 0);
          const avgScore = colLeads.length
            ? Math.round(totalScore / colLeads.length)
            : 0;
          return (
            <Droppable droppableId={stage} key={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex w-64 shrink-0 flex-col rounded-xl border bg-slate-50 ${
                    snapshot.isDraggingOver ? "ring-2 ring-blue-300" : ""
                  }`}
                >
                  {/* Tiêu đề cột */}
                  <div className="flex items-center justify-between p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage]}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {colLeads.length} lead · TĐ {totalScore} · TB {avgScore}
                    </span>
                  </div>

                  {/* Thẻ lead */}
                  <div className="flex-1 space-y-2 px-2 pb-3">
                    {colLeads.map((lead, idx) => (
                      <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            onClick={() => onEdit(lead)}
                            className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm hover:border-blue-300 ${
                              snap.isDragging ? "shadow-lg" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800">
                                {lead.student_name || "(chưa có tên HV)"}
                              </p>
                              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                                {lead.score}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {lead.contact_name}
                              {lead.contact_role ? ` · ${CONTACT_ROLE_LABELS[lead.contact_role]}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{lead.phone}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-400">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                {SOURCE_LABELS[lead.source]}
                              </span>
                              {(lead.programs ?? []).map((p) => (
                                <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                                  {p}
                                </span>
                              ))}
                            </div>
                            {lead.assigned_to && userMap[lead.assigned_to] && (
                              <p className="mt-2 text-xs text-slate-500">
                                👤 {userMap[lead.assigned_to]}
                              </p>
                            )}
                            {lead.referrer_type && lead.referrer_type !== "none" && (
                              <p className="mt-1 text-[11px] text-emerald-600">
                                🎁 Giới thiệu bởi: {lead.referrer_name || "(không tên)"} ({REFERRER_TYPE_LABELS[lead.referrer_type]})
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-slate-400">
                              Nhập: {formatDate(lead.created_at)}
                            </p>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
