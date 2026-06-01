// =====================================================================
// CÔNG THỨC CHẤM ĐIỂM LEAD (0-100)
// -----------------------------------------------------------------------
// Bob: muốn chỉnh điểm thì sửa các con số trong file này, không cần đụng
// chỗ khác. Điểm = điểm nguồn + điểm tương tác + điểm giai đoạn (cap 100).
// =====================================================================

import type { LeadSource, LeadStage } from "@/lib/leads-types";

// 1) ĐIỂM THEO NGUỒN — nguồn "nóng" (giới thiệu, vãng lai) cao hơn.
export const SOURCE_POINTS: Record<LeadSource, number> = {
  referral: 30, // được giới thiệu — chất lượng cao nhất
  walk_in: 25,  // tự đến trung tâm
  zalo: 15,
  facebook: 12,
  web_form: 10,
  other: 5,
};

// 2) ĐIỂM THEO TƯƠNG TÁC — mỗi lần liên hệ gần đây cộng thêm, có trần.
export const POINTS_PER_INTERACTION = 8; // mỗi tương tác trong 30 ngày
export const MAX_INTERACTION_POINTS = 40; // trần điểm tương tác
export const INTERACTION_WINDOW_DAYS = 30; // chỉ tính tương tác trong 30 ngày

// 3) ĐIỂM THEO GIAI ĐOẠN — càng tiến sâu trong pipeline càng "nóng".
export const STAGE_POINTS: Record<LeadStage, number> = {
  new: 0,
  consulting: 10,
  test: 20,
  registered: 30,
  paid: 30, // đã đóng phí — giữ mức cao
  lost: 0,  // đã mất — không cộng
};

export const MAX_SCORE = 100;

/**
 * Tính điểm lead. recentInteractions = số tương tác trong INTERACTION_WINDOW_DAYS ngày.
 */
export function computeLeadScore(input: {
  source: LeadSource;
  stage: LeadStage;
  recentInteractions: number;
}): number {
  const sourcePts = SOURCE_POINTS[input.source] ?? 0;
  const interactionPts = Math.min(
    input.recentInteractions * POINTS_PER_INTERACTION,
    MAX_INTERACTION_POINTS
  );
  const stagePts = STAGE_POINTS[input.stage] ?? 0;

  const total = sourcePts + interactionPts + stagePts;
  return Math.max(0, Math.min(MAX_SCORE, total));
}
