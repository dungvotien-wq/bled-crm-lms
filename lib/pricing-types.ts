export interface TuitionPlan {
  id: string;
  branch_id: string | null;
  program: string;
  period_type: string;
  unit_price: number;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
  branch_name?: string | null; // join
}
