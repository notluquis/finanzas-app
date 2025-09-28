export type TimesheetEntry = {
  id: number;
  employee_id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  extra_amount: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type TimesheetPayload = {
  employee_id: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  worked_minutes: number;
  overtime_minutes?: number;
  extra_amount?: number;
  comment?: string | null;
};

export type TimesheetSummaryRow = {
  employeeId: number;
  fullName: string;
  role: string;
  email: string | null;
  hoursFormatted: string;
  overtimeFormatted: string;
  hourlyRate: number;
  overtimeRate: number;
  retentionRate: number;
  extraAmount: number;
  subtotal: number;
  retention: number;
  net: number;
  payDate: string;
};

export type TimesheetSummaryResponse = {
  month: string;
  from: string;
  to: string;
  employees: TimesheetSummaryRow[];
  totals: {
    hours: string;
    overtime: string;
    extraAmount: number;
    subtotal: number;
    retention: number;
    net: number;
  };
};

export const EMPTY_BULK_ROW = {
  date: "",
  worked: "",
  overtime: "",
  extra: "",
  comment: "",
  entryId: null as number | null,
};

export type BulkRow = typeof EMPTY_BULK_ROW;