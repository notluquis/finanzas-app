export type Employee = {
  id: number;
  full_name: string;
  role: string;
  email: string | null;
  hourly_rate: number;
  overtime_rate: number | null;
  retention_rate: number;
  status: "ACTIVE" | "INACTIVE";
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type EmployeePayload = {
  full_name: string;
  role: string;
  email?: string | null;
  hourly_rate: number;
  overtime_rate?: number | null;
  retention_rate: number;
  metadata?: Record<string, unknown> | null;
};

export type EmployeeUpdatePayload = Partial<EmployeePayload> & {
  status?: "ACTIVE" | "INACTIVE";
};
