import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { durationToMinutes, minutesToDuration } from "../../shared/time";
import { fetchEmployees } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import {
  fetchTimesheetSummary,
  fetchTimesheetDetail,
  bulkUpsertTimesheets,
  deleteTimesheet,
} from "../features/timesheets/api";
import type { TimesheetSummaryRow, TimesheetEntry } from "../features/timesheets/types";

const EMPTY_BULK_ROW = {
  date: "",
  worked: "",
  overtime: "",
  extra: "",
  comment: "",
  entryId: null as number | null,
};

type BulkRow = typeof EMPTY_BULK_ROW;

export default function TimesheetsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");

  const [month, setMonth] = useState(dayjs().subtract(1, "month").format("YYYY-MM"));
  const [summary, setSummary] = useState<{ employees: TimesheetSummaryRow[]; totals: SummaryTotals } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [initialRows, setInitialRows] = useState<BulkRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

const monthLabel = useMemo(() => {
  const [year, monthStr] = month.split("-");
  return dayjs(`${year}-${monthStr}-01`).format("MMMM YYYY");
}, [month]);

  const employeeOptions = useMemo(
    () => employees.filter((employee) => employee.status === "ACTIVE"),
    [employees]
  );

  const selectedEmployee = useMemo(
    () =>
      selectedEmployeeId
        ? employees.find((employee) => employee.id === selectedEmployeeId) ?? null
        : null,
    [employees, selectedEmployeeId]
  );

  useEffect(() => {
    if (selectedEmployeeId) {
      loadDetail(selectedEmployeeId);
    } else {
      setBulkRows([]);
      setInitialRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, month, selectedEmployee?.hourly_rate]);

  const pendingCount = useMemo(
    () => bulkRows.filter((row) => !row.entryId && !hasRowData(row)).length,
    [bulkRows]
  );

  const modifiedCount = useMemo(
    () => bulkRows.filter((row, index) => isRowDirty(row, initialRows[index])).length,
    [bulkRows, initialRows]
  );

  async function loadEmployees() {
    try {
      const data = await fetchEmployees(false);
      setEmployees(data);
      if (!selectedEmployeeId && data.length) {
        setSelectedEmployeeId(data[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los trabajadores";
      setError(message);
    }
  }

  async function loadSummary() {
    setLoadingSummary(true);
    setError(null);
    setInfo(null);
    try {
      const data = await fetchTimesheetSummary(month);
      setSummary({ employees: data.employees, totals: data.totals });
      if (!selectedEmployeeId && data.employees.length) {
        setSelectedEmployeeId(data.employees[0].employeeId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el resumen";
      setError(message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadDetail(employeeId: number) {
    setLoadingDetail(true);
    setError(null);
    try {
      const data = await fetchTimesheetDetail(employeeId, month);
      const rows = buildBulkRows(month, data.entries, selectedEmployee?.hourly_rate ?? 0);
      setBulkRows(rows);
      setInitialRows(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el detalle";
      setError(message);
      setBulkRows([]);
      setInitialRows([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleRowChange(index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) {
    setBulkRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setInfo(null);
  }

  function handleResetRow(index: number) {
    setBulkRows((prev) => {
      const next = [...prev];
      next[index] = { ...initialRows[index] };
      return next;
    });
    setInfo(null);
  }

  async function handleRemoveEntry(row: BulkRow) {
    if (!row.entryId) return;
    if (!confirm("¿Eliminar el registro de este día?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTimesheet(row.entryId);
      if (selectedEmployeeId) {
        await loadSummary();
        await loadDetail(selectedEmployeeId);
      }
      setInfo("Registro eliminado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el registro";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkSave() {
    if (!selectedEmployeeId) {
      setError("Selecciona un trabajador para guardar las horas");
      return;
    }

    setError(null);
    setInfo(null);

    const entries: Array<{
      work_date: string;
      worked_minutes: number;
      overtime_minutes: number;
      extra_amount: number;
      comment: string | null;
    }> = [];
    const removeIds: number[] = [];

    for (let index = 0; index < bulkRows.length; index += 1) {
      const row = bulkRows[index];
      const initial = initialRows[index];
      if (!isRowDirty(row, initial)) continue;

      const worked = parseDuration(row.worked);
      if (worked === null) {
        setError(`Horas inválidas en ${formatDateLabel(row.date)}. Usa formato HH:MM (24 hrs).`);
        return;
      }

      const overtime = parseDuration(row.overtime);
      if (overtime === null) {
        setError(`Horas extra inválidas en ${formatDateLabel(row.date)}. Usa HH:MM.`);
        return;
      }

      const extraMinutes = parseDuration(row.extra);
      if (extraMinutes === null) {
        setError(`Horas extra pagadas inválidas en ${formatDateLabel(row.date)}. Usa HH:MM.`);
        return;
      }
      if (extraMinutes > 0 && (!selectedEmployee || !selectedEmployee.hourly_rate)) {
        setError("Define un valor hora para el trabajador antes de registrar horas pagadas adicionales.");
        return;
      }

      const comment = row.comment.trim() ? row.comment.trim() : null;
      const hasContent = worked > 0 || overtime > 0 || extraMinutes > 0 || Boolean(comment);

      if (!hasContent && row.entryId) {
        removeIds.push(row.entryId);
        continue;
      }

      if (!hasContent) {
        continue;
      }

      const extraAmount = computeExtraAmount(extraMinutes, selectedEmployee?.hourly_rate ?? 0);
      entries.push({
        work_date: row.date,
        worked_minutes: worked,
        overtime_minutes: overtime,
        extra_amount: extraAmount,
        comment,
      });
    }

    if (!entries.length && !removeIds.length) {
      setInfo("No hay cambios para guardar");
      return;
    }

    setSaving(true);
    try {
      await bulkUpsertTimesheets(selectedEmployeeId, entries, removeIds);
      await loadSummary();
      await loadDetail(selectedEmployeeId);
      setInfo("Cambios guardados correctamente");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Registro de horas y pagos</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Consolida horas trabajadas, extras y montos líquidos por trabajador. Selecciona el mes, revisa el
            resumen y completa la tabla diaria sin volver a guardar cada fila.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Periodo
          <input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setInfo(null);
            }}
            className="rounded border px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {info && <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-700">{info}</p>}

      <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Trabajador</th>
              <th className="px-4 py-3 text-left font-semibold">Cargo</th>
              <th className="px-4 py-3 text-left font-semibold">Horas</th>
              <th className="px-4 py-3 text-left font-semibold">Horas extra</th>
              <th className="px-4 py-3 text-left font-semibold">Tarifa</th>
              <th className="px-4 py-3 text-left font-semibold">Extras (HH:MM)</th>
              <th className="px-4 py-3 text-left font-semibold">Subtotal</th>
              <th className="px-4 py-3 text-left font-semibold">Retención</th>
              <th className="px-4 py-3 text-left font-semibold">Líquido</th>
              <th className="px-4 py-3 text-left font-semibold">Fecha pago</th>
            </tr>
          </thead>
          <tbody>
            {loadingSummary && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                  Cargando resumen...
                </td>
              </tr>
            )}
            {!loadingSummary &&
              summary?.employees.map((row) => (
                <tr
                  key={row.employeeId}
                  className={`cursor-pointer odd:bg-slate-50/60 ${
                    row.employeeId === selectedEmployeeId ? "bg-[var(--brand-primary)]/10" : ""
                  }`}
                  onClick={() => setSelectedEmployeeId(row.employeeId)}
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
            {!loadingSummary && summary?.employees.length === 0 && (
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

      <div className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Detalle diario</h2>
            <p className="text-xs text-slate-500">
              {selectedEmployeeId
                ? `Registros de ${monthLabel}`
                : "Selecciona un trabajador en el resumen"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Pendientes: {pendingCount}</span>
            <span>Cambios sin guardar: {modifiedCount}</span>
            {employeeOptions.length > 0 && (
              <select
                value={selectedEmployeeId ?? ""}
                onChange={(event) => setSelectedEmployeeId(Number(event.target.value))}
                className="rounded border px-3 py-2 text-sm"
              >
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {canEdit && selectedEmployeeId && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Ingresa las horas en formato <strong>HH:MM</strong> (24 horas). Déjalo en blanco para marcarlo como pendiente. Si limpias un registro existente, se eliminará al guardar.
            </p>
            <button
              type="button"
              disabled={saving || (!modifiedCount && pendingCount === 0)}
              onClick={handleBulkSave}
              className="inline-flex items-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Horas (HH:MM)</th>
                <th className="px-3 py-2 text-left font-semibold">Horas extra (HH:MM)</th>
                <th className="px-3 py-2 text-left font-semibold">Horas pagadas adicional (HH:MM)</th>
                <th className="px-3 py-2 text-left font-semibold">Comentario</th>
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
                {canEdit && <th className="px-3 py-2 text-right font-semibold">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loadingDetail && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                    Cargando detalle...
                  </td>
                </tr>
              )}
              {!loadingDetail &&
                bulkRows.map((row, index) => {
                  const initial = initialRows[index];
                  const dirty = isRowDirty(row, initial);
                  const status = computeStatus(row, dirty);
                  const statusColor =
                    status === "Registrado"
                      ? "text-emerald-600"
                      : status === "Pendiente"
                        ? "text-slate-400"
                        : status === "Sin guardar"
                          ? "text-amber-600"
                          : "text-slate-600";

                  return (
                    <tr key={row.date} className="odd:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-600">{dayjs(row.date).format("DD-MM-YYYY")}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="00:00"
                          value={row.worked}
                          onChange={(event) => handleRowChange(index, "worked", event.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm"
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="00:00"
                          value={row.overtime}
                          onChange={(event) => handleRowChange(index, "overtime", event.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm"
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={row.extra}
                          onChange={(event) => handleRowChange(index, "extra", event.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm"
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <textarea
                          rows={1}
                          value={row.comment}
                          onChange={(event) => handleRowChange(index, "comment", event.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm"
                          disabled={!canEdit}
                        />
                      </td>
                      <td className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${statusColor}`}>
                        {status}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleResetRow(index)}
                            className="mr-3 text-[var(--brand-primary)]"
                          >
                            Revertir
                          </button>
                          {row.entryId && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEntry(row)}
                              className="text-rose-600"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              {!loadingDetail && !bulkRows.length && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-slate-500">
                    {employeeOptions.length
                      ? "Selecciona un trabajador para ver o editar sus horas."
                      : "Registra a trabajadores activos para comenzar a cargar horas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type SummaryTotals = {
  hours: string;
  overtime: string;
  extraAmount: number;
  subtotal: number;
  retention: number;
  net: number;
};

function buildBulkRows(month: string, entries: TimesheetEntry[], hourlyRate: number): BulkRow[] {
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

function hasRowData(row: BulkRow) {
  return Boolean(row.worked.trim() || row.overtime.trim() || row.extra.trim() || row.comment.trim());
}

function isRowDirty(row: BulkRow, initial?: BulkRow) {
  if (!initial) return hasRowData(row);
  return ["worked", "overtime", "extra", "comment"].some((field) => (row as any)[field] !== (initial as any)[field]);
}

function computeStatus(row: BulkRow, dirty: boolean) {
  if (row.entryId && !dirty) return "Registrado";
  if (row.entryId && dirty) return "Sin guardar";
  if (!row.entryId && hasRowData(row)) return "Sin guardar";
  return "Pendiente";
}

function parseDuration(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^[0-9]{1,2}:[0-9]{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (minutes >= 60) return null;
  return hours * 60 + minutes;
}

function formatDateLabel(value: string) {
  return dayjs(value).format("DD-MM-YYYY");
}

function computeExtraAmount(extraMinutes: number, hourlyRate: number) {
  if (!hourlyRate || extraMinutes <= 0) return 0;
  return Math.round((extraMinutes / 60) * hourlyRate * 100) / 100;
}

function formatExtraHours(row: TimesheetSummaryRow) {
  if (!row.hourlyRate || !row.extraAmount) return "00:00";
  const minutes = Math.round((row.extraAmount / row.hourlyRate) * 60);
  return minutesToDuration(minutes);
}

function formatTotalExtraHours(rows: TimesheetSummaryRow[]) {
  let totalMinutes = 0;
  for (const row of rows) {
    if (row.hourlyRate && row.extraAmount) {
      totalMinutes += Math.round((row.extraAmount / row.hourlyRate) * 60);
    }
  }
  return minutesToDuration(totalMinutes);
}
