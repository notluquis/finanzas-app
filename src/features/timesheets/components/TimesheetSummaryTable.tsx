import { useMemo } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import type { TimesheetSummaryRow } from "../types";
import { minutesToDuration, formatExtraHours, formatTotalExtraHours } from "../utils";

interface TimesheetSummaryTableProps {
  summary: { employees: TimesheetSummaryRow[]; totals: SummaryTotals } | null;
  loading: boolean;
  selectedEmployeeId: number | null;
  onSelectEmployee: (id: number) => void;
}

type SummaryTotals = {
  hours: string;
  overtime: string;
  extraAmount: number;
  subtotal: number;
  retention: number;
  net: number;
};

export default function TimesheetSummaryTable({
  summary,
  loading,
  selectedEmployeeId,
  onSelectEmployee,
}: TimesheetSummaryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-white shadow-sm">
      <div className="overflow-x-auto muted-scrollbar">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Trabajador</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Cargo</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Horas</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Horas extra</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Tarifa</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Extras (HH:MM)</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Subtotal</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Retención</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Líquido</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Fecha pago</th>
            </tr>
          </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                Cargando resumen...
              </td>
            </tr>
          )}
          {!loading &&
            summary?.employees.map((row) => (
              <tr
                key={row.employeeId}
                className={`cursor-pointer odd:bg-slate-50/60 ${
                  row.employeeId === selectedEmployeeId ? "bg-[var(--brand-primary)]/10" : ""
                }`}
                onClick={() => onSelectEmployee(row.employeeId)}
              >
                <td className="px-4 py-3 font-medium text-slate-700">{row.fullName}</td>
                <td className="px-4 py-3 text-slate-500">{row.role}</td>
                <td className="px-4 py-3 text-slate-600">{row.hoursFormatted}</td>
                <td className="px-4 py-3 text-slate-600">{row.overtimeFormatted}</td>
                <td className="px-4 py-3 text-slate-600">{fmtCLP(row.hourlyRate)}</td>
                <td className="px-4 py-3 text-slate-600">{formatExtraHours(row)}</td>
                <td className="px-4 py-3 text-slate-600">{fmtCLP(row.subtotal)}</td>
                <td className="px-4 py-3 text-slate-600">{fmtCLP(row.retention)}</td>
                <td className="px-4 py-3 text-slate-600">{fmtCLP(row.net)}</td>
                <td className="px-4 py-3 text-slate-600">{dayjs(row.payDate).format("DD-MM-YYYY")}</td>
              </tr>
            ))}
          {!loading && summary?.employees.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                Aún no registras horas en este periodo.
              </td>
            </tr>
          )}
        </tbody>
        {summary && (
          <tfoot className="bg-slate-100 text-slate-700">
            <tr>
              <td className="px-4 py-3 font-semibold" colSpan={2}>
                TOTAL
              </td>
              <td className="px-4 py-3 font-semibold">{summary.totals.hours}</td>
              <td className="px-4 py-3 font-semibold">{summary.totals.overtime}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 font-semibold">{formatTotalExtraHours(summary.employees)}</td>
              <td className="px-4 py-3 font-semibold">{fmtCLP(summary.totals.subtotal)}</td>
              <td className="px-4 py-3 font-semibold">{fmtCLP(summary.totals.retention)}</td>
              <td className="px-4 py-3 font-semibold">{fmtCLP(summary.totals.net)}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </div>
  );
}