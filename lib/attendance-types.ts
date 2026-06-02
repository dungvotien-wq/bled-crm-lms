export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const ATT_STATUS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "Có mặt", color: "bg-success/10 text-success border-success/40" },
  { value: "late", label: "Đi trễ", color: "bg-warning/10 text-warning border-warning/40" },
  { value: "excused", label: "Vắng có phép", color: "bg-primary-soft text-primary border-primary/40" },
  { value: "absent", label: "Vắng KP", color: "bg-danger/10 text-danger border-danger/40" },
];

export const ATT_LABEL: Record<AttendanceStatus, string> = {
  present: "Có mặt", late: "Đi trễ", excused: "Vắng có phép", absent: "Vắng không phép",
};

export interface SessionPick {
  id: string;
  class_code: string;
  class_name: string;
  planned_start: string;
  planned_end: string;
  status: string;
  attendance_locked: boolean;
}

export interface RosterStudent {
  student_id: string;
  name: string;
  status: AttendanceStatus | null;
  note: string;
}

export interface SessionTeacherCI {
  teacher_id: string;
  name: string;
  role: string;
  is_self: boolean;
  check_in_at: string | null;
  check_out_at: string | null;
}

export interface RosterData {
  session: {
    id: string; class_name: string; class_code: string;
    session_date: string; planned_start: string; planned_end: string;
    status: string; attendance_locked: boolean;
    locked_at: string | null; locked_by_name: string | null;
  };
  students: RosterStudent[];
  teachers: SessionTeacherCI[];
  taken_at: string | null;
  taken_by_name: string | null;
  canEdit: boolean;     // có quyền & chưa khóa
  canLock: boolean;     // được chốt buổi
  canReopen: boolean;   // được mở lại
}
