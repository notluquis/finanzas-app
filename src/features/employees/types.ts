export type Employee = {
  id: number;
  full_name: string;
  role: string;
  email: string | null;
  rut: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  salary_type: "hourly" | "fixed";
  hourly_rate: number;
  fixed_salary: number | null;
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
  rut?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  salary_type: "hourly" | "fixed";
  hourly_rate?: number;
  fixed_salary?: number | null;
  overtime_rate?: number | null;
  retention_rate: number;
  metadata?: Record<string, unknown> | null;
};

export type EmployeeUpdatePayload = Partial<EmployeePayload> & {
  status?: "ACTIVE" | "INACTIVE";
};
