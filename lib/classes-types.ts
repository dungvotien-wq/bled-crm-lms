export type ClassStatus = "active" | "completed" | "cancelled";
export type SessionMode = "offline" | "online";
export type SessionStatus = "scheduled" | "done" | "cancelled";

export const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]; // index 0..6
export const weekdayLabel = (w: number) => WEEKDAYS[w] ?? "?";

export const MODE_LABELS: Record<SessionMode, string> = { offline: "Tại lớp", online: "Online" };
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "Đã lên lịch", done: "Đã dạy", cancelled: "Đã hủy",
};
export const SESSION_STATUS_COLORS: Record<SessionStatus, string> = {
  scheduled: "bg-primary-soft text-primary",
  done: "bg-success/10 text-success",
  cancelled: "bg-danger/10 text-danger",
};

export interface ClassRow {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  program: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  enrolled_count: number;
  session_count: number;
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  weekday: number;
  planned_start: string;
  planned_end: string;
  mode: SessionMode;
  room: string | null;
  effective_from: string | null;
  effective_to: string | null;
  active: boolean;
}

export interface SessionRow {
  id: string;
  session_date: string;
  planned_start: string;
  planned_end: string;
  mode: SessionMode;
  room: string | null;
  teams_meeting_url: string | null;
  status: SessionStatus;
  makeup_of: string | null;
  teachers: { teacher_id: string; name: string; role: string }[];
}

export interface EnrollmentRow {
  id: string;
  student_id: string;
  student_name: string;
  status: string;
}

export interface TeacherOption { id: string; full_name: string; teacher_type: string }
