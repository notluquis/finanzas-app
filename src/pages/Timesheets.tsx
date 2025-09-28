import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { fetchEmployees } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import {
  fetchTimesheetSummary,
  fetchTimesheetDetail,
  bulkUpsertTimesheets,
  deleteTimesheet,
} from "../features/timesheets/api";
import type { TimesheetEntry, BulkRow, TimesheetSummaryRow } from "../features/timesheets/types";
import { buildBulkRows, hasRowData, isRowDirty, parseDuration, formatDateLabel, computeExtraAmount } from "../features/timesheets/utils";
import TimesheetSummaryTable from "../features/timesheets/components/TimesheetSummaryTable";
import TimesheetDetailTable from "../features/timesheets/components/TimesheetDetailTable";
import Alert from "../components/Alert";
import Input from "../components/Input";

const EMPTY_BULK_ROW = {
  date: "",
  worked: "",
  overtime: "",
  extra: "",
  comment: "",
  entryId: null as number | null,
};

export default function TimesheetsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");

  const [month, setMonth] = useState(dayjs().subtract(1, "month").format("YYYY-MM"));
  const [summary, setSummary] = useState<{ employees: TimesheetSummaryRow[]; totals: any } | null>(null);
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
  }, [selectedEmployeeId, month, selectedEmployee?.hourly_rate]);

  const pendingCount = useMemo(
    () => bulkRows.filter((row) => !row.entryId && hasRowData(row)).length,
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
        <Input
          label="Periodo"
          type="month"
          value={month}
          onChange={(event) => {
            setMonth(event.target.value);
            setInfo(null);
          }}
          className="w-fit"
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      <TimesheetSummaryTable
        summary={summary}
        loading={loadingSummary}
        selectedEmployeeId={selectedEmployeeId}
        onSelectEmployee={setSelectedEmployeeId}
      />

      <TimesheetDetailTable
        bulkRows={bulkRows}
        initialRows={initialRows}
        loadingDetail={loadingDetail}
        selectedEmployee={selectedEmployee}
        onRowChange={handleRowChange}
        onResetRow={handleResetRow}
        onRemoveEntry={handleRemoveEntry}
        onBulkSave={handleBulkSave}
        saving={saving}
        pendingCount={pendingCount}
        modifiedCount={modifiedCount}
        monthLabel={monthLabel}
        employeeOptions={employeeOptions}
        setSelectedEmployeeId={setSelectedEmployeeId}
      />
    </section>
  );
}