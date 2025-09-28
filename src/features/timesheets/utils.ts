import dayjs from "dayjs";
import type { BulkRow, TimesheetEntry, TimesheetSummaryRow } from "./types";

export function buildBulkRows(month: string, entries: TimesheetEntry[], hourlyRate: number): BulkRow[] {
  const base = dayjs(`${month}-01`);
  const days = base.daysInMonth();
  const entryMap = new Map(entries.map((entry) => [entry.work_date, entry]));
  const rows: BulkRow[] = [];
  for (let day = 1; day <= days; day += 1) {
    const date = base.date(day).format("YYYY-MM-DD");
    const entry = entryMap.get(date);
    const extraMinutes = hourlyRate > 0 && entry && entry.extra_amount
      ? Math.round((entry.extra_amount / hourlyRate) * 60)
      : 0;
    rows.push({
      date,
      worked: entry && entry.worked_minutes ? minutesToDuration(entry.worked_minutes) : "",
      overtime: entry && entry.overtime_minutes ? minutesToDuration(entry.overtime_minutes) : "",
      extra: extraMinutes ? minutesToDuration(extraMinutes) : "",
      comment: entry?.comment ?? "",
      entryId: entry?.id ?? null,
    });
  }
  return rows;
}

export function hasRowData(row: BulkRow): boolean {
  return Boolean(row.worked.trim() || row.overtime.trim() || row.extra.trim() || row.comment.trim());
}

export function isRowDirty(row: BulkRow, initial?: BulkRow): boolean {
  if (!initial) return hasRowData(row);
  return ["worked", "overtime", "extra", "comment"].some((field) => (row as any)[field] !== (initial as any)[field]);
}

export function computeStatus(row: BulkRow, dirty: boolean): string {
  if (row.entryId && !dirty) return "Registrado";
  if (row.entryId && dirty) return "Sin guardar";
  if (!row.entryId && hasRowData(row)) return "Sin guardar";
  return "Pendiente";
}

export function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^[0-9]{1,2}:[0-9]{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (minutes >= 60) return null;
  return hours * 60 + minutes;
}

export function formatDateLabel(value: string): string {
  return dayjs(value).format("DD-MM-YYYY");
}

export function computeExtraAmount(extraMinutes: number, hourlyRate: number): number {
  if (!hourlyRate || extraMinutes <= 0) return 0;
  return Math.round((extraMinutes / 60) * hourlyRate * 100) / 100;
}

export function formatExtraHours(row: TimesheetSummaryRow): string {
  if (!row.hourlyRate || !row.extraAmount) return "00:00";
  const minutes = Math.round((row.extraAmount / row.hourlyRate) * 60);
  return minutesToDuration(minutes);
}

export function formatTotalExtraHours(rows: TimesheetSummaryRow[]): string {
  let totalMinutes = 0;
  for (const row of rows) {
    if (row.hourlyRate && row.extraAmount) {
      totalMinutes += Math.round((row.extraAmount / row.hourlyRate) * 60);
    }
  }
  return minutesToDuration(totalMinutes);
}

export function minutesToDuration(totalMinutes: number): string {
  if (totalMinutes < 0) {
    return "-" + minutesToDuration(-totalMinutes);
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}