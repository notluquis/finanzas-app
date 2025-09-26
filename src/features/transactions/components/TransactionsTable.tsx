import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import { COLUMN_DEFS, type ColumnKey } from "../constants";
import type { LedgerRow } from "../types";

type Props = {
  rows: LedgerRow[];
  loading: boolean;
  hasAmounts: boolean;
  visibleColumns: Set<ColumnKey>;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function TransactionsTable({
  rows,
  loading,
  hasAmounts,
  visibleColumns,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const activeColumns = COLUMN_DEFS.filter((column) => visibleColumns.has(column.key));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
          <tr>
            {activeColumns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left font-semibold">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="odd:bg-slate-50/60">
              {activeColumns.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  {renderCell(column.key, row, hasAmounts)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && !loading && (
            <tr>
              <td colSpan={activeColumns.length} className="px-4 py-6 text-center text-gray-500">
                No hay resultados con los filtros actuales.
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan={activeColumns.length} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                Cargando movimientos...
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--brand-primary)]/10 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <div>
          Página {page} de {totalPages} · {total} movimientos
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span>Tamaño de página</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded border px-2 py-1"
            >
              {[20, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || loading}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCell(key: ColumnKey, row: LedgerRow, hasAmounts: boolean) {
  switch (key) {
    case "date":
      return formatDate(row.timestamp);
    case "time":
      return formatTime(row.timestamp);
    case "description":
      return row.description ?? "-";
    case "origin":
      return row.origin ?? "-";
    case "destination":
      if (row.direction === "OUT" && row.payout) {
        const bankDetails = [row.payout.bankName, row.payout.bankAccountNumber]
          .filter((part) => part && part.trim().length)
          .join(" · ");
        return (
          <div className="space-y-0.5">
            <div className="font-medium text-slate-700">
              {row.payout.bankAccountHolder || row.destination || "-"}
            </div>
            {bankDetails && <div className="text-xs text-slate-500">{bankDetails}</div>}
          </div>
        );
      }
      return row.destination ?? "-";
    case "source_id":
      return row.source_id ?? "-";
    case "direction":
      return formatDirection(row.direction);
    case "amount":
      return (
        <span
          className={
            row.direction === "IN"
              ? "font-semibold text-emerald-600"
              : row.direction === "OUT"
                ? "font-semibold text-rose-600"
                : "text-slate-600"
          }
        >
          {formatAmount(row.direction, row.amount, hasAmounts)}
        </span>
      );
    case "runningBalance":
      return hasAmounts ? fmtCLP(row.runningBalance) : "—";
    default:
      return "-";
  }
}

function formatDirection(direction: LedgerRow["direction"]) {
  if (direction === "IN") return "Ingreso";
  if (direction === "OUT") return "Egreso";
  return "Neutro";
}

function formatAmount(
  direction: LedgerRow["direction"],
  amount: number | null,
  hasAmounts: boolean
) {
  if (!hasAmounts || amount == null) return "—";
  const formatted = fmtCLP(amount);
  return direction === "OUT" ? `-${formatted}` : formatted;
}

function formatDate(timestamp: string) {
  const date = dayjs(timestamp);
  return date.isValid() ? date.format("DD-MM-YYYY") : timestamp;
}

function formatTime(timestamp: string) {
  const date = dayjs(timestamp);
  return date.isValid() ? date.format("HH:mm:ss") : "-";
}
